import { Types } from "mongoose";
import { bumpCatalogueVersion } from "../../shared/cache.js";
import { BadRequestError, NotFoundError } from "../../shared/errors.js";
import { fromCents } from "../../shared/money.js";
import { isValidObjectId } from "../../shared/validation.js";
import { CheckoutIntent } from "../checkout/checkoutIntent.model.js";
import { Order } from "../orders/order.model.js";
import { Product } from "../products/product.model.js";
import { Coupon } from "../promotions/coupon.model.js";
import { Store } from "../stores/store.model.js";
import { Profile } from "../users/profile.model.js";
import { User } from "../users/user.model.js";

export async function adminMetrics() {
  const [
    users,
    vendors,
    customers,
    stores,
    activeStores,
    products,
    orders,
    pendingOrders,
    revenue,
    lowStock,
    reconciliation
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "vendor" }),
    User.countDocuments({ role: "customer" }),
    Store.countDocuments(),
    Store.countDocuments({ isActive: true }),
    Product.countDocuments(),
    Order.countDocuments(),
    Order.countDocuments({ status: "pending" }),
    Order.aggregate<{ _id: null; total: number }>([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalCents" } } }
    ]),
    Product.countDocuments({
      $expr: {
        $lte: [
          { $subtract: ["$stockQty", { $ifNull: ["$reservedQty", 0] }] },
          5
        ]
      }
    }),
    CheckoutIntent.countDocuments({ status: "needs_reconciliation" })
  ]);

  const gmvCents = revenue[0]?.total ?? 0;
  return {
    users,
    vendors,
    customers,
    stores,
    activeStores,
    products,
    orders,
    pendingOrders,
    gmvCents,
    gmv: fromCents(gmvCents),
    lowStock,
    reconciliation
  };
}

export async function listAdminStores(input: { page: number; limit: number; search?: string }) {
  const filter = input.search
    ? { name: { $regex: input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    : {};
  const [stores, total] = await Promise.all([
    Store.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
    Store.countDocuments(filter)
  ]);
  const ownerIds = stores.map((store) => store.userId);
  const [users, profiles, productCounts] = await Promise.all([
    User.find({ _id: { $in: ownerIds } }).select("email"),
    Profile.find({ userId: { $in: ownerIds } }).select("userId displayName"),
    Product.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { storeId: { $in: stores.map((store) => store._id) } } },
      { $group: { _id: "$storeId", count: { $sum: 1 } } }
    ])
  ]);
  const emailById = new Map(users.map((user) => [user.id, user.email]));
  const nameById = new Map(
    profiles.map((profile) => [profile.userId.toString(), profile.displayName])
  );
  const countById = new Map(productCounts.map((row) => [row._id.toString(), row.count]));
  return {
    items: stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      isActive: store.isActive,
      owner: {
        email: emailById.get(store.userId.toString()) ?? "",
        displayName: nameById.get(store.userId.toString()) ?? ""
      },
      productCount: countById.get(store.id) ?? 0,
      createdAt: store.createdAt
    })),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit) || 0
  };
}

export async function setStoreActive(storeId: string, isActive: boolean) {
  if (!isValidObjectId(storeId)) throw new NotFoundError("Store not found");
  const store = await Store.findByIdAndUpdate(storeId, { $set: { isActive } }, { new: true });
  if (!store) throw new NotFoundError("Store not found");
  await bumpCatalogueVersion();
  return store;
}

export async function listAdminProducts(input: {
  page: number;
  limit: number;
  search?: string;
}) {
  const filter = input.search
    ? { name: { $regex: input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    : {};
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate({ path: "storeId", select: "name slug" })
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
    Product.countDocuments(filter)
  ]);
  return {
    items: products.map((product) => {
      const store = product.storeId as unknown as { _id?: Types.ObjectId; name?: string } | null;
      return {
        id: product.id,
        name: product.name,
        priceCents: Math.round(product.price * 100),
        unit: product.unit,
        stockQty: product.stockQty,
        reservedQty: product.reservedQty,
        availableQty: Math.max(0, product.stockQty - product.reservedQty),
        category: product.category,
        isPublished: product.isPublished,
        isActive: product.isActive,
        store: store ? { id: store._id?.toString(), name: store.name } : null,
        createdAt: product.createdAt
      };
    }),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit) || 0
  };
}

export async function setProductActive(productId: string, isActive: boolean) {
  if (!isValidObjectId(productId)) throw new NotFoundError("Product not found");
  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: { isActive } },
    { new: true }
  );
  if (!product) throw new NotFoundError("Product not found");
  await bumpCatalogueVersion();
  return product;
}

export async function listAdminOrders(input: { page: number; limit: number }) {
  const [orders, total] = await Promise.all([
    Order.find()
      .populate({ path: "storeId", select: "name slug" })
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
    Order.countDocuments()
  ]);
  const customerIds = [...new Set(orders.map((order) => order.customerId.toString()))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: customerIds } }).select("email"),
    Profile.find({ userId: { $in: customerIds } }).select("userId displayName")
  ]);
  const emailById = new Map(users.map((user) => [user.id, user.email]));
  const nameById = new Map(
    profiles.map((profile) => [profile.userId.toString(), profile.displayName])
  );
  return {
    items: orders.map((order) => {
      const store = order.storeId as unknown as { _id?: Types.ObjectId; name?: string } | null;
      return {
        id: order.id,
        checkoutId: order.checkoutId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalCents: order.totalCents,
        total: order.total,
        itemCount: order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
        store: store ? { id: store._id?.toString(), name: store.name } : null,
        customer: {
          displayName: nameById.get(order.customerId.toString()) ?? "Customer",
          email: emailById.get(order.customerId.toString()) ?? ""
        },
        createdAt: order.createdAt
      };
    }),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit) || 0
  };
}

export async function listAdminUsers(input: { page: number; limit: number; search?: string }) {
  const filter = input.search
    ? { email: { $regex: input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    : {};
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
    User.countDocuments(filter)
  ]);
  const profiles = await Profile.find({ userId: { $in: users.map((user) => user._id) } }).select(
    "userId displayName"
  );
  const nameById = new Map(
    profiles.map((profile) => [profile.userId.toString(), profile.displayName])
  );
  return {
    items: users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      displayName: nameById.get(user.id) ?? "",
      createdAt: user.createdAt
    })),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit) || 0
  };
}

export function toCouponDto(coupon: {
  id?: string;
  _id?: unknown;
  code: string;
  scope: string;
  storeId?: Types.ObjectId | null;
  type: string;
  value: number;
  maxDiscountCents?: number | null;
  minSubtotalCents: number;
  startsAt: Date;
  endsAt: Date;
  maxRedemptions?: number | null;
  maxRedemptionsPerUser: number;
  redemptionCount: number;
  isActive: boolean;
}) {
  return {
    id: coupon.id ?? String(coupon._id),
    code: coupon.code,
    scope: coupon.scope,
    storeId: coupon.storeId?.toString() ?? null,
    type: coupon.type,
    value: coupon.value,
    maxDiscountCents: coupon.maxDiscountCents ?? null,
    minSubtotalCents: coupon.minSubtotalCents,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    maxRedemptions: coupon.maxRedemptions ?? null,
    maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
    redemptionCount: coupon.redemptionCount,
    isActive: coupon.isActive
  };
}

export async function listCoupons() {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  return coupons.map((coupon) => toCouponDto(coupon));
}

export async function createCoupon(input: Record<string, unknown>) {
  if (input.scope === "store" && !input.storeId) {
    throw new BadRequestError("A store coupon requires storeId");
  }
  const coupon = await Coupon.create({
    code: String(input.code).toUpperCase(),
    scope: input.scope,
    storeId: input.storeId ? new Types.ObjectId(String(input.storeId)) : null,
    type: input.type,
    value: input.value,
    maxDiscountCents: input.maxDiscountCents ?? null,
    minSubtotalCents: input.minSubtotalCents ?? 0,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    maxRedemptions: input.maxRedemptions ?? null,
    maxRedemptionsPerUser: input.maxRedemptionsPerUser ?? 1
  });
  return toCouponDto(coupon);
}

export async function updateCoupon(couponId: string, input: Record<string, unknown>) {
  if (!isValidObjectId(couponId)) throw new NotFoundError("Coupon not found");
  const allowed = ["isActive", "endsAt", "maxRedemptions", "maxRedemptionsPerUser"] as const;
  const update: Record<string, unknown> = {};
  for (const field of allowed) {
    if (field in input) update[field] = input[field];
  }
  const coupon = await Coupon.findByIdAndUpdate(couponId, { $set: update }, { new: true });
  if (!coupon) throw new NotFoundError("Coupon not found");
  return toCouponDto(coupon);
}
