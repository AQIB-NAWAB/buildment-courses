import { config } from "./config.js";
import { logger } from "./logger.js";
import { getRedis } from "./redis.js";

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  increment(key: string): Promise<number>;
}

class RedisCacheStore implements CacheStore {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.warn({ err: error, key }, "Cache read failed");
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      logger.warn({ err: error, key }, "Cache write failed");
    }
  }

  async del(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn({ err: error, key }, "Cache delete failed");
    }
  }

  async increment(key: string): Promise<number> {
    const redis = getRedis();
    if (!redis) return 0;
    try {
      return await redis.incr(key);
    } catch (error) {
      logger.warn({ err: error, key }, "Cache increment failed");
      return 0;
    }
  }
}

export class MemoryCacheStore implements CacheStore {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async increment(key: string): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.set(key, next, 60);
    return next;
  }
}

const redisCache = new RedisCacheStore();
let override: CacheStore | null = null;

export function getCache(): CacheStore {
  return override ?? redisCache;
}

export function setCacheForTests(store: CacheStore | null): void {
  if (config.env !== "test") throw new Error("setCacheForTests is test-only");
  override = store;
}

export async function getCatalogueVersion(): Promise<number> {
  const cache = getCache();
  const value = await cache.get<number>("catalogue:version");
  return value ?? 0;
}

export async function bumpCatalogueVersion(): Promise<void> {
  const cache = getCache();
  await cache.increment("catalogue:version");
}

export interface CatalogueKeyInput {
  page: number;
  limit: number;
  category?: string;
  storeId?: string;
  search?: string;
  sort?: string;
}

export async function catalogueCacheKey(input: CatalogueKeyInput): Promise<string> {
  const version = await getCatalogueVersion();
  const normalized = [
    `page=${input.page}`,
    `limit=${input.limit}`,
    `category=${(input.category ?? "").trim().toLowerCase()}`,
    `storeId=${input.storeId ?? ""}`,
    `search=${(input.search ?? "").trim().toLowerCase()}`,
    `sort=${input.sort ?? "newest"}`
  ].join("&");
  return `catalogue:v${version}:${normalized}`;
}

export const cacheTtlSeconds = config.catalogueCacheTtlSeconds;
