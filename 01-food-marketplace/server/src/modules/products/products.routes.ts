import multer from "multer";
import { Router } from "express";
import { asyncHandler, BadRequestError } from "../../shared/errors.js";
import { requireAuth, requireRole } from "../../shared/auth/middleware.js";
import { parseBody, parseQuery, routeParam } from "../../shared/validation.js";
import { catalogueQuerySchema, createProductSchema, updateProductSchema } from "./products.schemas.js";
import {
  createProduct,
  deleteProduct,
  getPublicProduct,
  listPublicProducts,
  listVendorProducts,
  toVendorProduct,
  updateProduct,
  uploadProductImage
} from "./products.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new BadRequestError("Only JPEG, PNG, and WebP images are allowed"));
      return;
    }
    callback(null, true);
  }
});

export const productsRouter = Router();

productsRouter.get(
  "/products",
  asyncHandler(async (req, res) => {
    const query = parseQuery(catalogueQuerySchema, req);
    res.json(await listPublicProducts(query));
  })
);

productsRouter.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    res.json({ product: await getPublicProduct(routeParam(req, "id")) });
  })
);

productsRouter.get(
  "/vendor/products",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    res.json({ products: await listVendorProducts(req.user!.id) });
  })
);

productsRouter.post(
  "/products",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const body = parseBody(createProductSchema, req);
    const product = await createProduct(req.user!.id, body);
    res.status(201).json({ product: toVendorProduct(product as never) });
  })
);

productsRouter.patch(
  "/products/:id",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const body = parseBody(updateProductSchema, req);
    const product = await updateProduct(routeParam(req, "id"), req.user!.id, body);
    res.json({ product: toVendorProduct(product as never) });
  })
);

productsRouter.delete(
  "/products/:id",
  requireAuth,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    await deleteProduct(routeParam(req, "id"), req.user!.id);
    res.status(204).send();
  })
);

productsRouter.post(
  "/products/:id/image",
  requireAuth,
  requireRole("vendor"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError("Image file is required");
    const product = await uploadProductImage(routeParam(req, "id"), req.user!.id, req.file);
    res.json({ product: toVendorProduct(product as never), imageUrl: product.imageUrl });
  })
);
