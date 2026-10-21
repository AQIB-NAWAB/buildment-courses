import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";
import { CHECKOUT_STATUSES, type CheckoutStatus } from "../../shared/types.js";
import type { PricingSnapshot } from "../pricing/types.js";

export interface ICheckoutIntent {
  checkoutId: string;
  userId: Types.ObjectId;
  stripePaymentIntentId?: string | null;
  currency: string;
  amountCents: number;
  cartFingerprint: string;
  pricingSnapshot: PricingSnapshot;
  cartItemIds: Types.ObjectId[];
  reservationIds: Types.ObjectId[];
  status: CheckoutStatus;
  orderIds: Types.ObjectId[];
  stripeEventIds: string[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const checkoutIntentSchema = new Schema<ICheckoutIntent>(
  {
    checkoutId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    stripePaymentIntentId: { type: String, default: null },
    currency: { type: String, required: true },
    amountCents: { type: Number, required: true, min: 0 },
    cartFingerprint: { type: String, required: true },
    pricingSnapshot: { type: Schema.Types.Mixed, required: true },
    cartItemIds: [{ type: Schema.Types.ObjectId, ref: "CartItem" }],
    reservationIds: [{ type: Schema.Types.ObjectId, ref: "StockReservation" }],
    status: { type: String, enum: CHECKOUT_STATUSES, default: "created" },
    orderIds: [{ type: Schema.Types.ObjectId, ref: "Order" }],
    stripeEventIds: [{ type: String }],
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

checkoutIntentSchema.index({ checkoutId: 1 }, { unique: true });
checkoutIntentSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, partialFilterExpression: { stripePaymentIntentId: { $type: "string" } } }
);
checkoutIntentSchema.index({ userId: 1, createdAt: -1 });
checkoutIntentSchema.index({ status: 1, expiresAt: 1 });

export type CheckoutIntentDocument = HydratedDocument<ICheckoutIntent>;
export const CheckoutIntent = mongoose.model<ICheckoutIntent>(
  "CheckoutIntent",
  checkoutIntentSchema
);
