import type { NextFunction, Request, Response } from "express";
import { getRedis } from "../../shared/redis.js";
import { logger } from "../../shared/logger.js";

const WINDOW_SECONDS = 60;
const LIMIT = 20;

export async function couponRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    next();
    return;
  }
  const ip = req.ip ?? "unknown";
  const userKey = `coupon-attempt:user:${req.user?.id ?? "anonymous"}`;
  const ipKey = `coupon-attempt:ip:${ip}`;

  try {
    const [userCount, ipCount] = await Promise.all([
      redis.incr(userKey),
      redis.incr(ipKey)
    ]);
    if (userCount === 1) await redis.expire(userKey, WINDOW_SECONDS);
    if (ipCount === 1) await redis.expire(ipKey, WINDOW_SECONDS);

    if (userCount > LIMIT || ipCount > LIMIT) {
      const ttl = Math.max(await redis.ttl(userKey), await redis.ttl(ipKey), 1);
      res.setHeader("Retry-After", String(ttl));
      res.status(429).json({
        message: "Too many coupon attempts. Try again shortly.",
        code: "TOO_MANY_ATTEMPTS",
        retryAfterSeconds: ttl
      });
      return;
    }
    next();
  } catch (error) {
    logger.warn({ err: error }, "Coupon rate limiter unavailable; allowing request");
    next();
  }
}
