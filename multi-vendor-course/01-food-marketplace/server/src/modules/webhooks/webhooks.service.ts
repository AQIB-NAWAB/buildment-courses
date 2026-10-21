import type Stripe from "stripe";
import { logger } from "../../shared/logger.js";
import { CheckoutIntent } from "../checkout/checkoutIntent.model.js";
import { fulfillCheckout, markPaymentFailed } from "../checkout/checkout.service.js";
import { StripeEvent } from "./stripeEvent.model.js";

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const existing = await StripeEvent.findOne({ eventId: event.id });
  if (existing) return;

  const record = await StripeEvent.create({
    eventId: event.id,
    type: event.type,
    summary: { livemode: event.livemode }
  });

  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      record.paymentIntentId = intent.id;
      record.checkoutId = intent.metadata.checkoutId ?? null;
      await record.save();

      try {
        await fulfillCheckout({ paymentIntentId: intent.id });
        logger.info({ paymentIntentId: intent.id }, "Webhook fulfilled checkout");
      } catch (error) {
        const checkout = await CheckoutIntent.findOne({
          stripePaymentIntentId: intent.id
        });
        if (checkout) {
          checkout.status = "needs_reconciliation";
          await checkout.save();
        }
        logger.error(
          { err: error, paymentIntentId: intent.id, checkoutId: checkout?.checkoutId },
          "Paid checkout needs reconciliation"
        );
        record.summary = {
          ...(record.summary ?? {}),
          reconciliation: error instanceof Error ? error.message : "unknown"
        };
      }
    } else if (
      event.type === "payment_intent.payment_failed" ||
      event.type === "payment_intent.canceled"
    ) {
      const intent = event.data.object as Stripe.PaymentIntent;
      record.paymentIntentId = intent.id;
      record.checkoutId = intent.metadata.checkoutId ?? null;
      await markPaymentFailed(intent.id);
    }

    record.processedAt = new Date();
    await record.save();
  } catch (error) {
    record.summary = {
      ...(record.summary ?? {}),
      error: error instanceof Error ? error.message : "unknown"
    };
    await record.save();
    throw error;
  }
}
