import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1_000).optional(),
  address: z.string().trim().max(300).optional(),
  logoUrl: z.string().url().max(500).optional()
});

export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(1_000).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    logoUrl: z.string().url().max(500).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No fields to update"
  });
