import { Router } from "express";
import { asyncHandler, NotFoundError } from "../../shared/errors.js";
import { requireAuth, requireRole } from "../../shared/auth/middleware.js";
import { getVendorStore } from "../../shared/ownership.js";
import { parseBody, routeParam } from "../../shared/validation.js";
import { createStoreSchema, updateStoreSchema } from "./stores.schemas.js";
import {
  createStore,
  getPublicStore,
  listPublicStores,
  toStoreDto,
  updateStore
} from "./stores.service.js";

export const storesRouter = Router();

storesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ stores: await listPublicStores() });
  })
);

storesRouter.get(
  "/me",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const store = await getVendorStore(req.user!.id);
    if (!store) throw new NotFoundError("Store not found");
    res.json({ store: toStoreDto(store) });
  })
);

storesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ store: await getPublicStore(routeParam(req, "id")) });
  })
);

storesRouter.post(
  "/",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const body = parseBody(createStoreSchema, req);
    const store = await createStore(req.user!.id, body);
    res.status(201).json({ store: toStoreDto(store) });
  })
);

storesRouter.patch(
  "/:id",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const body = parseBody(updateStoreSchema, req);
    const store = await updateStore(routeParam(req, "id"), req.user!.id, body);
    res.json({ store: toStoreDto(store) });
  })
);
