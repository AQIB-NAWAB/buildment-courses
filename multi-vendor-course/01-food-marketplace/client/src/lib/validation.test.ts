import { describe, expect, it } from "vitest";
import { couponSchema, loginSchema, productSchema, registerSchema } from "./validation";

describe("form validation", () => {
  it("rejects invalid login credentials", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "" }).success).toBe(false);
    expect(
      loginSchema.safeParse({ email: "shopper@example.com", password: "Password123!" }).success
    ).toBe(true);
  });

  it("only allows customer or vendor registration", () => {
    expect(
      registerSchema.safeParse({
        displayName: "Shopper",
        email: "shopper@example.com",
        password: "Password123!",
        role: "admin"
      }).success
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        displayName: "Shopper",
        email: "shopper@example.com",
        password: "Password123!",
        role: "customer"
      }).success
    ).toBe(true);
  });

  it("rejects non-positive grocery prices", () => {
    const base = {
      name: "Rice",
      description: "",
      unit: "pack" as const,
      stockQty: 2,
      isPerishable: false,
      category: "pantry" as const,
      isPublished: true
    };
    expect(productSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, price: 120 }).success).toBe(true);
  });

  it("requires a coupon window", () => {
    const result = couponSchema.safeParse({
      code: "FRESH10",
      scope: "platform",
      type: "percent",
      value: 10,
      minSubtotalCents: 0,
      startsAt: "",
      endsAt: ""
    });
    expect(result.success).toBe(false);
  });
});
