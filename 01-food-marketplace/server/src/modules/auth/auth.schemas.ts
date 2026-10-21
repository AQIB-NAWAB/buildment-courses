import { z } from "zod";
import { REGISTERABLE_ROLES } from "../../shared/types.js";

export const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(REGISTERABLE_ROLES),
  displayName: z.string().trim().min(1).max(80).optional()
});

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200)
});

export const verifyOtpSchema = z.object({
  email: z.string().email().max(200),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional()
});
