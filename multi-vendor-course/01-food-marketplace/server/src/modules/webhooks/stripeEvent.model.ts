import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";

export interface IStripeEvent {
  eventId: string;
  type: string;
  paymentIntentId?: string | null;
  checkoutId?: string | null;
  summary?: Record<string, unknown>;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const stripeEventSchema = new Schema<IStripeEvent>(
  {
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    paymentIntentId: { type: String, default: null },
    checkoutId: { type: String, default: null },
    summary: { type: Schema.Types.Mixed, default: {} },
    processedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

stripeEventSchema.index({ eventId: 1 }, { unique: true });

export type StripeEventDocument = HydratedDocument<IStripeEvent>;
export const StripeEvent = mongoose.model<IStripeEvent>("StripeEvent", stripeEventSchema);

// Keep Types imported for consumers that build ObjectId-based filters alongside events.
export type { Types };
