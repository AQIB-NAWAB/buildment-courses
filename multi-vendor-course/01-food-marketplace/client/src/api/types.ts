export type Role = "vendor" | "customer" | "admin";

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

export interface User {
  id: string;
  email: string;
  role: Role;
  isVerified: boolean;
  displayName: string;
}

export interface Store {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
  owner?: { email: string; displayName: string };
  productCount?: number;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  priceCents: number;
  unit: Unit;
  weightOrQuantity?: number | null;
  stockQty: number;
  reservedQty?: number;
  availableQty: number;
  isPerishable: boolean;
  category: Category;
  imageUrl?: string | null;
  store: { id: string; name: string; slug?: string } | null;
}

export interface VendorProduct extends Omit<Product, "store"> {
  isPublished: boolean;
  isActive: boolean;
  storeId: string;
  createdAt?: string;
}

export interface ProductList {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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
}

export interface CouponSnapshot {
  id: string;
  code: string;
  scope: "platform" | "store";
  type: "percent" | "fixed_cents";
  value: number;
  storeId: string | null;
}

export interface Pricing {
  currency: string;
  pricingVersion: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  coupon: CouponSnapshot | null;
  lines: PricedLine[];
  stores: {
    storeId: string;
    storeName: string;
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    lines: PricedLine[];
  }[];
}

export interface CartItem {
  id: string;
  quantity: number;
  storeId: string;
  store: { id: string; name: string };
  product: {
    id: string;
    name: string;
    priceCents: number;
    price: number;
    unit: Unit;
    imageUrl?: string | null;
    availableQty: number;
  };
  lineSubtotalCents: number;
  discountCents: number;
  lineTotalCents: number;
  available: boolean;
}

export interface CartResponse {
  items: CartItem[];
  pricing: Pricing;
  couponError?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  unit: Unit;
  quantity: number;
  priceAtPurchase: number;
  priceAtPurchaseCents: number;
  lineSubtotalCents: number;
  discountCents: number;
  lineTotalCents: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  checkoutId: string;
  status: "pending" | "packed" | "dispatched" | "cancelled";
  paymentStatus: "pending" | "paid" | "failed";
  stripePaymentIntentId: string;
  store: { id: string; name: string; slug?: string } | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  subtotal: number;
  discountTotal: number;
  total: number;
  couponCode?: string | null;
  couponScope?: string | null;
  pricingVersion: number;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  customer?: { displayName: string; email: string };
  itemCount?: number;
}

export interface CheckoutStart {
  checkoutId: string;
  paymentIntentId: string;
  clientSecret: string | null;
  amountCents: number;
  currency: string;
  pricing: Pricing;
}

export interface AdminMetrics {
  users: number;
  vendors: number;
  customers: number;
  stores: number;
  activeStores: number;
  products: number;
  orders: number;
  pendingOrders: number;
  gmvCents: number;
  gmv: number;
  lowStock: number;
  reconciliation: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminCoupon {
  id: string;
  code: string;
  scope: "platform" | "store";
  storeId: string | null;
  type: "percent" | "fixed_cents";
  value: number;
  maxDiscountCents: number | null;
  minSubtotalCents: number;
  startsAt: string;
  endsAt: string;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  redemptionCount: number;
  isActive: boolean;
}
