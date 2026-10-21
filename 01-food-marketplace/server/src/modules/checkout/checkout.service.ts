import { Types } from "mongoose";
import { v4 as uuid } from "uuid";
import { config } from "../../shared/config.js";
import { withTransaction } from "../../shared/db.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError
} from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { fromCents } from "../../shared/money.js";
import { enqueueNotification, JOB_NAMES } from "../../shared/queue.js";
import { getPaymentProvider } from "../../shared/adapters/payment.js";
import { Cart } from "../cart/cart.model.js";
import { CartItem } from "../cart/cartItem.model.js";
import { confirmReservationsForCheckout, releaseForCheckout, reserveForCheckout } from "../inventory/inventory.service.js";
import { Order, type IOrderItem } from "../orders/order.model.js";
import { toOrderDto } from "../orders/orders.service.js";
import {
  assertLinesPurchasable,
  cartFingerprint,
  computeCartPricing
} from "../pricing/pricing.service.js";
import type { PricingSnapshot } from "../pricing/types.js";
import { Coupon } from "../promotions/coupon.model.js";
import { CouponRedemption } from "../promotions/couponRedemption.model.js";
import { CheckoutIntent, type CheckoutIntentDocument } from "./checkoutIntent.model.js";

export interface CheckoutStartResult {
  checkoutId: string;
  paymentIntentId: string;
  clientSecret: string | null;
  amountCents: number;
  currency: string;
  pricing: PricingSnapshot;
}

function orderItemsFromSnapshot(snapshot: PricingSnapshot, storeId: string): IOrderItem[] {
  const store = snapshot.stores.find((candidate) => candidate.storeId === storeId);
  if (!store) throw new Error("Missing store snapshot");
  return store.lines.map((line) => ({
    productId: new Types.ObjectId(line.productId),
    nameAtPurchase: line.name,
    unitAtPurchase: line.unit,
    quantity: line.quantity,
    priceAtPurchase: fromCents(line.priceCents),
    priceAtPurchaseCents: line.priceCents,
    lineSubtotalCents: line.lineSubtotalCents,
    discountCents: line.discountCents,
    lineTotalCents: line.lineTotalCents,
    lineTotal: fromCents(line.lineTotalCents)
  }));
}

async function loadOrders(intent: CheckoutIntentDocument) {
  if (intent.orderIds.length === 0) return [];
  const orders = await Order.find({ _id: { $in: intent.orderIds } })
    .populate({ path: "storeId", select: "name slug" })
    .sort({ createdAt: 1 });
  return orders.map((order) => toOrderDto(order as never));
}

export async function startCheckout(input: {
  userId: string;
  checkoutId?: string;
  now?: Date;
}): Promise<CheckoutStartResult> {
  const pricingResult = await computeCartPricing({ userId: input.userId, now: input.now });
  assertLinesPurchasable(pricingResult.lines);
  if (pricingResult.pricing.totalCents <= 0) {
    throw new BadRequestError("Cart total must be greater than zero", "CART_EMPTY");
  }
  if (pricingResult.couponError) {
    logger.warn(
      {
        userId: input.userId,
        checkoutId: input.checkoutId,
        reason: pricingResult.couponFailureReason
      },
      "checkout_coupon_rejected"
    );
    throw new ConflictError(
      "Your coupon is no longer valid. Review your cart and try again.",
      "COUPON_INVALID"
    );
  }

  const checkoutId = input.checkoutId ?? uuid();
  const fingerprint = cartFingerprint(
    pricingResult.lines,
    pricingResult.pricing.coupon?.code ?? null
  );

  if (input.checkoutId) {
    const existing = await CheckoutIntent.findOne({ checkoutId: input.checkoutId });
    if (existing) {
      if (existing.userId.toString() !== input.userId) {
        throw new ForbiddenError();
      }
      if (existing.status === "completed") {
        throw new ConflictError(
          "This checkout is already complete. Start a new checkout.",
          "CHECKOUT_COMPLETE"
        );
      }
      if (existing.cartFingerprint !== fingerprint) {
        throw new ConflictError(
          "Your cart changed during checkout. Return to the cart and start again.",
          "CHECKOUT_CHANGED"
        );
      }
      if (existing.expiresAt.getTime() < Date.now()) {
        throw new ConflictError(
          "This checkout hold expired. Return to the cart and start again.",
          "CHECKOUT_EXPIRED"
        );
      }
      if (existing.stripePaymentIntentId) {
        const intent = await getPaymentProvider().retrieveIntent(existing.stripePaymentIntentId);
        return {
          checkoutId: existing.checkoutId,
          paymentIntentId: existing.stripePaymentIntentId,
          clientSecret: intent.clientSecret,
          amountCents: existing.amountCents,
          currency: existing.currency,
          pricing: existing.pricingSnapshot
        };
      }

      // A previous attempt may have crashed before Stripe returned an intent.
      // Only clean up a failed attempt or a stale placeholder with no holds;
      // never delete an in-flight reservation or a request waiting on Stripe.
      const ageMs = Date.now() - existing.updatedAt.getTime();
      const stalePlaceholder =
        existing.status === "created" && existing.reservationIds.length === 0 && ageMs > 60_000;
      if (existing.status !== "failed" && !stalePlaceholder) {
        throw new ConflictError(
          "Checkout is already starting. Please retry in a moment.",
          "CHECKOUT_IN_PROGRESS"
        );
      }
      await releaseForCheckout(existing.checkoutId);
      await existing.deleteOne();
    }
  }

  // Do this before any database writes so a missing Stripe configuration
  // returns 503 without holding stock.
  const paymentProvider = getPaymentProvider();
  const expiresAt = new Date(
    Date.now() + config.reservationTtlMinutes * 60 * 1_000
  );

  let intent: CheckoutIntentDocument;
  try {
    intent = await CheckoutIntent.create({
      checkoutId,
      userId: new Types.ObjectId(input.userId),
      currency: config.currency,
      amountCents: pricingResult.pricing.totalCents,
      cartFingerprint: fingerprint,
      pricingSnapshot: pricingResult.pricing,
      cartItemIds: pricingResult.lines.map((line) => new Types.ObjectId(line.cartItemId)),
      reservationIds: [],
      status: "created",
      expiresAt
    });
  } catch (error) {
    const duplicate =
      typeof error === "object" && error && "code" in error && error.code === 11000;
    if (!duplicate) throw error;
    const existing = await CheckoutIntent.findOne({ checkoutId });
    if (existing?.stripePaymentIntentId) {
      const payment = await paymentProvider.retrieveIntent(existing.stripePaymentIntentId);
      return {
        checkoutId: existing.checkoutId,
        paymentIntentId: existing.stripePaymentIntentId,
        clientSecret: payment.clientSecret,
        amountCents: existing.amountCents,
        currency: existing.currency,
        pricing: existing.pricingSnapshot
      };
    }
    throw new ConflictError(
      "Checkout is already starting. Please retry in a moment.",
      "CHECKOUT_IN_PROGRESS"
    );
  }

  try {
    const reservations = await reserveForCheckout({
      checkoutId,
      lines: pricingResult.pricing.lines,
      expiresAt
    });

    intent.reservationIds = reservations.map((reservation) => reservation._id);
    intent.status = "awaiting_payment";
    await intent.save();

    const payment = await paymentProvider.createIntent({
      amountCents: pricingResult.pricing.totalCents,
      currency: config.currency,
      metadata: {
        userId: input.userId,
        checkoutId
      },
      idempotencyKey: `checkout:${checkoutId}`
    });

    intent.stripePaymentIntentId = payment.id;
    await intent.save();
    await Promise.all(
      reservations.map((reservation) => {
        reservation.paymentIntentId = payment.id;
        return reservation.save();
      })
    );

    return {
      checkoutId,
      paymentIntentId: payment.id,
      clientSecret: payment.clientSecret,
      amountCents: pricingResult.pricing.totalCents,
      currency: config.currency,
      pricing: pricingResult.pricing
    };
  } catch (error) {
    await releaseForCheckout(checkoutId).catch(() => undefined);
    await CheckoutIntent.updateOne(
      { _id: intent._id },
      { $set: { status: "failed", reservationIds: [] } }
    );
    if (error instanceof ConflictError || error instanceof ServiceUnavailableError) {
      throw error;
    }
    logger.error({ err: error, checkoutId }, "Could not start checkout");
    throw new ServiceUnavailableError(
      "Payment could not be started. No stock was held and no charge was made."
    );
  }
}

async function fulfillTransaction(
  intent: CheckoutIntentDocument,
  paymentIntentId: string
): Promise<Types.ObjectId[]> {
  return withTransaction(async (session) => {
    await confirmReservationsForCheckout(intent.checkoutId, paymentIntentId, session);

    const snapshot = intent.pricingSnapshot;
    const orderDocs = snapshot.stores.map((store) => {
      const orderItems = orderItemsFromSnapshot(snapshot, store.storeId);
      const subtotalCents = orderItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
      const discountCents = orderItems.reduce((sum, item) => sum + item.discountCents, 0);
      const totalCents = orderItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
      if (subtotalCents - discountCents !== totalCents) {
        throw new Error("ORDER_PRICING_MISMATCH");
      }
      return {
        customerId: intent.userId,
        storeId: new Types.ObjectId(store.storeId),
        checkoutId: intent.checkoutId,
        status: "pending" as const,
        paymentStatus: "paid" as const,
        stripePaymentIntentId: paymentIntentId,
        orderItems,
        subtotalCents,
        discountCents,
        totalCents,
        subtotal: fromCents(subtotalCents),
        discountTotal: fromCents(discountCents),
        total: fromCents(totalCents),
        couponCode: snapshot.coupon?.code ?? null,
        couponScope: snapshot.coupon?.scope ?? null,
        pricingVersion: snapshot.pricingVersion,
        paidAt: new Date()
      };
    });

    const created = await Order.create(orderDocs, { session, ordered: true });
    const orderIds = created.map((order) => order._id);

    if (snapshot.coupon) {
      const existing = await CouponRedemption.findOne({
        couponId: new Types.ObjectId(snapshot.coupon.id),
        checkoutId: intent.checkoutId
      }).session(session);
      if (!existing) {
        await CouponRedemption.create(
          [
            {
              couponId: new Types.ObjectId(snapshot.coupon.id),
              userId: intent.userId,
              checkoutId: intent.checkoutId,
              paymentIntentId,
              orderIds,
              discountCents: snapshot.discountCents
            }
          ],
          { session }
        );
        await Coupon.updateOne(
          { _id: new Types.ObjectId(snapshot.coupon.id) },
          { $inc: { redemptionCount: 1 } },
          { session }
        );
      }
    }

    await CartItem.deleteMany(
      { _id: { $in: intent.cartItemIds }, userId: intent.userId },
      { session }
    );
    await Cart.updateOne(
      { userId: intent.userId },
      { $set: { appliedCouponCode: null } },
      { session }
    );

    intent.status = "completed";
    intent.orderIds = orderIds;
    intent.stripePaymentIntentId = paymentIntentId;
    await intent.save({ session });

    return orderIds;
  });
}

export async function fulfillCheckout(input: {
  paymentIntentId: string;
  userId?: string;
}): Promise<{ orders: unknown[]; replayed: boolean }> {
  const intent = await CheckoutIntent.findOne({
    stripePaymentIntentId: input.paymentIntentId
  });
  if (!intent) throw new NotFoundError("Checkout not found for this payment");
  if (input.userId && intent.userId.toString() !== input.userId) {
    throw new ForbiddenError();
  }

  if (intent.orderIds.length > 0) {
    return { orders: await loadOrders(intent), replayed: true };
  }

  const payment = await getPaymentProvider().retrieveIntent(input.paymentIntentId);
  if (payment.status !== "succeeded") {
    throw new ConflictError(
      `Payment is not complete (status: ${payment.status})`,
      "PAYMENT_NOT_SUCCEEDED"
    );
  }
  if (payment.metadata.userId !== intent.userId.toString()) {
    throw new ConflictError("Payment does not belong to this customer", "PAYMENT_OWNER_MISMATCH");
  }
  if (payment.metadata.checkoutId !== intent.checkoutId) {
    throw new ConflictError("Payment checkout mismatch", "PAYMENT_CHECKOUT_MISMATCH");
  }
  if (payment.amount !== intent.amountCents || payment.currency.toLowerCase() !== intent.currency) {
    throw new ConflictError("Payment amount no longer matches the checkout", "PAYMENT_AMOUNT_MISMATCH");
  }

  try {
    const orderIds = await fulfillTransaction(intent, input.paymentIntentId);
    intent.orderIds = orderIds;
    const orders = await loadOrders(intent);
    await enqueueNotification(
      JOB_NAMES.ORDER_CREATED,
      {
        orderIds: orderIds.map((id) => id.toString()),
        customerId: intent.userId.toString()
      },
      `order-created:${orderIds.map((id) => id.toString()).sort().join("-")}`
    );
    return { orders, replayed: false };
  } catch (error) {
    if (error instanceof ConflictError && error.code === "RESERVATION_RELEASED") {
      await CheckoutIntent.updateOne(
        { _id: intent._id },
        { $set: { status: "needs_reconciliation" } }
      );
    }
    const duplicate = typeof error === "object" && error && "code" in error && error.code === 11000;
    if (duplicate) {
      const reloaded = await CheckoutIntent.findById(intent._id);
      if (reloaded && reloaded.orderIds.length > 0) {
        return { orders: await loadOrders(reloaded), replayed: true };
      }
    }
    throw error;
  }
}

export async function markPaymentFailed(paymentIntentId: string): Promise<void> {
  const intent = await CheckoutIntent.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!intent) return;
  if (intent.status === "completed") return;
  await releaseForCheckout(intent.checkoutId);
  intent.status = "failed";
  await intent.save();
}
