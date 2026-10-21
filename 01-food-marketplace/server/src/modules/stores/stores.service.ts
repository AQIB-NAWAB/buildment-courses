import { Types } from "mongoose";
import { bumpCatalogueVersion } from "../../shared/cache.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { assertStoreOwner } from "../../shared/ownership.js";
import { uniqueStoreSlug } from "../../shared/slug.js";
import { isValidObjectId } from "../../shared/validation.js";
import { Store } from "./store.model.js";

export async function createStore(
  userId: string,
  input: { name: string; description?: string; address?: string; logoUrl?: string }
) {
  const existing = await Store.findOne({ userId: new Types.ObjectId(userId) });
  if (existing) throw new ConflictError("You already have a store", "STORE_EXISTS");

  const slug = await uniqueStoreSlug(input.name);
  try {
    return await Store.create({
      name: input.name,
      slug,
      description: input.description ?? null,
      address: input.address ?? null,
      logoUrl: input.logoUrl ?? null,
      userId: new Types.ObjectId(userId)
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      throw new ConflictError("You already have a store", "STORE_EXISTS");
    }
    throw error;
  }
}

export function toStoreDto(store: {
  id?: string;
  _id?: unknown;
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
}) {
  return {
    id: store.id ?? String(store._id),
    name: store.name,
    slug: store.slug,
    description: store.description ?? null,
    address: store.address ?? null,
    logoUrl: store.logoUrl ?? null,
    isActive: store.isActive ?? true
  };
}

export async function listPublicStores() {
  const stores = await Store.find({ isActive: true })
    .select("name slug description address logoUrl isActive")
    .sort({ name: 1 });
  return stores.map((store) => toStoreDto(store));
}

export async function getPublicStore(id: string) {
  if (!isValidObjectId(id)) throw new NotFoundError("Store not found");
  const store = await Store.findOne({ _id: id, isActive: true }).select(
    "name slug description address logoUrl isActive"
  );
  if (!store) throw new NotFoundError("Store not found");
  return toStoreDto(store);
}

export async function updateStore(
  storeId: string,
  userId: string,
  input: Record<string, unknown>
) {
  const store = await assertStoreOwner(storeId, userId);
  const allowed = ["name", "description", "address", "logoUrl"] as const;
  for (const field of allowed) {
    if (field in input) {
      (store as unknown as Record<string, unknown>)[field] = input[field];
    }
  }
  await store.save();
  await bumpCatalogueVersion();
  return store;
}
