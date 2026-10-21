import { Router } from "express";
import { asyncHandler } from "../../shared/errors.js";
import { requireAuth, requireRole } from "../../shared/auth/middleware.js";
import { parseBody, parseQuery, routeParam } from "../../shared/validation.js";
import {
  activeSchema,
  createCouponSchema,
  pageQuerySchema,
  updateCouponSchema
} from "./admin.schemas.js";
import {
  adminMetrics,
  createCoupon,
  listAdminOrders,
  listAdminProducts,
  listAdminStores,
  listAdminUsers,
  listCoupons,
  setProductActive,
  setStoreActive,
  updateCoupon
} from "./admin.service.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get(
  "/metrics",
  asyncHandler(async (_req, res) => {
    res.json({ metrics: await adminMetrics() });
  })
);

adminRouter.get(
  "/stores",
  asyncHandler(async (req, res) => {
    res.json(await listAdminStores(parseQuery(pageQuerySchema, req)));
  })
);

adminRouter.patch(
  "/stores/:id/status",
  asyncHandler(async (req, res) => {
    const body = parseBody(activeSchema, req);
    const store = await setStoreActive(routeParam(req, "id"), body.isActive);
    res.json({ store: { id: store.id, isActive: store.isActive } });
  })
);

adminRouter.get(
  "/products",
  asyncHandler(async (req, res) => {
    res.json(await listAdminProducts(parseQuery(pageQuerySchema, req)));
  })
);

adminRouter.patch(
  "/products/:id/status",
  asyncHandler(async (req, res) => {
    const body = parseBody(activeSchema, req);
    const product = await setProductActive(routeParam(req, "id"), body.isActive);
    res.json({ product: { id: product.id, isActive: product.isActive } });
  })
);

adminRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    res.json(await listAdminOrders(parseQuery(pageQuerySchema, req)));
  })
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    res.json(await listAdminUsers(parseQuery(pageQuerySchema, req)));
  })
);

adminRouter.get(
  "/coupons",
  asyncHandler(async (_req, res) => {
    res.json({ coupons: await listCoupons() });
  })
);

adminRouter.post(
  "/coupons",
  asyncHandler(async (req, res) => {
    const body = parseBody(createCouponSchema, req);
    res.status(201).json({ coupon: await createCoupon(body) });
  })
);

adminRouter.patch(
  "/coupons/:id",
  asyncHandler(async (req, res) => {
    const body = parseBody(updateCouponSchema, req);
    res.json({ coupon: await updateCoupon(routeParam(req, "id"), body) });
  })
);
