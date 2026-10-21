import express, { Router } from "express";
import { asyncHandler, BadRequestError } from "../../shared/errors.js";
import { getPaymentProvider } from "../../shared/adapters/payment.js";
import { handleStripeEvent } from "./webhooks.service.js";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/stripe",
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      throw new BadRequestError("Missing Stripe signature");
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    if (rawBody.length === 0) {
      throw new BadRequestError("Missing raw webhook body");
    }
    const event = getPaymentProvider().constructWebhookEvent(rawBody, signature);
    await handleStripeEvent(event);
    res.json({ received: true });
  })
);
