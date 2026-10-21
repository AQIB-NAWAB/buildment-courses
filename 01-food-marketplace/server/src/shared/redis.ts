import { Redis } from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";

let client: Redis | null = null;
let ready = false;

export function getRedis(): Redis | null {
  if (!client || !ready) return null;
  return client;
}

export async function connectRedis(): Promise<void> {
  if (client) return;
  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      return Math.min(times * 500, 5_000);
    }
  });

  redis.on("ready", () => {
    ready = true;
    logger.info("Redis connected");
  });
  redis.on("close", () => {
    ready = false;
  });
  redis.on("error", (error) => {
    logger.warn({ err: error }, "Redis unavailable — cache will fall back to MongoDB");
  });

  try {
    await redis.connect();
    await redis.ping();
    ready = true;
    client = redis;
  } catch (error) {
    logger.warn({ err: error }, "Redis connection failed; continuing without cache");
    client = redis;
    ready = false;
  }
}

export function redisStatus(): "connected" | "degraded" {
  return ready ? "connected" : "degraded";
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    client.removeAllListeners();
    await client.quit().catch(() => client?.disconnect());
    client = null;
    ready = false;
  }
}

export function createRedisConnection(): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}
