import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";

export interface IStore {
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  logoPublicId?: string | null;
  userId: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<IStore>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: null, maxlength: 1_000 },
    address: { type: String, default: null, maxlength: 300 },
    logoUrl: { type: String, default: null },
    logoPublicId: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

storeSchema.index({ userId: 1 }, { unique: true });
storeSchema.index({ slug: 1 }, { unique: true });

export type StoreDocument = HydratedDocument<IStore>;
export const Store = mongoose.model<IStore>("Store", storeSchema);
