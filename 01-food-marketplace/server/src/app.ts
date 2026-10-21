import crypto from "node:crypto";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./shared/config.js";
import { databaseStatus } from "./shared/db.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";
import { logger } from "./shared/logger.js";
import { redisStatus } from "./shared/redis.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { cartRouter } from "./modules/cart/cart.routes.js";
import { checkoutRouter, paymentsRouter } from "./modules/checkout/checkout.routes.js";
import { ordersRouter, vendorOrdersRouter } from "./modules/orders/orders.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { storesRouter } from "./modules/stores/stores.routes.js";
import { webhooksRouter } from "./modules/webhooks/webhooks.routes.js";

export function createApp(): Express {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      genReqId(req, res) {
        const id = req.headers["x-request-id"]?.toString() || crypto.randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      }
    })
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true
    })
  );
  app.use(cookieParser());

  // Stripe signature verification needs the raw bytes, so this mount must come
  // before express.json().
  app.use("/api/webhooks", webhooksRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(compression());

  const globalLimiter = rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });
  app.use(globalLimiter);

  app.get("/health", (_req, res) => {
    const db = databaseStatus();
    const status = db === "connected" ? "ok" : "unavailable";
    res.status(db === "connected" ? 200 : 503).json({
      status,
      db,
      redis: redisStatus(),
      service: "freshmarket-api"
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/stores", storesRouter);
  app.use("/api", productsRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/checkout", checkoutRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/vendor/orders", vendorOrdersRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
