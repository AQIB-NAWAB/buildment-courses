import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";

export interface ICouponRedemption {
  couponId: Types.ObjectId;
  userId: Types.ObjectId;
  checkoutId: string;
  paymentIntentId: string;
  orderIds: Types.ObjectId[];
  discountCents: number;
  createdAt: Date;
  updatedAt: Date;
}

const couponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    checkoutId: { type: String, required: true },
    paymentIntentId: { type: String, required: true },
    orderIds: [{ type: Schema.Types.ObjectId, ref: "Order", required: true }],
    discountCents: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ couponId: 1, userId: 1 });
couponRedemptionSchema.index({ couponId: 1, checkoutId: 1 }, { unique: true });
couponRedemptionSchema.index({ paymentIntentId: 1 }, { unique: true });

export type CouponRedemptionDocument = HydratedDocument<ICouponRedemption>;
export const CouponRedemption = mongoose.model<ICouponRedemption>(
  "CouponRedemption",
  couponRedemptionSchema
);
