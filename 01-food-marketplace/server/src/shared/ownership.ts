import { Types } from "mongoose";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { isValidObjectId } from "./validation.js";
import { Product } from "../modules/products/product.model.js";
import { Store } from "../modules/stores/store.model.js";

export async function getVendorStore(userId: string) {
  return Store.findOne({ userId: new Types.ObjectId(userId) });
}

export async function assertStoreOwner(storeId: string, userId: string) {
  if (!isValidObjectId(storeId)) throw new NotFoundError("Store not found");
  const store = await Store.findById(storeId);
  if (!store) throw new NotFoundError("Store not found");
  if (store.userId.toString() !== userId) throw new ForbiddenError();
  return store;
}

export async function assertProductOwner(productId: string, userId: string) {
  if (!isValidObjectId(productId)) throw new NotFoundError("Product not found");
  const product = await Product.findById(productId);
  if (!product) throw new NotFoundError("Product not found");
  const store = await Store.findById(product.storeId);
  if (!store || store.userId.toString() !== userId) throw new ForbiddenError();
  return { product, store };
}
