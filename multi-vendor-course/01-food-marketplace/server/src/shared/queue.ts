import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "./redis.js";
import { logger } from "./logger.js";

export const QUEUE_NAMES = {
  NOTIFICATIONS: "notifications"
} as const;

export const JOB_NAMES = {
  ORDER_CREATED: "order.created",
  ORDER_STATUS_UPDATED: "order.statusUpdated",
  INVENTORY_RELEASE_EXPIRED: "inventory.releaseExpired"
} as const;

export interface QueueAdapter {
  enqueue(name: string, data: Record<string, unknown>, opts?: JobsOptions): Promise<void>;
  schedule(name: string, data: Record<string, unknown>, everyMs: number): Promise<void>;
  close(): Promise<void>;
}

class BullQueueAdapter implements QueueAdapter {
  private queue: Queue | null = null;

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
        connection: createRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: 100,
          removeOnFail: false
        }
      });
      this.queue.on("error", (error) => logger.warn({ err: error }, "Queue error"));
    }
    return this.queue;
  }

  async enqueue(name: string, data: Record<string, unknown>, opts?: JobsOptions): Promise<void> {
    await this.getQueue().add(name, data, opts);
  }

  async schedule(name: string, data: Record<string, unknown>, everyMs: number): Promise<void> {
    const queue = this.getQueue();
    await queue.upsertJobScheduler(
      `scheduler:${name}`,
      { every: everyMs },
      { name, data, opts: { removeOnComplete: 10, removeOnFail: 50 } }
    );
  }

  async close(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }
}

const bullQueue = new BullQueueAdapter();
let override: QueueAdapter | null = null;

export function getQueue(): QueueAdapter {
  return override ?? bullQueue;
}

export function setQueueForTests(adapter: QueueAdapter | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("setQueueForTests is test-only");
  override = adapter;
}

export async function enqueueNotification(
  name: string,
  data: Record<string, unknown>,
  jobId?: string
): Promise<void> {
  try {
    await getQueue().enqueue(name, data, jobId ? { jobId } : undefined);
  } catch (error) {
    logger.error({ err: error, jobName: name }, "Could not enqueue notification job");
  }
}
