import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";
import type { AuthUser, Role } from "../types.js";

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ role }, config.jwtAccessSecret, {
    subject: userId,
    expiresIn: config.accessTokenTtl as SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, config.jwtAccessSecret);
  if (typeof payload === "string" || !payload.sub || !payload.role) {
    throw new Error("Invalid token payload");
  }
  return { id: payload.sub, role: payload.role as Role };
}

export function generateOpaqueToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return crypto
    .createHmac("sha256", config.jwtRefreshSecret)
    .update(token)
    .digest("hex");
}

export function hashOtp(otp: string): string {
  return crypto
    .createHmac("sha256", `${config.jwtRefreshSecret}:otp`)
    .update(otp)
    .digest("hex");
}

export function safeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function otpExpiry(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60_000);
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60_000);
}
