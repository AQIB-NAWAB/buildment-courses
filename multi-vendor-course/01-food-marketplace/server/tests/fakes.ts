import type { JobsOptions } from "bullmq";
import type Stripe from "stripe";
import type { CacheStore } from "../src/shared/cache.js";
import type { ImageStorage } from "../src/shared/adapters/imageStorage.js";
import type { PaymentIntentResult, PaymentProvider } from "../src/shared/adapters/payment.js";
import type { QueueAdapter } from "../src/shared/queue.js";

export class FakePaymentProvider implements PaymentProvider {
  private intents = new Map<string, PaymentIntentResult>();
  private counter = 0;
  webhookEvent: Stripe.Event | null = null;

  async createIntent(input: {
    amountCents: number;
    currency: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<PaymentIntentResult> {
    this.counter += 1;
    const id = `pi_test_${this.counter}`;
    const intent: PaymentIntentResult = {
      id,
      clientSecret: `${id}_secret_test`,
      amount: input.amountCents,
      currency: input.currency,
      status: "requires_payment_method",
      metadata: input.metadata
    };
    this.intents.set(id, intent);
    return intent;
  }

  async retrieveIntent(id: string): Promise<PaymentIntentResult> {
    const intent = this.intents.get(id);
    if (!intent) throw new Error(`Unknown payment intent ${id}`);
    return intent;
  }

  succeed(id: string): void {
    const intent = this.intents.get(id);
    if (!intent) throw new Error(`Unknown payment intent ${id}`);
    intent.status = "succeeded";
  }

  constructWebhookEvent(_rawBody: Buffer, _signature: string): Stripe.Event {
    if (!this.webhookEvent) {
      throw new Error("No fake webhook event configured");
    }
    return this.webhookEvent;
  }
}

export class FakeQueue implements QueueAdapter {
  jobs: { name: string; data: Record<string, unknown>; opts?: JobsOptions }[] = [];

  async enqueue(
    name: string,
    data: Record<string, unknown>,
    opts?: JobsOptions
  ): Promise<void> {
    this.jobs.push({ name, data, opts });
  }

  async schedule(): Promise<void> {
    // no-op
  }

  async close(): Promise<void> {
    // no-op
  }
}

export class FakeImageStorage implements ImageStorage {
  uploaded: { url: string; publicId: string } | null = null;
  removed: string[] = [];

  async upload(_buffer: Buffer, filename: string) {
    this.uploaded = {
      url: `https://res.cloudinary.test/freshmarket/products/${filename}.jpg`,
      publicId: `freshmarket/products/${filename}`
    };
    return this.uploaded;
  }

  async remove(publicId: string | null | undefined) {
    if (publicId) this.removed.push(publicId);
  }
}

export function memoryCache(): CacheStore {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    async get<T>(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set(key, value, ttlSeconds) {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
    },
    async del(key) {
      store.delete(key);
    },
    async increment(key) {
      const current = (await this.get<number>(key)) ?? 0;
      const next = current + 1;
      await this.set(key, next, 60);
      return next;
    }
  };
}
