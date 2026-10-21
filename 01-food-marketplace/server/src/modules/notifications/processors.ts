import { Types } from "mongoose";
import { logger } from "../../shared/logger.js";
import { Order } from "../orders/order.model.js";
import { Store } from "../stores/store.model.js";
import { Notification } from "./notification.model.js";

export async function processOrderCreated(data: {
  orderIds: string[];
  customerId: string;
}): Promise<void> {
  const orders = await Order.find({ _id: { $in: data.orderIds } });
  const storeIds = [...new Set(orders.map((order) => order.storeId.toString()))];
  const stores = await Store.find({ _id: { $in: storeIds } }).select("name userId");
  const storeById = new Map(stores.map((store) => [store.id, store]));

  for (const order of orders) {
    const store = storeById.get(order.storeId.toString());
    logger.info(
      { orderId: order.id, storeId: order.storeId.toString(), totalCents: order.totalCents },
      `[NOTIFY] customer order ${order.id} placed at ${store?.name ?? "store"}`
    );
    await Notification.create({
      userId: order.customerId,
      type: "order.created",
      title: "Order confirmed",
      body: `Your order from ${store?.name ?? "the market"} is confirmed.`,
      orderId: order._id
    });
    if (store) {
      logger.info(
        { orderId: order.id, vendorId: store.userId.toString() },
        `[NOTIFY] vendor ${store.name} received order ${order.id}`
      );
      await Notification.create({
        userId: store.userId,
        type: "order.created",
        title: "New order",
        body: `You received a new order for ${order.total.toFixed(2)}.`,
        orderId: order._id
      });
    }
  }
}

export async function processOrderStatusUpdated(data: {
  orderId: string;
  customerId: string;
  status: string;
  storeName?: string;
}): Promise<void> {
  const order = await Order.findById(data.orderId);
  if (!order) return;
  logger.info(
    { orderId: data.orderId, status: data.status },
    `[NOTIFY] order ${data.orderId} is now ${data.status}`
  );
  await Notification.create({
    userId: new Types.ObjectId(data.customerId),
    type: "order.status_updated",
    title: "Order updated",
    body: `Your order from ${data.storeName ?? "the market"} is now ${data.status}.`,
    orderId: order._id
  });
}
