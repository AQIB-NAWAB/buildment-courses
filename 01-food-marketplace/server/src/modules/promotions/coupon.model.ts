import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";
import { COUPON_SCOPES, COUPON_TYPES, type CouponScope, type CouponType } from "../../shared/types.js";

export interface ICoupon {
  _id: Types.ObjectId;
  code: string;
  scope: CouponScope;
  storeId?: Types.ObjectId | null;
  type: CouponType;
  value: number;
  maxDiscountCents?: number | null;
  minSubtotalCents: number;
  startsAt: Date;
  endsAt: Date;
  maxRedemptions?: number | null;
  maxRedemptionsPerUser: number;
  redemptionCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    scope: { type: String, enum: COUPON_SCOPES, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", default: null },
    type: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, required: true, min: 1 },
    maxDiscountCents: { type: Number, default: null, min: 0 },
    minSubtotalCents: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    maxRedemptions: { type: Number, default: null, min: 0 },
    maxRedemptionsPerUser: { type: Number, default: 1, min: 1 },
    redemptionCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

couponSchema.index({ storeId: 1, isActive: 1 });

couponSchema.pre("validate", function validateCouponShape(next) {
  if (this.scope === "store" && !this.storeId) {
    next(new Error("STORE_SCOPE_REQUIRES_STORE_ID"));
    return;
  }
  if (this.scope === "platform") this.storeId = null;
  if (this.type === "percent" && this.value > 100) {
    next(new Error("PERCENT_OUT_OF_RANGE"));
    return;
  }
  if (this.endsAt <= this.startsAt) {
    next(new Error("INVALID_COUPON_WINDOW"));
    return;
  }
  next();
});

export type CouponDocument = HydratedDocument<ICoupon>;
export const Coupon = mongoose.model<ICoupon>("Coupon", couponSchema);
