import { Worker } from "bullmq";
import { connectDatabase, disconnectDatabase } from "./shared/db.js";
import { logger } from "./shared/logger.js";
import { createRedisConnection } from "./shared/redis.js";
import {
  getQueue,
  JOB_NAMES,
  QUEUE_NAMES
} from "./shared/queue.js";
import { releaseExpiredReservations } from "./modules/inventory/inventory.service.js";
import {
  processOrderCreated,
  processOrderStatusUpdated
} from "./modules/notifications/processors.js";

async function main() {
  await connectDatabase();

  const worker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job) => {
      logger.info({ jobId: job.id, jobName: job.name }, "[worker] job received");
      switch (job.name) {
        case JOB_NAMES.ORDER_CREATED:
          await processOrderCreated(job.data as { orderIds: string[]; customerId: string });
          return;
        case JOB_NAMES.ORDER_STATUS_UPDATED:
          await processOrderStatusUpdated(
            job.data as {
              orderId: string;
              customerId: string;
              status: string;
              storeName?: string;
            }
          );
          return;
        case JOB_NAMES.INVENTORY_RELEASE_EXPIRED: {
          const released = await releaseExpiredReservations();
          logger.info({ released }, "[inventory] expired hold sweep complete");
          return;
        }
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5
    }
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "[worker] job completed");
  });
  worker.on("failed", (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        jobName: job?.name,
        attempt: job?.attemptsMade,
        error: error.message
      },
      "[worker] job failed"
    );
  });

  await getQueue().schedule(JOB_NAMES.INVENTORY_RELEASE_EXPIRED, {}, 60_000);
  logger.info(`[worker] listening on queue ${QUEUE_NAMES.NOTIFICATIONS}`);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "[worker] shutting down");
    await worker.close();
    await getQueue().close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error({ err: error }, "[worker] failed to start");
  process.exit(1);
});
