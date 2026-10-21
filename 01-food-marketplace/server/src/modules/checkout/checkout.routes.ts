import { Router } from "express";
import { asyncHandler } from "../../shared/errors.js";
import { requireAuth, requireRole } from "../../shared/auth/middleware.js";
import { parseBody } from "../../shared/validation.js";
import { completeCheckoutSchema, startCheckoutSchema } from "./checkout.schemas.js";
import { fulfillCheckout, startCheckout } from "./checkout.service.js";

export const checkoutRouter = Router();
export const paymentsRouter = Router();

const customerGuard = [requireAuth, requireRole("customer")] as const;

const startHandler = asyncHandler(async (req, res) => {
  const body = parseBody(startCheckoutSchema, req);
  const result = await startCheckout({
    userId: req.user!.id,
    checkoutId: body.checkoutId
  });
  res.status(200).json(result);
});

checkoutRouter.post("/start", ...customerGuard, startHandler);
paymentsRouter.post("/intent", ...customerGuard, startHandler);

checkoutRouter.post(
  "/",
  ...customerGuard,
  asyncHandler(async (req, res) => {
    const body = parseBody(completeCheckoutSchema, req);
    const result = await fulfillCheckout({
      paymentIntentId: body.paymentIntentId,
      userId: req.user!.id
    });
    res.status(result.replayed ? 200 : 201).json(result);
  })
);
