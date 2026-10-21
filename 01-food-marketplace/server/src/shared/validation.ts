import type { Request } from "express";
import type { ZodTypeAny, z } from "zod";

export function parseBody<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return schema.parse(req.body);
}

export function parseQuery<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return schema.parse(req.query);
}

export function isValidObjectId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[a-fA-F0-9]{24}$/.test(value);
}

export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
