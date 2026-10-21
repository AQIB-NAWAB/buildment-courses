import type { CouponScope, CouponType, Unit } from "../../shared/types.js";

export interface PricedLine {
  cartItemId: string;
  productId: string;
  storeId: string;
  name: string;
  unit: Unit;
  quantity: number;
  priceCents: number;
  lineSubtotalCents: number;
  discountCents: number;
  lineTotalCents: number;
  price: number;
  lineTotal: number;
}

export interface StorePricing {
  storeId: string;
  storeName: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  lines: PricedLine[];
}

export interface CouponSnapshot {
  id: string;
  code: string;
  scope: CouponScope;
  type: CouponType;
  value: number;
  storeId: string | null;
}

export interface PricingSnapshot {
  currency: string;
  pricingVersion: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  coupon: CouponSnapshot | null;
  lines: PricedLine[];
  stores: StorePricing[];
}

export interface CartValidationLine {
  cartItemId: string;
  productId: string;
  storeId: string;
  name: string;
  unit: Unit;
  quantity: number;
  priceCents: number;
  lineSubtotalCents: number;
  availableQty: number;
  isPublished: boolean;
  isActive: boolean;
  imageUrl?: string | null;
}
