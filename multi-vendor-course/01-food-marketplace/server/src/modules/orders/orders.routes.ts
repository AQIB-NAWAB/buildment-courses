import { Router } from "express";
import { asyncHandler } from "../../shared/errors.js";
import { requireAuth, requireRole } from "../../shared/auth/middleware.js";
import { parseBody, routeParam } from "../../shared/validation.js";
import { updateOrderStatusSchema } from "./orders.schemas.js";
import {
  getOrderForUser,
  listCustomerOrders,
  listVendorOrders,
  updateVendorOrderStatus
} from "./orders.service.js";

export const ordersRouter = Router();
export const vendorOrdersRouter = Router();

ordersRouter.get(
  "/my",
  requireAuth,
  requireRole("customer"),
  asyncHandler(async (req, res) => {
    res.json({ orders: await listCustomerOrders(req.user!.id) });
  })
);

ordersRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ order: await getOrderForUser(req.user!.id, routeParam(req, "id")) });
  })
);

vendorOrdersRouter.get(
  "/",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    res.json({ orders: await listVendorOrders(req.user!.id) });
  })
);

vendorOrdersRouter.patch(
  "/:orderId/status",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const body = parseBody(updateOrderStatusSchema, req);
    const order = await updateVendorOrderStatus(req.user!.id, routeParam(req, "orderId"), body);
    res.json({ order });
  })
);
