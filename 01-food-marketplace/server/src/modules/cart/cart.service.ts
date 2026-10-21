import crypto from "node:crypto";
import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { isValidObjectId } from "../../shared/validation.js";
import { Product, availableQty } from "../products/product.model.js";
import { Store } from "../stores/store.model.js";
import { computeCartPricing, loadCartLines } from "../pricing/pricing.service.js";
import type { EnrichedLine } from "../pricing/pricing.service.js";
import { Cart } from "./cart.model.js";
import { CartItem } from "./cartItem.model.js";

function toCartItemDto(line: EnrichedLine) {
  return {
    id: line.cartItemId,
    quantity: line.quantity,
    storeId: line.storeId,
    store: { id: line.storeId, name: line.storeName },
    product: {
      id: line.productId,
      name: line.name,
      priceCents: line.priceCents,
      price: line.priceCents / 100,
      unit: line.unit,
      imageUrl: line.imageUrl ?? null,
      availableQty: line.availableQty
    },
    lineSubtotalCents: line.lineSubtotalCents,
    lineSubtotal: line.lineSubtotalCents / 100,
    discountCents: 0,
    lineTotalCents: line.lineSubtotalCents,
    lineTotal: line.lineSubtotalCents / 100
  };
}

export async function getCart(userId: string) {
  const { lines, pricing, couponError } = await computeCartPricing({ userId });
  const pricedById = new Map(pricing.lines.map((line) => [line.cartItemId, line]));
  return {
    items: lines.map((line) => {
      const priced = pricedById.get(line.cartItemId);
      return {
        ...toCartItemDto(line),
        discountCents: priced?.discountCents ?? 0,
        lineTotalCents: priced?.lineTotalCents ?? line.lineSubtotalCents,
        lineTotal: (priced?.lineTotalCents ?? line.lineSubtotalCents) / 100,
        available: line.availableQty >= line.quantity && line.isPublished && line.isActive && line.storeActive
      };
    }),
    pricing,
    ...(couponError ? { couponError } : {})
  };
}

export async function addCartItem(
  userId: string,
  input: { productId: string; storeId: string; quantity: number }
) {
  if (!isValidObjectId(input.productId) || !isValidObjectId(input.storeId)) {
    throw new BadRequestError("Invalid product or store");
  }
  const product = await Product.findById(input.productId);
  if (!product) throw new NotFoundError("Product not found");
  if (!product.isPublished || !product.isActive) {
    throw new BadRequestError("Product is not available");
  }
  if (product.storeId.toString() !== input.storeId) {
    throw new BadRequestError("Store does not match product");
  }
  const store = await Store.findById(product.storeId);
  if (!store?.isActive) throw new BadRequestError("Store is not available");

  const existing = await CartItem.findOne({
    userId: new Types.ObjectId(userId),
    productId: product._id
  });
  const desired = (existing?.quantity ?? 0) + input.quantity;
  const available = availableQty(product);
  if (desired > available) {
    throw new BadRequestError(
      available === 0 ? "Out of stock" : "Insufficient stock",
      "INSUFFICIENT_STOCK",
      { available }
    );
  }

  await Cart.updateOne(
    { userId: new Types.ObjectId(userId) },
    { $setOnInsert: { userId: new Types.ObjectId(userId) } },
    { upsert: true }
  );

  if (existing) {
    existing.quantity = desired;
    await existing.save();
    return { item: existing, created: false };
  }

  const item = await CartItem.create({
    userId: new Types.ObjectId(userId),
    productId: product._id,
    storeId: product.storeId,
    quantity: input.quantity
  });
  return { item, created: true };
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  if (!isValidObjectId(itemId)) throw new NotFoundError("Cart item not found");
  const item = await CartItem.findOne({
    _id: itemId,
    userId: new Types.ObjectId(userId)
  });
  if (!item) throw new NotFoundError("Cart item not found");
  const product = await Product.findById(item.productId);
  if (!product) throw new NotFoundError("Product not found");
  if (quantity > availableQty(product)) {
    throw new BadRequestError("Insufficient stock", "INSUFFICIENT_STOCK", {
      available: availableQty(product)
    });
  }
  item.quantity = quantity;
  await item.save();
  return item;
}

export async function removeCartItem(userId: string, itemId: string): Promise<void> {
  if (!isValidObjectId(itemId)) throw new NotFoundError("Cart item not found");
  const deleted = await CartItem.findOneAndDelete({
    _id: itemId,
    userId: new Types.ObjectId(userId)
  });
  if (!deleted) throw new NotFoundError("Cart item not found");
}

export async function applyCoupon(userId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  await Cart.updateOne(
    { userId: new Types.ObjectId(userId) },
    {
      $setOnInsert: { userId: new Types.ObjectId(userId) },
      $set: { appliedCouponCode: normalized }
    },
    { upsert: true }
  );
  const pricing = await computeCartPricing({ userId });
  if (pricing.couponError) {
    logger.warn(
      {
        userId,
        reason: pricing.couponFailureReason,
        couponFingerprint: crypto
          .createHash("sha256")
          .update(normalized)
          .digest("hex")
          .slice(0, 12)
      },
      "coupon_rejected"
    );
    await Cart.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { appliedCouponCode: null } }
    );
    throw new BadRequestError("This code isn't valid for your cart.", "INVALID_COUPON");
  }
  return getCart(userId);
}

export async function removeCoupon(userId: string) {
  await Cart.updateOne(
    { userId: new Types.ObjectId(userId) },
    { $set: { appliedCouponCode: null } }
  );
  return getCart(userId);
}

export async function cartLineCount(userId: string): Promise<number> {
  const { lines } = await loadCartLines(userId);
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
