import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";

export interface ICartItem {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  storeId: Types.ObjectId;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger }
  },
  { timestamps: true }
);

cartItemSchema.index({ userId: 1 });
cartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

export type CartItemDocument = HydratedDocument<ICartItem>;
export const CartItem = mongoose.model<ICartItem>("CartItem", cartItemSchema);
