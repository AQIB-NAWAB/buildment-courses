import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";

export interface ICart {
  userId: Types.ObjectId;
  appliedCouponCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    appliedCouponCode: { type: String, default: null, uppercase: true, trim: true }
  },
  { timestamps: true }
);

cartSchema.index({ userId: 1 }, { unique: true });

export type CartDocument = HydratedDocument<ICart>;
export const Cart = mongoose.model<ICart>("Cart", cartSchema);
