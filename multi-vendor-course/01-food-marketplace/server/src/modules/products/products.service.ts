import { Types, type FilterQuery } from "mongoose";
import { bumpCatalogueVersion, catalogueCacheKey, cacheTtlSeconds, getCache } from "../../shared/cache.js";
import { NotFoundError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { toCents } from "../../shared/money.js";
import { assertProductOwner } from "../../shared/ownership.js";
import { getVendorStore } from "../../shared/ownership.js";
import { getImageStorage } from "../../shared/adapters/imageStorage.js";
import { isValidObjectId } from "../../shared/validation.js";
import { Store } from "../stores/store.model.js";
import { Product, availableQty, type IProduct } from "./product.model.js";

type ProductLike = IProduct & { _id: Types.ObjectId; storeId: unknown };

export function toPublicProduct(product: ProductLike) {
  const store = product.storeId as unknown as {
    _id?: Types.ObjectId;
    name?: string;
    slug?: string;
  } | null;
  return {
    id: product._id.toString(),
    name: product.name,
    description: product.description ?? null,
    price: product.price,
    priceCents: toCents(product.price),
    unit: product.unit,
    weightOrQuantity: product.weightOrQuantity ?? null,
    stockQty: product.stockQty,
    reservedQty: product.reservedQty,
    availableQty: availableQty(product),
    isPerishable: product.isPerishable,
    category: product.category,
    imageUrl: product.imageUrl ?? null,
    store: store
      ? { id: store._id?.toString(), name: store.name, slug: store.slug }
      : null
  };
}

export function toVendorProduct(product: ProductLike) {
  return {
    id: product._id.toString(),
    name: product.name,
    description: product.description ?? null,
    price: product.price,
    priceCents: toCents(product.price),
    unit: product.unit,
    weightOrQuantity: product.weightOrQuantity ?? null,
    stockQty: product.stockQty,
    reservedQty: product.reservedQty,
    availableQty: availableQty(product),
    isPerishable: product.isPerishable,
    category: product.category,
    isPublished: product.isPublished,
    isActive: product.isActive,
    imageUrl: product.imageUrl ?? null,
    storeId: (product.storeId as unknown as Types.ObjectId).toString(),
    createdAt: (product as unknown as { createdAt?: Date }).createdAt
  };
}

export async function createProduct(userId: string, input: Record<string, unknown>) {
  const store = await getVendorStore(userId);
  if (!store) throw new NotFoundError("Open your shop before adding products");
  const product = await Product.create({
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    unit: input.unit,
    weightOrQuantity: input.weightOrQuantity ?? null,
    stockQty: input.stockQty,
    isPerishable: input.isPerishable ?? false,
    category: input.category,
    isPublished: input.isPublished ?? false,
    storeId: store._id
  });
  await bumpCatalogueVersion();
  return product;
}

export async function listVendorProducts(userId: string) {
  const store = await getVendorStore(userId);
  if (!store) throw new NotFoundError("Open your shop before adding products");
  const products = await Product.find({ storeId: store._id }).sort({ createdAt: -1 });
  return products.map((product) => toVendorProduct(product as unknown as ProductLike));
}

export async function updateProduct(
  productId: string,
  userId: string,
  input: Record<string, unknown>
) {
  const { product } = await assertProductOwner(productId, userId);
  const allowed = [
    "name",
    "description",
    "price",
    "unit",
    "weightOrQuantity",
    "stockQty",
    "isPerishable",
    "category",
    "isPublished"
  ] as const;
  for (const field of allowed) {
    if (field in input) {
      (product as unknown as Record<string, unknown>)[field] = input[field];
    }
  }
  await product.save();
  await bumpCatalogueVersion();
  return product;
}

export async function deleteProduct(productId: string, userId: string) {
  const { product } = await assertProductOwner(productId, userId);
  if (product.imagePublicId) {
    try {
      await getImageStorage().remove(product.imagePublicId);
    } catch (error) {
      logger.warn({ err: error, productId }, "Could not remove product image");
    }
  }
  await product.deleteOne();
  await bumpCatalogueVersion();
}

export async function uploadProductImage(
  productId: string,
  userId: string,
  file: Express.Multer.File
) {
  const { product } = await assertProductOwner(productId, userId);
  const previousPublicId = product.imagePublicId;
  const uploaded = await getImageStorage().upload(
    file.buffer,
    `${productId}-${Date.now()}`
  );
  product.imageUrl = uploaded.url;
  product.imagePublicId = uploaded.publicId;
  await product.save();
  if (previousPublicId) {
    await getImageStorage().remove(previousPublicId);
  }
  await bumpCatalogueVersion();
  return product;
}

export async function listPublicProducts(input: {
  page: number;
  limit: number;
  category?: string;
  storeId?: string;
  search?: string;
  sort: string;
}) {
  const key = await catalogueCacheKey(input);
  const cache = getCache();
  const cached = await cache.get<Record<string, unknown>>(key);
  if (cached) {
    logger.debug({ key }, "CACHE HIT");
    return cached;
  }
  logger.debug({ key }, "CACHE MISS");

  if (input.storeId && !isValidObjectId(input.storeId)) {
    const { BadRequestError } = await import("../../shared/errors.js");
    throw new BadRequestError("Invalid storeId");
  }

  let storeFilter: Types.ObjectId | { $in: Types.ObjectId[] };
  if (input.storeId) {
    const store = await Store.findOne({ _id: input.storeId, isActive: true }).select("_id");
    if (!store) {
      const empty = {
        items: [],
        page: input.page,
        limit: input.limit,
        total: 0,
        totalPages: 0,
        source: "mongo"
      };
      await cache.set(key, empty, cacheTtlSeconds);
      return empty;
    }
    storeFilter = store._id;
  } else {
    const activeStores = await Store.find({ isActive: true }).select("_id");
    storeFilter = { $in: activeStores.map((store) => store._id) };
  }

  const filter: FilterQuery<IProduct> = {
    isPublished: true,
    isActive: true,
    storeId: storeFilter,
    $expr: {
      $gt: [
        { $subtract: ["$stockQty", { $ifNull: ["$reservedQty", 0] }] },
        0
      ]
    }
  };

  if (input.category) filter.category = input.category as IProduct["category"];
  if (input.search) filter.$text = { $search: input.search };

  const sort =
    input.search && input.sort === "newest"
      ? { score: { $meta: "textScore" } }
      : input.sort === "price_asc"
        ? { price: 1 as const }
        : input.sort === "price_desc"
          ? { price: -1 as const }
          : input.sort === "name"
            ? { name: 1 as const }
            : { createdAt: -1 as const };

  const projection = input.search ? { score: { $meta: "textScore" } } : {};
  const skip = (input.page - 1) * input.limit;

  const [items, total] = await Promise.all([
    Product.find(filter, projection)
      .populate({ path: "storeId", select: "name slug isActive" })
      .sort(sort as any)
      .skip(skip)
      .limit(input.limit),
    Product.countDocuments(filter)
  ]);

  const payload = {
    items: items
      .filter((item) => {
        const store = item.storeId as unknown as { isActive?: boolean } | null;
        return store?.isActive !== false;
      })
      .map((item) => toPublicProduct(item as unknown as ProductLike)),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit) || 0,
    source: "mongo"
  };

  await cache.set(key, payload, cacheTtlSeconds);
  return payload;
}

export async function getPublicProduct(id: string) {
  if (!isValidObjectId(id)) throw new NotFoundError("Product not found");
  const product = await Product.findOne({
    _id: id,
    isPublished: true,
    isActive: true,
    $expr: {
      $gt: [{ $subtract: ["$stockQty", { $ifNull: ["$reservedQty", 0] }] }, 0]
    }
  }).populate({ path: "storeId", select: "name slug isActive" });

  if (!product) throw new NotFoundError("Product not found");
  const store = product.storeId as unknown as { isActive?: boolean } | null;
  if (store?.isActive === false) throw new NotFoundError("Product not found");
  return toPublicProduct(product as unknown as ProductLike);
}
