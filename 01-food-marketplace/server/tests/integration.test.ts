import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { setCacheForTests } from "../src/shared/cache.js";
import { setQueueForTests } from "../src/shared/queue.js";
import { setPaymentProviderForTests } from "../src/shared/adapters/payment.js";
import { setImageStorageForTests } from "../src/shared/adapters/imageStorage.js";
import { Coupon } from "../src/modules/promotions/coupon.model.js";
import { CheckoutIntent } from "../src/modules/checkout/checkoutIntent.model.js";
import { CouponRedemption } from "../src/modules/promotions/couponRedemption.model.js";
import { Notification } from "../src/modules/notifications/notification.model.js";
import { Order } from "../src/modules/orders/order.model.js";
import { Product } from "../src/modules/products/product.model.js";
import { StockReservation } from "../src/modules/inventory/stockReservation.model.js";
import { StripeEvent } from "../src/modules/webhooks/stripeEvent.model.js";
import { handleStripeEvent } from "../src/modules/webhooks/webhooks.service.js";
import { processOrderCreated } from "../src/modules/notifications/processors.js";
import { FakeImageStorage, FakePaymentProvider, FakeQueue, memoryCache } from "./fakes.js";
import { addToCart, createFixture, type Fixture } from "./helpers.js";

const app = createApp();
const api = request(app);

let fixture: Fixture;
let payment: FakePaymentProvider;
let queue: FakeQueue;
let images: FakeImageStorage;

beforeEach(async () => {
  payment = new FakePaymentProvider();
  queue = new FakeQueue();
  images = new FakeImageStorage();
  setPaymentProviderForTests(payment);
  setQueueForTests(queue);
  setImageStorageForTests(images);
  setCacheForTests(memoryCache());
  fixture = await createFixture();
});

describe("health and auth", () => {
  it("reports database and redis readiness", async () => {
    const response = await api.get("/health");
    expect(response.status).toBe(200);
    expect(response.body.db).toBe("connected");
  });

  it("registers, verifies OTP, logs in, refreshes, and reads /me", async () => {
    const register = await api.post("/api/auth/register").send({
      email: "new@test.local",
      password: "Password123!",
      role: "customer",
      displayName: "New Shopper"
    });
    expect(register.status).toBe(201);
    expect(register.body.devOtp).toMatch(/^\d{6}$/);

    const loginBlocked = await api.post("/api/auth/login").send({
      email: "new@test.local",
      password: "Password123!"
    });
    expect(loginBlocked.status).toBe(403);

    const verify = await api
      .post("/api/auth/verify-otp")
      .send({ email: "new@test.local", otp: register.body.devOtp });
    expect(verify.status).toBe(200);

    const login = await api.post("/api/auth/login").send({
      email: "new@test.local",
      password: "Password123!"
    });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("customer");
    expect(login.body.refreshToken).toBeTruthy();

    const me = await api
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("new@test.local");
    expect(me.body.user.passwordHash).toBeUndefined();

    const refreshed = await api
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    const duplicate = await api.post("/api/auth/register").send({
      email: "NEW@test.local",
      password: "Password123!",
      role: "customer"
    });
    expect(duplicate.status).toBe(409);
  });

  it("clears the refresh cookie even when the access token is unavailable", async () => {
    const response = await api.post("/api/auth/logout");
    expect(response.status).toBe(204);
  });
});

describe("catalogue", () => {
  it("returns only published, active, in-stock products", async () => {
    const response = await api.get("/api/products");
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    const names = response.body.items.map((item: { name: string }) => item.name);
    expect(names).toContain("Organic Bananas");
    expect(names).toContain("Whole Milk");
    expect(names).toContain("Sourdough");
    expect(names).not.toContain("Secret Draft");
    expect(names).not.toContain("Sold Out");
    expect(response.body.items[0].availableQty).toBeGreaterThan(0);
  });

  it("filters by category, store, and text search", async () => {
    const category = await api.get("/api/products?category=produce");
    expect(category.body.items).toHaveLength(1);
    expect(category.body.items[0].name).toBe("Organic Bananas");

    const store = await api.get(`/api/products?storeId=${fixture.vendorB.storeId}`);
    expect(store.body.items).toHaveLength(1);
    expect(store.body.items[0].name).toBe("Sourdough");

    const search = await api.get("/api/products?search=milk");
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0].name).toBe("Whole Milk");

    const invalid = await api.get("/api/products?storeId=not-an-id");
    expect(invalid.status).toBe(400);
  });

  it("returns 404 for draft and out-of-stock detail", async () => {
    expect((await api.get(`/api/products/${fixture.products.draft.id}`)).status).toBe(404);
    expect((await api.get(`/api/products/${fixture.products.outOfStock.id}`)).status).toBe(404);
  });
});

describe("authorization and isolation", () => {
  it("blocks cross-vendor store and product writes", async () => {
    const storePatch = await api
      .patch(`/api/stores/${fixture.vendorA.storeId}`)
      .set("Authorization", `Bearer ${fixture.vendorB.token}`)
      .send({ description: "Hijacked" });
    expect(storePatch.status).toBe(403);

    const productPatch = await api
      .patch(`/api/products/${fixture.products.bananas.id}`)
      .set("Authorization", `Bearer ${fixture.vendorB.token}`)
      .send({ price: 1 });
    expect(productPatch.status).toBe(403);

    const vendorBProducts = await api
      .get("/api/vendor/products")
      .set("Authorization", `Bearer ${fixture.vendorB.token}`);
    expect(vendorBProducts.status).toBe(200);
    expect(vendorBProducts.body.products).toHaveLength(1);
    expect(vendorBProducts.body.products[0].name).toBe("Sourdough");
  });

  it("rejects customers from vendor order routes", async () => {
    const response = await api
      .get("/api/vendor/orders")
      .set("Authorization", `Bearer ${fixture.customerA.token}`);
    expect(response.status).toBe(403);
  });

  it("returns 404 for an invalid store id instead of a cast error", async () => {
    const response = await api.get("/api/stores/not-an-id");
    expect(response.status).toBe(404);
  });
});

describe("vendor product API", () => {
  it("creates, updates, uploads photos for, and deletes a product", async () => {
    const created = await api
      .post("/api/products")
      .set("Authorization", `Bearer ${fixture.vendorB.token}`)
      .send({
        name: "Rye Crackers",
        description: "Thin and crisp.",
        price: 80,
        unit: "pack",
        weightOrQuantity: 200,
        stockQty: 12,
        isPerishable: false,
        category: "pantry",
        isPublished: true
      });
    expect(created.status).toBe(201);
    const productId = created.body.product.id;

    const patched = await api
      .patch(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${fixture.vendorB.token}`)
      .send({ price: 90, isPublished: false });
    expect(patched.status).toBe(200);
    expect(patched.body.product.priceCents).toBe(9000);
    expect(patched.body.product.isPublished).toBe(false);

    const firstUpload = await api
      .post(`/api/products/${productId}/image`)
      .set("Authorization", `Bearer ${fixture.vendorB.token}`)
      .attach("image", Buffer.from("fake-image-one"), {
        filename: "one.png",
        contentType: "image/png"
      });
    expect(firstUpload.status).toBe(200);
    const firstPublicId = images.uploaded?.publicId;
    expect(firstUpload.body.imageUrl).toContain("res.cloudinary.test");

    const secondUpload = await api
      .post(`/api/products/${productId}/image`)
      .set("Authorization", `Bearer ${fixture.vendorB.token}`)
      .attach("image", Buffer.from("fake-image-two"), {
        filename: "two.png",
        contentType: "image/png"
      });
    expect(secondUpload.status).toBe(200);
    expect(images.removed).toContain(firstPublicId);

    const crossVendorUpload = await api
      .post(`/api/products/${productId}/image`)
      .set("Authorization", `Bearer ${fixture.vendorA.token}`)
      .attach("image", Buffer.from("fake-image-three"), {
        filename: "three.png",
        contentType: "image/png"
      });
    expect(crossVendorUpload.status).toBe(403);

    const deleted = await api
      .delete(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${fixture.vendorB.token}`);
    expect(deleted.status).toBe(204);

    const remaining = await api
      .get("/api/vendor/products")
      .set("Authorization", `Bearer ${fixture.vendorB.token}`);
    expect(remaining.body.products.map((product: { id: string }) => product.id)).not.toContain(
      productId
    );
  });

  it("rejects image uploads with an unsupported content type", async () => {
    const response = await api
      .post(`/api/products/${fixture.products.bread.id}/image`)
      .set("Authorization", `Bearer ${fixture.vendorB.token}`)
      .attach("image", Buffer.from("not-an-image"), {
        filename: "notes.txt",
        contentType: "text/plain"
      });
    expect(response.status).toBe(400);
  });
});

describe("cart and promotions", () => {
  it("persists a multi-vendor cart, applies a coupon, and scopes mutations", async () => {
    const addBananas = await api
      .post("/api/cart")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({
        productId: fixture.products.bananas.id,
        storeId: fixture.products.bananas.storeId,
        quantity: 2
      });
    expect(addBananas.status).toBe(201);

    const addBread = await api
      .post("/api/cart")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({
        productId: fixture.products.bread.id,
        storeId: fixture.products.bread.storeId,
        quantity: 1
      });
    expect(addBread.status).toBe(201);

    const cart = await api
      .get("/api/cart")
      .set("Authorization", `Bearer ${fixture.customerA.token}`);
    expect(cart.status).toBe(200);
    expect(cart.body.items).toHaveLength(2);
    expect(cart.body.pricing.stores).toHaveLength(2);

    const apply = await api
      .post("/api/cart/coupon")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({ code: "fresh10" });
    expect(apply.status).toBe(200);
    expect(apply.body.pricing.coupon.code).toBe("FRESH10");
    expect(apply.body.pricing.discountCents).toBeGreaterThan(0);

    const itemId = cart.body.items[0].id;
    const crossUser = await api
      .patch(`/api/cart/${itemId}`)
      .set("Authorization", `Bearer ${fixture.customerB.token}`)
      .send({ quantity: 1 });
    expect(crossUser.status).toBe(404);

    const removeCoupon = await api
      .delete("/api/cart/coupon")
      .set("Authorization", `Bearer ${fixture.customerA.token}`);
    expect(removeCoupon.status).toBe(200);
    expect(removeCoupon.body.pricing.coupon).toBeNull();
  });

  it("rejects quantity above available stock", async () => {
    const response = await api
      .post("/api/cart")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({
        productId: fixture.products.bananas.id,
        storeId: fixture.products.bananas.storeId,
        quantity: 500
      });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INSUFFICIENT_STOCK");
  });
});

describe("checkout, snapshots, reservations, and orders", () => {
  async function startAndPay() {
    await addToCart(fixture.customerA.id, fixture);
    const start = await api
      .post("/api/checkout/start")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({ checkoutId: "checkout-test-1" });
    expect(start.status).toBe(200);
    payment.succeed(start.body.paymentIntentId);
    const complete = await api
      .post("/api/checkout")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({ paymentIntentId: start.body.paymentIntentId });
    return { start, complete };
  }

  it("splits one payment into one order per vendor with immutable snapshots", async () => {
    const { start, complete } = await startAndPay();
    expect(complete.status).toBe(201);
    expect(complete.body.orders).toHaveLength(2);

    const bananas = await Product.findById(fixture.products.bananas.id);
    const bread = await Product.findById(fixture.products.bread.id);
    expect(bananas?.stockQty).toBe(18);
    expect(bananas?.reservedQty).toBe(0);
    expect(bread?.stockQty).toBe(7);

    const cart = await api
      .get("/api/cart")
      .set("Authorization", `Bearer ${fixture.customerA.token}`);
    expect(cart.body.items).toHaveLength(0);

    const orders = await Order.find({}).sort({ totalCents: 1 });
    expect(orders).toHaveLength(2);
    const bananaLine = orders
      .flatMap((order) => order.orderItems)
      .find((item) => item.nameAtPurchase === "Organic Bananas");
    expect(bananaLine?.priceAtPurchaseCents).toBe(5000);
    expect(orders.every((order) => order.paymentStatus === "paid")).toBe(true);
    expect(orders.every((order) => order.stripePaymentIntentId === start.body.paymentIntentId)).toBe(
      true
    );

    const redemption = await CouponRedemption.findOne({ checkoutId: "checkout-test-1" });
    expect(redemption).not.toBeNull();
    const coupon = await Coupon.findOne({ code: "FRESH10" });
    expect(coupon?.redemptionCount).toBe(1);

    await Product.updateOne(
      { _id: fixture.products.bananas.id },
      { $set: { price: 999 } }
    );
    const history = await api
      .get("/api/orders/my")
      .set("Authorization", `Bearer ${fixture.customerA.token}`);
    const historyLine = history.body.orders
      .flatMap((order: { items: { name: string }[] }) => order.items)
      .find((item: { name: string }) => item.name === "Organic Bananas");
    expect(historyLine.priceAtPurchaseCents).toBe(5000);

    const replay = await api
      .post("/api/checkout")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({ paymentIntentId: start.body.paymentIntentId });
    expect(replay.status).toBe(200);
    expect(replay.body.orders.map((order: { id: string }) => order.id).sort()).toEqual(
      complete.body.orders.map((order: { id: string }) => order.id).sort()
    );
    expect(await Order.countDocuments()).toBe(2);
    expect(queue.jobs.some((job) => job.name === "order.created")).toBe(true);

    const notificationsBefore = await Notification.countDocuments();
    await processOrderCreated({
      orderIds: orders.map((order) => order.id),
      customerId: fixture.customerA.id
    });
    expect(await Notification.countDocuments()).toBeGreaterThan(notificationsBefore);
  });

  it("rejects checkout when a saved coupon is no longer valid", async () => {
    await addToCart(fixture.customerA.id, fixture);
    await Coupon.updateOne({ code: "FRESH10" }, { $set: { isActive: false } });
    const response = await api
      .post("/api/checkout/start")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({ checkoutId: "checkout-coupon-invalid" });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("COUPON_INVALID");
    expect(await StockReservation.countDocuments({ status: "active" })).toBe(0);
  });

  it("is idempotent when the same checkoutId starts twice concurrently", async () => {
    await addToCart(fixture.customerA.id, fixture);
    const [first, second] = await Promise.all([
      api
        .post("/api/checkout/start")
        .set("Authorization", `Bearer ${fixture.customerA.token}`)
        .send({ checkoutId: "checkout-concurrent-same" }),
      api
        .post("/api/checkout/start")
        .set("Authorization", `Bearer ${fixture.customerA.token}`)
        .send({ checkoutId: "checkout-concurrent-same" })
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses[0]).toBe(200);
    expect([200, 409]).toContain(statuses[1]);
    if (statuses[1] === 200) {
      expect(first.body.paymentIntentId).toBe(second.body.paymentIntentId);
    }
    expect(
      await CheckoutIntent.countDocuments({ checkoutId: "checkout-concurrent-same" })
    ).toBe(1);
    const bananas = await Product.findById(fixture.products.bananas.id);
    const bread = await Product.findById(fixture.products.bread.id);
    expect(bananas?.reservedQty).toBe(2);
    expect(bread?.reservedQty).toBe(1);
  });

  it("lets only one customer reserve the last unit", async () => {
    await Product.updateOne({ _id: fixture.products.bananas.id }, { $set: { stockQty: 1 } });
    await addToCart(fixture.customerA.id, fixture, [
      {
        productId: fixture.products.bananas.id,
        storeId: fixture.products.bananas.storeId,
        quantity: 1
      }
    ]);
    await addToCart(fixture.customerB.id, fixture, [
      {
        productId: fixture.products.bananas.id,
        storeId: fixture.products.bananas.storeId,
        quantity: 1
      }
    ]);
    const [first, second] = await Promise.all([
      api
        .post("/api/checkout/start")
        .set("Authorization", `Bearer ${fixture.customerA.token}`)
        .send({ checkoutId: "checkout-last-unit-a" }),
      api
        .post("/api/checkout/start")
        .set("Authorization", `Bearer ${fixture.customerB.token}`)
        .send({ checkoutId: "checkout-last-unit-b" })
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(await StockReservation.countDocuments({ status: "active" })).toBe(1);
    const bananas = await Product.findById(fixture.products.bananas.id);
    expect(bananas?.reservedQty).toBe(1);
  });

  it("rejects insufficient stock before creating a payment intent", async () => {
    await Product.updateOne({ _id: fixture.products.bananas.id }, { $set: { stockQty: 1 } });
    await addToCart(fixture.customerA.id, fixture, [
      {
        productId: fixture.products.bananas.id,
        storeId: fixture.products.bananas.storeId,
        quantity: 2
      }
    ]);
    const response = await api
      .post("/api/checkout/start")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({ checkoutId: "checkout-test-oos" });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("INSUFFICIENT_STOCK");
    expect(await StockReservation.countDocuments({ status: "active" })).toBe(0);
  });

  it("enforces vendor status transitions and isolation", async () => {
    const { complete } = await startAndPay();
    const vendorAOrder = complete.body.orders.find(
      (order: { store: { id: string } }) => order.store.id === fixture.vendorA.storeId
    );
    expect(vendorAOrder).toBeTruthy();

    const packed = await api
      .patch(`/api/vendor/orders/${vendorAOrder.id}/status`)
      .set("Authorization", `Bearer ${fixture.vendorA.token}`)
      .send({ status: "packed", currentStatus: "pending" });
    expect(packed.status).toBe(200);
    expect(packed.body.order.status).toBe("packed");

    const crossVendor = await api
      .patch(`/api/vendor/orders/${vendorAOrder.id}/status`)
      .set("Authorization", `Bearer ${fixture.vendorB.token}`)
      .send({ status: "dispatched", currentStatus: "packed" });
    expect(crossVendor.status).toBe(404);

    const dispatched = await api
      .patch(`/api/vendor/orders/${vendorAOrder.id}/status`)
      .set("Authorization", `Bearer ${fixture.vendorA.token}`)
      .send({ status: "dispatched", currentStatus: "packed" });
    expect(dispatched.status).toBe(200);

    const backwards = await api
      .patch(`/api/vendor/orders/${vendorAOrder.id}/status`)
      .set("Authorization", `Bearer ${fixture.vendorA.token}`)
      .send({ status: "packed", currentStatus: "dispatched" });
    expect(backwards.status).toBe(409);
  });
});

describe("webhook", () => {
  it("fulfills a paid checkout from the durable snapshot and deduplicates events", async () => {
    await addToCart(fixture.customerA.id, fixture);
    const start = await api
      .post("/api/checkout/start")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({ checkoutId: "checkout-webhook-1" });
    expect(start.status).toBe(200);
    payment.succeed(start.body.paymentIntentId);

    const event = {
      id: "evt_test_1",
      type: "payment_intent.succeeded",
      livemode: false,
      data: {
        object: {
          id: start.body.paymentIntentId,
          metadata: { userId: fixture.customerA.id, checkoutId: "checkout-webhook-1" }
        }
      }
    } as never;

    await handleStripeEvent(event);
    expect(await Order.countDocuments()).toBe(2);
    await handleStripeEvent(event);
    expect(await Order.countDocuments()).toBe(2);
    expect(await StripeEvent.countDocuments({ eventId: "evt_test_1" })).toBe(1);
  });

  it("verifies the raw-body webhook route and returns 200 for duplicates", async () => {
    await addToCart(fixture.customerA.id, fixture);
    const start = await api
      .post("/api/checkout/start")
      .set("Authorization", `Bearer ${fixture.customerA.token}`)
      .send({ checkoutId: "checkout-webhook-route" });
    expect(start.status).toBe(200);
    payment.succeed(start.body.paymentIntentId);

    payment.webhookEvent = {
      id: "evt_test_route",
      type: "payment_intent.succeeded",
      livemode: false,
      data: {
        object: {
          id: start.body.paymentIntentId,
          metadata: { userId: fixture.customerA.id, checkoutId: "checkout-webhook-route" }
        }
      }
    } as never;

    const first = await api
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "test-signature")
      .send(JSON.stringify(payment.webhookEvent));
    expect(first.status).toBe(200);
    expect(first.body.received).toBe(true);
    expect(await Order.countDocuments()).toBe(2);

    const second = await api
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "test-signature")
      .send(JSON.stringify(payment.webhookEvent));
    expect(second.status).toBe(200);
    expect(await Order.countDocuments()).toBe(2);
    expect(await StripeEvent.countDocuments({ eventId: "evt_test_route" })).toBe(1);
  });
});

describe("admin platform owner", () => {
  it("exposes metrics and suspensions to admins only", async () => {
    const metrics = await api
      .get("/api/admin/metrics")
      .set("Authorization", `Bearer ${fixture.admin.token}`);
    expect(metrics.status).toBe(200);
    expect(metrics.body.metrics.stores).toBe(2);

    const forbidden = await api
      .get("/api/admin/metrics")
      .set("Authorization", `Bearer ${fixture.customerA.token}`);
    expect(forbidden.status).toBe(403);

    const suspend = await api
      .patch(`/api/admin/stores/${fixture.vendorA.storeId}/status`)
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .send({ isActive: false });
    expect(suspend.status).toBe(200);

    const catalogue = await api.get("/api/products");
    const storeIds = catalogue.body.items.map(
      (item: { store: { id: string } }) => item.store.id
    );
    expect(storeIds).not.toContain(fixture.vendorA.storeId);
    expect(storeIds).toContain(fixture.vendorB.storeId);

    const suspendedStoreFilter = await api.get(
      `/api/products?storeId=${fixture.vendorA.storeId}`
    );
    expect(suspendedStoreFilter.status).toBe(200);
    expect(suspendedStoreFilter.body.total).toBe(0);

    const reactivate = await api
      .patch(`/api/admin/stores/${fixture.vendorA.storeId}/status`)
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .send({ isActive: true });
    expect(reactivate.status).toBe(200);

    const suspendProduct = await api
      .patch(`/api/admin/products/${fixture.products.bananas.id}/status`)
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .send({ isActive: false });
    expect(suspendProduct.status).toBe(200);
    const afterProductSuspension = await api.get("/api/products");
    const names = afterProductSuspension.body.items.map((item: { name: string }) => item.name);
    expect(names).not.toContain("Organic Bananas");

    const coupons = await api
      .get("/api/admin/coupons")
      .set("Authorization", `Bearer ${fixture.admin.token}`);
    expect(coupons.status).toBe(200);
    expect(coupons.body.coupons).toHaveLength(1);

    const users = await api
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${fixture.admin.token}`);
    expect(users.status).toBe(200);
    expect(JSON.stringify(users.body)).not.toContain("passwordHash");
  });

  it("validates and creates coupon policy", async () => {
    const now = Date.now();
    const base = {
      scope: "platform",
      type: "percent",
      value: 15,
      minSubtotalCents: 0,
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 86_400_000).toISOString()
    };

    const created = await api
      .post("/api/admin/coupons")
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .send({ ...base, code: "SAVE15" });
    expect(created.status).toBe(201);
    expect(created.body.coupon.code).toBe("SAVE15");

    const tooLarge = await api
      .post("/api/admin/coupons")
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .send({ ...base, code: "TOOMUCH", value: 101 });
    expect(tooLarge.status).toBe(400);

    const missingStore = await api
      .post("/api/admin/coupons")
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .send({ ...base, code: "STOREONLY", scope: "store" });
    expect(missingStore.status).toBe(400);

    const deactivated = await api
      .patch(`/api/admin/coupons/${created.body.coupon.id}`)
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.coupon.isActive).toBe(false);
  });
});
