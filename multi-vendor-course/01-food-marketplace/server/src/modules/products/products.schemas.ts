import { z } from "zod";
import { CATEGORIES, UNITS } from "../../shared/types.js";

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(2_000).optional(),
  price: z.coerce.number().positive().max(1_000_000),
  unit: z.enum(UNITS),
  weightOrQuantity: z.coerce.number().min(0).max(1_000_000).optional(),
  stockQty: z.coerce.number().min(0).max(1_000_000),
  isPerishable: z.coerce.boolean().default(false),
  category: z.enum(CATEGORIES),
  isPublished: z.coerce.boolean().default(false)
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(140).optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    price: z.coerce.number().positive().max(1_000_000).optional(),
    unit: z.enum(UNITS).optional(),
    weightOrQuantity: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
    stockQty: z.coerce.number().min(0).max(1_000_000).optional(),
    isPerishable: z.coerce.boolean().optional(),
    category: z.enum(CATEGORIES).optional(),
    isPublished: z.coerce.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });

export const catalogueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(CATEGORIES).optional(),
  storeId: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "name"]).default("newest")
});
