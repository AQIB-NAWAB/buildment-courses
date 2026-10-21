import { createApp } from "./app.js";
import { config } from "./shared/config.js";
import { connectDatabase, disconnectDatabase } from "./shared/db.js";
import { logger } from "./shared/logger.js";
import { getQueue } from "./shared/queue.js";
import { connectRedis, disconnectRedis } from "./shared/redis.js";

async function main() {
  await connectDatabase();
  await connectRedis();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`FreshMarket API listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down API");
    server.close(async () => {
      await getQueue().close();
      await disconnectRedis();
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error({ err: error }, "Failed to start API");
  process.exit(1);
});
