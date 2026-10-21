export const ROLES = ["vendor", "customer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const REGISTERABLE_ROLES = ["vendor", "customer"] as const;
export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

export const UNITS = ["each", "bunch", "kg", "g", "L", "ml", "pack"] as const;
export type Unit = (typeof UNITS)[number];

export const CATEGORIES = [
  "produce",
  "dairy",
  "bakery",
  "pantry",
  "frozen",
  "beverages",
  "household"
] as const;
export type Category = (typeof CATEGORIES)[number];

export const ORDER_STATUSES = ["pending", "packed", "dispatched", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RESERVATION_STATUSES = ["active", "confirmed", "released"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const CHECKOUT_STATUSES = [
  "created",
  "awaiting_payment",
  "paid",
  "completed",
  "failed",
  "expired",
  "needs_reconciliation"
] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

export const COUPON_SCOPES = ["platform", "store"] as const;
export type CouponScope = (typeof COUPON_SCOPES)[number];

export const COUPON_TYPES = ["percent", "fixed_cents"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export interface AuthUser {
  id: string;
  role: Role;
}
