import mongoose, { type HydratedDocument, Schema, Types } from "mongoose";

export interface INotification {
  userId: Types.ObjectId;
  type: "order.created" | "order.status_updated";
  title: string;
  body: string;
  orderId?: Types.ObjectId | null;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["order.created", "order.status_updated"],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDocument = HydratedDocument<INotification>;
export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
