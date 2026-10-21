import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";
import { CATEGORIES, UNITS, type Category, type Unit } from "../../shared/types.js";

export interface IProduct {
  name: string;
  description?: string | null;
  price: number;
  unit: Unit;
  weightOrQuantity?: number | null;
  stockQty: number;
  reservedQty: number;
  isPerishable: boolean;
  category: Category;
  isPublished: boolean;
  isActive: boolean;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  storeId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: null, maxlength: 2_000 },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UNITS, required: true },
    weightOrQuantity: { type: Number, default: null, min: 0 },
    stockQty: { type: Number, default: 0, min: 0 },
    reservedQty: { type: Number, default: 0, min: 0 },
    isPerishable: { type: Boolean, default: false },
    category: { type: String, enum: CATEGORIES, required: true },
    isPublished: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true }
  },
  { timestamps: true }
);

productSchema.index({ storeId: 1 });
productSchema.index({ storeId: 1, isPublished: 1 });
productSchema.index({ isPublished: 1, isActive: 1, category: 1, storeId: 1 });
productSchema.index(
  { name: "text", category: "text" },
  { name: "product_text_search", weights: { name: 10, category: 4 } }
);

export type ProductDocument = HydratedDocument<IProduct>;
export const Product = mongoose.model<IProduct>("Product", productSchema);

export function availableQty(product: Pick<IProduct, "stockQty" | "reservedQty">): number {
  return Math.max(0, (product.stockQty ?? 0) - (product.reservedQty ?? 0));
}
