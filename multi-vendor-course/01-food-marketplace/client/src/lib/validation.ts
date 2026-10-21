import { z } from "zod";
import { CATEGORIES, UNITS } from "../api/types";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password")
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  role: z.enum(["customer", "vendor"])
});

export const verifyOtpSchema = z.object({
  email: z.string().email("Enter the email you registered with"),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code")
});

export const storeSchema = z.object({
  name: z.string().trim().min(2, "Enter a shop name").max(80),
  description: z.string().trim().max(1_000).optional(),
  address: z.string().trim().max(300).optional(),
  logoUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional()
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(140),
  description: z.string().trim().max(2_000).optional(),
  price: z.number().positive("Price must be greater than zero"),
  unit: z.enum(UNITS),
  weightOrQuantity: z.number().min(0).optional(),
  stockQty: z.number().min(0, "Stock cannot be negative"),
  isPerishable: z.boolean(),
  category: z.enum(CATEGORIES),
  isPublished: z.boolean()
});

export const couponSchema = z.object({
  code: z.string().trim().min(2).max(40),
  scope: z.enum(["platform", "store"]),
  storeId: z.string().optional(),
  type: z.enum(["percent", "fixed_cents"]),
  value: z.coerce.number().int().positive(),
  minSubtotalCents: z.coerce.number().int().min(0),
  maxDiscountCents: z.coerce.number().int().min(0).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1)
});
