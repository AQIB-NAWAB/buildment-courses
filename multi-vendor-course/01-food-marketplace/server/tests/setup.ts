process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ??
  "mongodb://127.0.0.1:27017/freshmarket_test?replicaSet=rs0&directConnection=true";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.RETURN_REFRESH_TOKEN = "true";
process.env.CURRENCY = "inr";

import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { connectDatabase, disconnectDatabase } from "../src/shared/db.js";
import { Product } from "../src/modules/products/product.model.js";

beforeAll(async () => {
  await connectDatabase(process.env.MONGODB_URI);
  await Product.syncIndexes();
});

beforeEach(async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await disconnectDatabase();
});
