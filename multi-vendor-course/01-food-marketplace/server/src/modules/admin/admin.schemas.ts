import { z } from "zod";
import { COUPON_SCOPES, COUPON_TYPES } from "../../shared/types.js";

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional()
});

export const activeSchema = z.object({
  isActive: z.coerce.boolean()
});

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(2).max(40),
    scope: z.enum(COUPON_SCOPES),
    storeId: z.string().optional(),
    type: z.enum(COUPON_TYPES),
    value: z.coerce.number().int().positive(),
    maxDiscountCents: z.coerce.number().int().min(0).optional(),
    minSubtotalCents: z.coerce.number().int().min(0).default(0),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    maxRedemptions: z.coerce.number().int().min(0).optional(),
    maxRedemptionsPerUser: z.coerce.number().int().min(1).default(1)
  })
  .superRefine((value, context) => {
    if (value.type === "percent" && value.value > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Percentage coupons cannot exceed 100"
      });
    }
    if (value.scope === "store" && !value.storeId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storeId"],
        message: "A store coupon requires a store"
      });
    }
    if (value.endsAt <= value.startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "The end date must be after the start date"
      });
    }
  });

export const updateCouponSchema = z
  .object({
    isActive: z.coerce.boolean().optional(),
    endsAt: z.coerce.date().optional(),
    maxRedemptions: z.coerce.number().int().min(0).nullable().optional(),
    maxRedemptionsPerUser: z.coerce.number().int().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });
