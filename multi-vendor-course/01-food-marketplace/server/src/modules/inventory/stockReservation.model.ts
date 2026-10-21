import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";
import { RESERVATION_STATUSES, type ReservationStatus } from "../../shared/types.js";

export interface IStockReservation {
  productId: Types.ObjectId;
  storeId: Types.ObjectId;
  quantity: number;
  status: ReservationStatus;
  checkoutId: string;
  paymentIntentId?: string | null;
  expiresAt: Date;
  confirmedAt?: Date | null;
  releasedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const stockReservationSchema = new Schema<IStockReservation>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: RESERVATION_STATUSES, default: "active" },
    checkoutId: { type: String, required: true },
    paymentIntentId: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    confirmedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

stockReservationSchema.index({ checkoutId: 1, productId: 1 }, { unique: true });
stockReservationSchema.index({ expiresAt: 1, status: 1 });
stockReservationSchema.index({ productId: 1, status: 1 });

export type StockReservationDocument = HydratedDocument<IStockReservation>;
export const StockReservation = mongoose.model<IStockReservation>(
  "StockReservation",
  stockReservationSchema
);
