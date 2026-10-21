import Stripe from "stripe";
import { config, features } from "../config.js";
import { ServiceUnavailableError } from "../errors.js";

export interface PaymentIntentResult {
  id: string;
  clientSecret: string | null;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, string>;
}

export interface PaymentProvider {
  createIntent(input: {
    amountCents: number;
    currency: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<PaymentIntentResult>;
  retrieveIntent(id: string): Promise<PaymentIntentResult>;
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event;
}

class StripePaymentProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createIntent(input: {
    amountCents: number;
    currency: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency,
        automatic_payment_methods: { enabled: true },
        metadata: input.metadata
      },
      { idempotencyKey: input.idempotencyKey }
    );
    return this.map(intent);
  }

  async retrieveIntent(id: string): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.retrieve(id);
    return this.map(intent);
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!config.stripeWebhookSecret) {
      throw new ServiceUnavailableError("Stripe webhook secret is not configured");
    }
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripeWebhookSecret
    );
  }

  private map(intent: Stripe.PaymentIntent): PaymentIntentResult {
    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      metadata: intent.metadata as Record<string, string>
    };
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  if (!features.stripe || !config.stripeSecretKey) {
    throw new ServiceUnavailableError(
      "Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env."
    );
  }
  provider = new StripePaymentProvider(config.stripeSecretKey);
  return provider;
}

export function setPaymentProviderForTests(next: PaymentProvider | null): void {
  if (config.env !== "test") {
    throw new Error("setPaymentProviderForTests is test-only");
  }
  provider = next;
}
