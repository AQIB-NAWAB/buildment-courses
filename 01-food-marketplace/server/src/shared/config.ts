import "dotenv/config";
import { z } from "zod";

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  MONGODB_URI: z
    .string()
    .default("mongodb://127.0.0.1:27017/freshmarket?replicaSet=rs0&directConnection=true"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  RETURN_REFRESH_TOKEN: booleanish,
  COOKIE_SECURE: booleanish,
  CURRENCY: z.string().default("inr"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  CATALOGUE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  ALLOW_SEED: booleanish
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;
const isProduction = env.NODE_ENV === "production";

if (isProduction && !env.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET is required in production");
}
if (isProduction && !env.JWT_REFRESH_SECRET) {
  throw new Error("JWT_REFRESH_SECRET is required in production");
}

export const config = {
  env: env.NODE_ENV,
  isProduction,
  port: env.PORT,
  clientOrigin: env.CLIENT_ORIGIN,
  mongoUri: env.MONGODB_URI,
  redisUrl: env.REDIS_URL,
  jwtAccessSecret: env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  jwtRefreshSecret: env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
  accessTokenTtl: env.ACCESS_TOKEN_TTL,
  refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  returnRefreshToken: env.RETURN_REFRESH_TOKEN,
  cookieSecure: env.COOKIE_SECURE ?? isProduction,
  currency: env.CURRENCY.toLowerCase(),
  stripeSecretKey: env.STRIPE_SECRET_KEY || null,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || null,
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME || null,
    apiKey: env.CLOUDINARY_API_KEY || null,
    apiSecret: env.CLOUDINARY_API_SECRET || null
  },
  reservationTtlMinutes: env.RESERVATION_TTL_MINUTES,
  catalogueCacheTtlSeconds: env.CATALOGUE_CACHE_TTL_SECONDS,
  allowSeed: env.ALLOW_SEED
} as const;

export const features = {
  stripe: Boolean(config.stripeSecretKey),
  stripeWebhook: Boolean(config.stripeSecretKey && config.stripeWebhookSecret),
  cloudinary: Boolean(
    config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
  )
} as const;
