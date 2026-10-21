import { z } from "zod";

export const addCartItemSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1_000).default(1)
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(1_000)
});

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1).max(40)
});
