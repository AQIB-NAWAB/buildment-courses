import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";

export interface IProfile {
  userId: Types.ObjectId;
  displayName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, default: null, trim: true },
    avatarUrl: { type: String, default: null }
  },
  { timestamps: true }
);

profileSchema.index({ userId: 1 }, { unique: true });

export type ProfileDocument = HydratedDocument<IProfile>;
export const Profile = mongoose.model<IProfile>("Profile", profileSchema);
