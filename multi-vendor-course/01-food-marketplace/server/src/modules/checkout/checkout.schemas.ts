import { z } from "zod";

export const startCheckoutSchema = z.object({
  checkoutId: z.string().trim().min(8).max(120).optional()
});

export const completeCheckoutSchema = z.object({
  paymentIntentId: z.string().trim().min(5).max(200)
});
