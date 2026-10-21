import mongoose, { type HydratedDocument, Schema } from "mongoose";
import { ROLES, type Role } from "../../shared/types.js";

export interface IUser {
  email: string;
  passwordHash: string;
  role: Role;
  isVerified: boolean;
  otpHash?: string | null;
  otpExpiresAt?: Date | null;
  refreshTokenHash?: string | null;
  refreshTokenExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"]
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    isVerified: { type: Boolean, default: false },
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    refreshTokenHash: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const safe = ret as Record<string, unknown>;
        delete safe.passwordHash;
        delete safe.otpHash;
        delete safe.otpExpiresAt;
        delete safe.refreshTokenHash;
        delete safe.refreshTokenExpiresAt;
        return ret;
      }
    }
  }
);

export type UserDocument = HydratedDocument<IUser>;
export const User = mongoose.model<IUser>("User", userSchema);
