import { Types } from "mongoose";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";
import { getVendorStore } from "../../shared/ownership.js";
import { isValidObjectId } from "../../shared/validation.js";
import { enqueueNotification, JOB_NAMES } from "../../shared/queue.js";
import { Profile } from "../users/profile.model.js";
import { Store } from "../stores/store.model.js";
import { User } from "../users/user.model.js";
import { Order, type IOrder } from "./order.model.js";

type PopulatedOrder = IOrder & {
  _id: Types.ObjectId;
  storeId: unknown;
  customerId: unknown;
};

export function toOrderDto(order: PopulatedOrder) {
  const store = order.storeId as unknown as { _id?: Types.ObjectId; name?: string; slug?: string } | null;
  return {
    id: order._id.toString(),
    checkoutId: order.checkoutId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    stripePaymentIntentId: order.stripePaymentIntentId,
    store: store
      ? { id: store._id?.toString(), name: store.name, slug: store.slug }
      : null,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    total: order.total,
    couponCode: order.couponCode ?? null,
    couponScope: order.couponScope ?? null,
    pricingVersion: order.pricingVersion,
    paidAt: order.paidAt ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.orderItems.map((item) => ({
      productId: item.productId.toString(),
      name: item.nameAtPurchase,
      unit: item.unitAtPurchase,
      quantity: item.quantity,
      priceAtPurchase: item.priceAtPurchase,
      priceAtPurchaseCents: item.priceAtPurchaseCents,
      lineSubtotalCents: item.lineSubtotalCents,
      discountCents: item.discountCents,
      lineTotalCents: item.lineTotalCents,
      lineTotal: item.lineTotal
    }))
  };
}

function vendorOrder(order: PopulatedOrder, customer: { displayName: string; email: string } | null) {
  return {
    ...toOrderDto(order),
    customer
  };
}

export async function listCustomerOrders(userId: string) {
  const orders = await Order.find({ customerId: new Types.ObjectId(userId) })
    .populate({ path: "storeId", select: "name slug" })
    .sort({ createdAt: -1 });
  return orders.map((order) => toOrderDto(order as unknown as PopulatedOrder));
}

export async function getOrderForUser(userId: string, orderId: string) {
  if (!isValidObjectId(orderId)) throw new NotFoundError("Order not found");
  const order = await Order.findById(orderId).populate({ path: "storeId", select: "name slug userId" });
  if (!order) throw new NotFoundError("Order not found");

  const store = order.storeId as unknown as { userId?: Types.ObjectId } | null;
  const isCustomer = order.customerId.toString() === userId;
  const isVendor = store?.userId?.toString() === userId;
  if (!isCustomer && !isVendor) throw new ForbiddenError();
  return toOrderDto(order as unknown as PopulatedOrder);
}

export async function listVendorOrders(userId: string) {
  const store = await getVendorStore(userId);
  if (!store) return [];
  const orders = await Order.find({ storeId: store._id })
    .populate({ path: "storeId", select: "name slug" })
    .sort({ createdAt: -1 });

  const customerIds = [...new Set(orders.map((order) => order.customerId.toString()))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: customerIds } }).select("email"),
    Profile.find({ userId: { $in: customerIds } }).select("userId displayName")
  ]);
  const emailById = new Map(users.map((user) => [user.id, user.email]));
  const nameById = new Map(
    profiles.map((profile) => [profile.userId.toString(), profile.displayName])
  );

  return orders.map((order) =>
    vendorOrder(order as unknown as PopulatedOrder, {
      displayName: nameById.get(order.customerId.toString()) ?? "Customer",
      email: emailById.get(order.customerId.toString()) ?? ""
    })
  );
}

const TRANSITIONS: Record<string, string[]> = {
  pending: ["packed"],
  packed: ["dispatched"],
  dispatched: []
};

export async function updateVendorOrderStatus(
  userId: string,
  orderId: string,
  input: { status: string; currentStatus?: string }
) {
  if (!isValidObjectId(orderId)) throw new NotFoundError("Order not found");
  const store = await getVendorStore(userId);
  if (!store) throw new NotFoundError("Store not found");

  const order = await Order.findOne({ _id: orderId, storeId: store._id });
  if (!order) throw new NotFoundError("Order not found");

  const expected = input.currentStatus ?? order.status;
  if (order.status !== expected) {
    throw new ConflictError("This order changed. Refresh and try again.", "ORDER_STALE");
  }
  const allowed = TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw new ConflictError(
      `Cannot move an order from ${order.status} to ${input.status}`,
      "INVALID_TRANSITION"
    );
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, storeId: store._id, status: expected },
    { $set: { status: input.status } },
    { new: true }
  ).populate({ path: "storeId", select: "name slug" });

  if (!updated) {
    throw new ConflictError("This order changed. Refresh and try again.", "ORDER_STALE");
  }

  await enqueueNotification(
    JOB_NAMES.ORDER_STATUS_UPDATED,
    {
      orderId: updated.id,
      customerId: updated.customerId.toString(),
      status: input.status,
      storeName: store.name
    },
    `order-status:${updated.id}:${input.status}`
  );

  const customer = await Profile.findOne({ userId: updated.customerId }).select("displayName");
  return vendorOrder(updated as unknown as PopulatedOrder, {
    displayName: customer?.displayName ?? "Customer",
    email: ""
  });
}

export async function getVendorStoreForOrder(userId: string) {
  return getVendorStore(userId);
}

export async function orderCountsForStore(storeId: Types.ObjectId) {
  const [products, pendingOrders, revenue] = await Promise.all([
    import("../products/product.model.js").then(({ Product }) =>
      Product.countDocuments({ storeId })
    ),
    Order.countDocuments({ storeId, status: "pending" }),
    Order.aggregate<{ _id: null; total: number }>([
      { $match: { storeId, paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalCents" } } }
    ])
  ]);
  return {
    products,
    pendingOrders,
    revenueCents: revenue[0]?.total ?? 0
  };
}

export async function storeForVendor(userId: string) {
  return Store.findOne({ userId: new Types.ObjectId(userId) });
}
