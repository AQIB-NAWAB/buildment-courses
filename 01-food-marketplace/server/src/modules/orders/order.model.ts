import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  UNITS,
  type CouponScope,
  type OrderStatus,
  type PaymentStatus,
  type Unit
} from "../../shared/types.js";

export interface IOrderItem {
  productId: Types.ObjectId;
  nameAtPurchase: string;
  unitAtPurchase: Unit;
  quantity: number;
  priceAtPurchase: number;
  priceAtPurchaseCents: number;
  lineSubtotalCents: number;
  discountCents: number;
  lineTotalCents: number;
  lineTotal: number;
}

export interface IOrder {
  customerId: Types.ObjectId;
  storeId: Types.ObjectId;
  checkoutId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  stripePaymentIntentId: string;
  orderItems: IOrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  subtotal: number;
  discountTotal: number;
  total: number;
  couponCode?: string | null;
  couponScope?: CouponScope | null;
  pricingVersion: number;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    nameAtPurchase: { type: String, required: true },
    unitAtPurchase: { type: String, enum: UNITS, required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtPurchase: { type: Number, required: true, min: 0 },
    priceAtPurchaseCents: { type: Number, required: true, min: 0 },
    lineSubtotalCents: { type: Number, required: true, min: 0 },
    discountCents: { type: Number, required: true, min: 0, default: 0 },
    lineTotalCents: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    checkoutId: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true },
    stripePaymentIntentId: { type: String, required: true },
    orderItems: { type: [orderItemSchema], required: true },
    subtotalCents: { type: Number, required: true, min: 0 },
    discountCents: { type: Number, required: true, min: 0, default: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    couponCode: { type: String, default: null },
    couponScope: { type: String, enum: ["platform", "store"], default: null },
    pricingVersion: { type: Number, required: true, default: 1 },
    paidAt: { type: Date, default: null }
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ stripePaymentIntentId: 1, storeId: 1 }, { unique: true });
orderSchema.index({ checkoutId: 1 });

export type OrderDocument = HydratedDocument<IOrder>;
export const Order = mongoose.model<IOrder>("Order", orderSchema);
