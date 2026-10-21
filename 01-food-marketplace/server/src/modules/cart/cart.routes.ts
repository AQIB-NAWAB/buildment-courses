import { Router } from "express";
import { asyncHandler } from "../../shared/errors.js";
import { requireAuth, requireRole } from "../../shared/auth/middleware.js";
import { parseBody, routeParam } from "../../shared/validation.js";
import { couponRateLimit } from "./couponRateLimit.js";
import { addCartItemSchema, applyCouponSchema, updateCartItemSchema } from "./cart.schemas.js";
import {
  addCartItem,
  applyCoupon,
  getCart,
  removeCartItem,
  removeCoupon,
  updateCartItem
} from "./cart.service.js";

export const cartRouter = Router();

cartRouter.use(requireAuth, requireRole("customer"));

cartRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getCart(req.user!.id));
  })
);

cartRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(addCartItemSchema, req);
    const result = await addCartItem(req.user!.id, body);
    res.status(result.created ? 201 : 200).json({
      item: { id: result.item.id, quantity: result.item.quantity },
      cart: await getCart(req.user!.id)
    });
  })
);

// Static coupon routes must be declared before /:itemId.
cartRouter.post(
  "/coupon",
  couponRateLimit,
  asyncHandler(async (req, res) => {
    const body = parseBody(applyCouponSchema, req);
    res.json(await applyCoupon(req.user!.id, body.code));
  })
);

cartRouter.delete(
  "/coupon",
  asyncHandler(async (req, res) => {
    res.json(await removeCoupon(req.user!.id));
  })
);

cartRouter.patch(
  "/:itemId",
  asyncHandler(async (req, res) => {
    const body = parseBody(updateCartItemSchema, req);
    const item = await updateCartItem(req.user!.id, routeParam(req, "itemId"), body.quantity);
    res.json({ item: { id: item.id, quantity: item.quantity }, cart: await getCart(req.user!.id) });
  })
);

cartRouter.delete(
  "/:itemId",
  asyncHandler(async (req, res) => {
    await removeCartItem(req.user!.id, routeParam(req, "itemId"));
    res.status(204).send();
  })
);
