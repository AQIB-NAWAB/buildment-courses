import { Types } from "mongoose";
import { config } from "../../shared/config.js";
import { BadRequestError } from "../../shared/errors.js";
import { fromCents, toCents } from "../../shared/money.js";
import { Cart } from "../cart/cart.model.js";
import { CartItem } from "../cart/cartItem.model.js";
import { Coupon, type ICoupon } from "../promotions/coupon.model.js";
import { CouponRedemption } from "../promotions/couponRedemption.model.js";
import { Store } from "../stores/store.model.js";
import type {
  CartValidationLine,
  CouponSnapshot,
  PricedLine,
  PricingSnapshot,
  StorePricing
} from "./types.js";

export interface EnrichedLine extends CartValidationLine {
  storeName: string;
  storeActive: boolean;
  productActive: boolean;
}

export interface CouponValidationSuccess {
  ok: true;
  coupon: ICoupon;
  eligibleLines: EnrichedLine[];
  eligibleSubtotalCents: number;
}

export interface CouponValidationFailure {
  ok: false;
  reason: string;
}

export type CouponValidation = CouponValidationSuccess | CouponValidationFailure;

export async function loadCartLines(userId: string): Promise<{
  cart: unknown;
  lines: EnrichedLine[];
  orphanCount: number;
}> {
  const objectId = new Types.ObjectId(userId);
  const [cart, records] = await Promise.all([
    Cart.findOne({ userId: objectId }),
    CartItem.find({ userId: objectId }).populate([
      { path: "productId" },
      { path: "storeId", select: "name isActive" }
    ])
  ]);

  const lines: EnrichedLine[] = [];
  let orphanCount = 0;

  for (const record of records) {
    const product = record.productId as unknown as
      | {
          _id: Types.ObjectId;
          name: string;
          price: number;
          unit: CartValidationLine["unit"];
          stockQty: number;
          reservedQty: number;
          isPublished: boolean;
          isActive: boolean;
          storeId: Types.ObjectId;
          imageUrl?: string | null;
        }
      | null;
    if (!product) {
      await CartItem.deleteOne({ _id: record._id, userId: objectId });
      orphanCount += 1;
      continue;
    }
    const store = record.storeId as unknown as
      | { _id: Types.ObjectId; name: string; isActive: boolean }
      | null;
    const priceCents = toCents(product.price);
    lines.push({
      cartItemId: record.id,
      productId: product._id.toString(),
      storeId: product.storeId.toString(),
      name: product.name,
      unit: product.unit,
      quantity: record.quantity,
      priceCents,
      lineSubtotalCents: priceCents * record.quantity,
      availableQty: Math.max(0, product.stockQty - (product.reservedQty ?? 0)),
      isPublished: product.isPublished,
      isActive: product.isActive,
      imageUrl: product.imageUrl ?? null,
      storeName: store?.name ?? "Unknown store",
      storeActive: store?.isActive ?? false,
      productActive: product.isActive
    });
  }

  return { cart, lines, orphanCount };
}

export function assertLinesPurchasable(lines: EnrichedLine[]): void {
  if (lines.length === 0) throw new BadRequestError("Cart is empty", "CART_EMPTY");
  for (const line of lines) {
    if (!line.isPublished || !line.isActive || !line.storeActive) {
      throw new BadRequestError(
        `${line.name} is no longer available`,
        "PRODUCT_UNAVAILABLE"
      );
    }
  }
}

function sameId(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

export async function validateCoupon(input: {
  code: string;
  lines: EnrichedLine[];
  userId: string;
  now?: Date;
}): Promise<CouponValidation> {
  const normalized = input.code.trim().toUpperCase();
  if (!normalized || normalized.length > 40) return { ok: false, reason: "INVALID_FORMAT" };

  const coupon = await Coupon.findOne({ code: normalized, isActive: true });
  if (!coupon) return { ok: false, reason: "NOT_FOUND" };

  const now = input.now ?? new Date();
  if (now < coupon.startsAt || now >= coupon.endsAt) return { ok: false, reason: "OUTSIDE_WINDOW" };

  const eligibleLines =
    coupon.scope === "store"
      ? input.lines.filter((line) => sameId(line.storeId, coupon.storeId))
      : input.lines;
  if (eligibleLines.length === 0) return { ok: false, reason: "SCOPE" };

  const eligibleSubtotalCents = eligibleLines.reduce(
    (sum, line) => sum + line.lineSubtotalCents,
    0
  );
  if (eligibleSubtotalCents < coupon.minSubtotalCents) {
    return { ok: false, reason: "MIN_SUBTOTAL" };
  }

  if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { ok: false, reason: "GLOBAL_CAP" };
  }

  if (coupon.maxRedemptionsPerUser != null) {
    const userUses = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      userId: new Types.ObjectId(input.userId)
    });
    if (userUses >= coupon.maxRedemptionsPerUser) return { ok: false, reason: "USER_CAP" };
  }

  return { ok: true, coupon, eligibleLines, eligibleSubtotalCents };
}

export function discountForCoupon(coupon: ICoupon, eligibleSubtotalCents: number): number {
  if (coupon.type === "fixed_cents") {
    return Math.min(coupon.value, eligibleSubtotalCents);
  }
  let discount = Math.floor((eligibleSubtotalCents * coupon.value) / 100);
  if (coupon.maxDiscountCents != null) {
    discount = Math.min(discount, coupon.maxDiscountCents);
  }
  return Math.max(0, Math.min(discount, eligibleSubtotalCents));
}

export function allocateDiscount(
  lines: PricedLine[],
  eligibleIds: Set<string>,
  discountTotalCents: number
): void {
  const eligible = lines.filter((line) => eligibleIds.has(line.cartItemId));
  if (eligible.length === 0 || discountTotalCents === 0) {
    for (const line of lines) line.discountCents = 0;
    return;
  }

  const eligibleSubtotalCents = eligible.reduce(
    (sum, line) => sum + line.lineSubtotalCents,
    0
  );

  for (const line of lines) {
    line.discountCents = eligibleIds.has(line.cartItemId)
      ? Math.floor((discountTotalCents * line.lineSubtotalCents) / eligibleSubtotalCents)
      : 0;
  }

  let remainder =
    discountTotalCents - lines.reduce((sum, line) => sum + line.discountCents, 0);

  const recipients = [...eligible].sort(
    (a, b) =>
      b.lineSubtotalCents - a.lineSubtotalCents ||
      a.productId.localeCompare(b.productId)
  );

  let index = 0;
  while (remainder > 0) {
    const recipient = recipients[index % recipients.length];
    if (!recipient) break;
    recipient.discountCents += 1;
    remainder -= 1;
    index += 1;
  }

  for (const line of lines) {
    line.lineTotalCents = Math.max(0, line.lineSubtotalCents - line.discountCents);
    line.lineTotal = fromCents(line.lineTotalCents);
    if (line.discountCents > line.lineSubtotalCents) {
      throw new Error("INVALID_DISCOUNT_ALLOCATION");
    }
  }

  const allocatedTotal = lines.reduce((sum, line) => sum + line.discountCents, 0);
  if (allocatedTotal !== discountTotalCents) {
    throw new Error("DISCOUNT_ALLOCATION_MISMATCH");
  }
}

function couponSnapshot(coupon: ICoupon): CouponSnapshot {
  return {
    id: coupon._id.toString(),
    code: coupon.code,
    scope: coupon.scope,
    type: coupon.type,
    value: coupon.value,
    storeId: coupon.storeId ? coupon.storeId.toString() : null
  };
}

export interface CartPricingResult {
  lines: EnrichedLine[];
  pricing: PricingSnapshot;
  couponError?: string;
  couponFailureReason?: string;
}

export async function computeCartPricing(input: {
  userId: string;
  code?: string | null;
  now?: Date;
}): Promise<CartPricingResult> {
  const { cart, lines } = await loadCartLines(input.userId);
  const cartRecord = cart as { appliedCouponCode?: string | null } | null;
  const requestedCode = input.code ?? cartRecord?.appliedCouponCode ?? null;

  if (lines.length === 0) {
    return {
      lines,
      pricing: {
        currency: config.currency,
        pricingVersion: 1,
        subtotalCents: 0,
        discountCents: 0,
        totalCents: 0,
        coupon: null,
        lines: [],
        stores: []
      }
    };
  }

  let coupon: ICoupon | null = null;
  let eligibleIds = new Set<string>();
  let discountCents = 0;
  let couponError: string | undefined;
  let couponFailureReason: string | undefined;

  if (requestedCode) {
    const validation = await validateCoupon({
      code: requestedCode,
      lines,
      userId: input.userId,
      now: input.now
    });
    if (validation.ok) {
      coupon = validation.coupon;
      eligibleIds = new Set(validation.eligibleLines.map((line) => line.cartItemId));
      discountCents = discountForCoupon(coupon, validation.eligibleSubtotalCents);
    } else {
      couponError = "This code isn't valid for your cart.";
      couponFailureReason = validation.reason;
    }
  }

  const pricedLines: PricedLine[] = lines.map((line) => ({
    cartItemId: line.cartItemId,
    productId: line.productId,
    storeId: line.storeId,
    name: line.name,
    unit: line.unit,
    quantity: line.quantity,
    priceCents: line.priceCents,
    lineSubtotalCents: line.lineSubtotalCents,
    discountCents: 0,
    lineTotalCents: line.lineSubtotalCents,
    price: fromCents(line.priceCents),
    lineTotal: fromCents(line.lineSubtotalCents)
  }));

  allocateDiscount(pricedLines, eligibleIds, discountCents);

  const subtotalCents = pricedLines.reduce((sum, line) => sum + line.lineSubtotalCents, 0);
  const totalCents = pricedLines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  if (subtotalCents - discountCents !== totalCents) {
    throw new Error("CART_PRICING_MISMATCH");
  }

  const storeMap = new Map<string, StorePricing>();
  for (const line of pricedLines) {
    const source = lines.find((candidate) => candidate.cartItemId === line.cartItemId);
    const storeId = line.storeId;
    const existing = storeMap.get(storeId) ?? {
      storeId,
      storeName: source?.storeName ?? "Store",
      subtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
      lines: []
    };
    existing.subtotalCents += line.lineSubtotalCents;
    existing.discountCents += line.discountCents;
    existing.totalCents += line.lineTotalCents;
    existing.lines.push(line);
    storeMap.set(storeId, existing);
  }

  return {
    lines,
    pricing: {
      currency: config.currency,
      pricingVersion: 1,
      subtotalCents,
      discountCents,
      totalCents,
      coupon: coupon ? couponSnapshot(coupon) : null,
      lines: pricedLines,
      stores: [...storeMap.values()]
    },
    ...(couponError ? { couponError } : {}),
    ...(couponFailureReason ? { couponFailureReason } : {})
  };
}

export function cartFingerprint(lines: EnrichedLine[], code: string | null): string {
  const normalized = lines
    .map((line) => `${line.productId}:${line.quantity}:${line.storeId}`)
    .sort()
    .join("|");
  return `${normalized}|coupon:${(code ?? "").trim().toUpperCase()}`;
}

export async function storeNamesFor(storeIds: string[]): Promise<Map<string, string>> {
  const stores = await Store.find({ _id: { $in: storeIds } }).select("name");
  return new Map(stores.map((store) => [store.id, store.name]));
}
