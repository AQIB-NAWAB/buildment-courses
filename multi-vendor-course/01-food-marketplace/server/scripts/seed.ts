import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../src/shared/db.js";
import { config } from "../src/shared/config.js";
import { fromCents, toCents } from "../src/shared/money.js";
import { Coupon } from "../src/modules/promotions/coupon.model.js";
import { CouponRedemption } from "../src/modules/promotions/couponRedemption.model.js";
import { Cart } from "../src/modules/cart/cart.model.js";
import { CartItem } from "../src/modules/cart/cartItem.model.js";
import { CheckoutIntent } from "../src/modules/checkout/checkoutIntent.model.js";
import { StockReservation } from "../src/modules/inventory/stockReservation.model.js";
import { Notification } from "../src/modules/notifications/notification.model.js";
import { Order } from "../src/modules/orders/order.model.js";
import { Product } from "../src/modules/products/product.model.js";
import { Store } from "../src/modules/stores/store.model.js";
import { Profile } from "../src/modules/users/profile.model.js";
import { User } from "../src/modules/users/user.model.js";
import { StripeEvent } from "../src/modules/webhooks/stripeEvent.model.js";

const PASSWORD = "Password123!";

interface SeedProduct {
  name: string;
  description: string;
  price: number;
  unit: "each" | "bunch" | "kg" | "g" | "L" | "ml" | "pack";
  weightOrQuantity?: number;
  stockQty: number;
  isPerishable: boolean;
  category: "produce" | "dairy" | "bakery" | "pantry" | "frozen" | "beverages" | "household";
  isPublished: boolean;
  image: string;
}

const PRODUCTS: Record<string, SeedProduct[]> = {
  "green-valley-grocer": [
    { name: "Organic Bananas", description: "Fairtrade bananas, sold by the bunch.", price: 49, unit: "bunch", weightOrQuantity: 1, stockQty: 40, isPerishable: true, category: "produce", isPublished: true, image: "organic-bananas" },
    { name: "Vine Tomatoes", description: "Deep red tomatoes from a local poly-tunnel.", price: 89, unit: "kg", weightOrQuantity: 1, stockQty: 25, isPerishable: true, category: "produce", isPublished: true, image: "vine-tomatoes" },
    { name: "Baby Spinach", description: "Tender leaves, washed and ready.", price: 35, unit: "bunch", weightOrQuantity: 1, stockQty: 18, isPerishable: true, category: "produce", isPublished: true, image: "baby-spinach" },
    { name: "Whole Milk 1L", description: "Creamy whole milk from a nearby dairy.", price: 65, unit: "L", weightOrQuantity: 1, stockQty: 30, isPerishable: true, category: "dairy", isPublished: true, image: "whole-milk" },
    { name: "Free-range Eggs (6)", description: "Six large eggs from pasture-raised hens.", price: 75, unit: "pack", weightOrQuantity: 6, stockQty: 22, isPerishable: true, category: "dairy", isPublished: true, image: "free-range-eggs" },
    { name: "Basmati Rice 1kg", description: "Long-grain rice for everyday meals.", price: 145, unit: "pack", weightOrQuantity: 1000, stockQty: 50, isPerishable: false, category: "pantry", isPublished: true, image: "basmati-rice" },
    { name: "Cold-pressed Olive Oil", description: "Peppery finishing oil in a dark bottle.", price: 420, unit: "ml", weightOrQuantity: 500, stockQty: 12, isPerishable: false, category: "pantry", isPublished: true, image: "olive-oil" },
    { name: "Frozen Peas 500g", description: "Sweet garden peas, frozen at harvest.", price: 95, unit: "pack", weightOrQuantity: 500, stockQty: 0, isPerishable: false, category: "frozen", isPublished: true, image: "frozen-peas" },
    { name: "Last Banana", description: "Demo product for the reservation race test.", price: 20, unit: "each", stockQty: 1, isPerishable: true, category: "produce", isPublished: true, image: "last-banana" }
  ],
  "sunrise-bakery": [
    { name: "Sourdough Loaf", description: "Slow-fermented, crackling crust.", price: 120, unit: "each", stockQty: 14, isPerishable: true, category: "bakery", isPublished: true, image: "sourdough-loaf" },
    { name: "Seeded Rye", description: "Dense rye with sunflower and sesame.", price: 140, unit: "each", stockQty: 9, isPerishable: true, category: "bakery", isPublished: true, image: "seeded-rye" },
    { name: "Butter Croissants (4)", description: "Laminated with cultured butter.", price: 160, unit: "pack", weightOrQuantity: 4, stockQty: 10, isPerishable: true, category: "bakery", isPublished: true, image: "butter-croissants" },
    { name: "Cinnamon Buns (2)", description: "Soft buns with a glossy cinnamon glaze.", price: 110, unit: "pack", weightOrQuantity: 2, stockQty: 8, isPerishable: true, category: "bakery", isPublished: false, image: "cinnamon-buns" },
    { name: "Wholemeal Flour 1kg", description: "Stone-ground wholemeal flour.", price: 95, unit: "pack", weightOrQuantity: 1000, stockQty: 20, isPerishable: false, category: "pantry", isPublished: true, image: "wholemeal-flour" }
  ],
  "spice-corner": [
    { name: "Kashmiri Chilli Powder", description: "Bright colour, gentle heat.", price: 85, unit: "g", weightOrQuantity: 100, stockQty: 30, isPerishable: false, category: "pantry", isPublished: true, image: "chilli-powder" },
    { name: "Coriander Seeds", description: "Whole seeds, toasted for depth.", price: 60, unit: "g", weightOrQuantity: 100, stockQty: 28, isPerishable: false, category: "pantry", isPublished: true, image: "coriander-seeds" },
    { name: "Masala Chai Blend", description: "Black tea with cardamom, clove, and ginger.", price: 210, unit: "g", weightOrQuantity: 250, stockQty: 16, isPerishable: false, category: "beverages", isPublished: true, image: "masala-chai" },
    { name: "Cold Brew Coffee", description: "Smooth, low-acid cold brew concentrate.", price: 280, unit: "ml", weightOrQuantity: 500, stockQty: 7, isPerishable: true, category: "beverages", isPublished: true, image: "cold-brew" },
    { name: "Dish Soap", description: "Plant-based lemon dish soap.", price: 150, unit: "ml", weightOrQuantity: 500, stockQty: 24, isPerishable: false, category: "household", isPublished: true, image: "dish-soap" }
  ]
};

async function clearData() {
  await Promise.all([
    CouponRedemption.deleteMany({}),
    StripeEvent.deleteMany({}),
    Notification.deleteMany({}),
    Order.deleteMany({}),
    StockReservation.deleteMany({}),
    CheckoutIntent.deleteMany({}),
    CartItem.deleteMany({}),
    Cart.deleteMany({}),
    Product.deleteMany({}),
    Store.deleteMany({}),
    Profile.deleteMany({}),
    User.deleteMany({}),
    Coupon.deleteMany({})
  ]);
}

async function main() {
  if (config.isProduction && !config.allowSeed) {
    throw new Error("Refusing to seed production. Set ALLOW_SEED=true if this is intentional.");
  }

  await connectDatabase();
  await clearData();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = await User.create([
    { email: "admin@freshmarket.local", passwordHash, role: "admin", isVerified: true },
    { email: "vendor-a@freshmarket.local", passwordHash, role: "vendor", isVerified: true },
    { email: "vendor-b@freshmarket.local", passwordHash, role: "vendor", isVerified: true },
    { email: "vendor-c@freshmarket.local", passwordHash, role: "vendor", isVerified: true },
    { email: "customer-a@freshmarket.local", passwordHash, role: "customer", isVerified: true },
    { email: "customer-b@freshmarket.local", passwordHash, role: "customer", isVerified: true }
  ]);

  const [admin, vendorA, vendorB, vendorC, customerA, customerB] = users;
  if (!admin || !vendorA || !vendorB || !vendorC || !customerA || !customerB) {
    throw new Error("Seed users failed");
  }

  await Profile.create([
    { userId: admin._id, displayName: "Market Admin" },
    { userId: vendorA._id, displayName: "Aisha — Green Valley Grocer" },
    { userId: vendorB._id, displayName: "Ben — Sunrise Bakery" },
    { userId: vendorC._id, displayName: "Chitra — Spice Corner" },
    { userId: customerA._id, displayName: "Customer A" },
    { userId: customerB._id, displayName: "Customer B" }
  ]);

  const stores = await Store.create([
    {
      name: "Green Valley Grocer",
      slug: "green-valley-grocer",
      description: "Fruit, vegetables, dairy, and pantry staples from local growers.",
      address: "12 Market Lane",
      userId: vendorA._id
    },
    {
      name: "Sunrise Bakery",
      slug: "sunrise-bakery",
      description: "Slow-fermented bread and morning pastries, baked before dawn.",
      address: "4 Mill Street",
      userId: vendorB._id
    },
    {
      name: "Spice Corner",
      slug: "spice-corner",
      description: "Whole spices, tea, coffee, and everyday kitchen essentials.",
      address: "88 Bazaar Road",
      userId: vendorC._id
    }
  ]);

  const productsByStore = new Map<string, Map<string, InstanceType<typeof Product>>>();
  for (const store of stores) {
    const catalog = PRODUCTS[store.slug] ?? [];
    const created = new Map<string, InstanceType<typeof Product>>();
    for (const item of catalog) {
      const product = await Product.create({
        name: item.name,
        description: item.description,
        price: item.price,
        unit: item.unit,
        weightOrQuantity: item.weightOrQuantity ?? null,
        stockQty: item.stockQty,
        isPerishable: item.isPerishable,
        category: item.category,
        isPublished: item.isPublished,
        imageUrl: `/products/${item.image}.svg`,
        storeId: store._id
      });
      created.set(item.name, product);
    }
    productsByStore.set(store.slug, created);
  }

  const now = new Date();
  await Coupon.create([
    {
      code: "FRESH10",
      scope: "platform",
      type: "percent",
      value: 10,
      maxDiscountCents: 400,
      minSubtotalCents: 1_000,
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1_000),
      maxRedemptionsPerUser: 3
    },
    {
      code: "BAKERY5",
      scope: "store",
      storeId: stores[1]?._id,
      type: "fixed_cents",
      value: 500,
      minSubtotalCents: 2_000,
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1_000),
      maxRedemptionsPerUser: 1
    },
    {
      code: "ONCE24",
      scope: "platform",
      type: "fixed_cents",
      value: 2_400,
      minSubtotalCents: 5_000,
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000),
      maxRedemptionsPerUser: 1
    }
  ]);

  const cart = await Cart.create({ userId: customerA._id, appliedCouponCode: "FRESH10" });
  const greenValley = stores[0]!;
  const sunrise = stores[1]!;
  const spice = stores[2]!;
  function requireProduct(slug: string, name: string) {
    const product = productsByStore.get(slug)?.get(name);
    if (!product) throw new Error(`Missing seed product ${name} in ${slug}`);
    return product;
  }

  const bananas = requireProduct("green-valley-grocer", "Organic Bananas");
  const milk = requireProduct("green-valley-grocer", "Whole Milk 1L");
  const sourdough = requireProduct("sunrise-bakery", "Sourdough Loaf");
  const rice = requireProduct("green-valley-grocer", "Basmati Rice 1kg");
  const chai = requireProduct("spice-corner", "Masala Chai Blend");
  const tomatoes = requireProduct("green-valley-grocer", "Vine Tomatoes");

  await CartItem.create([
    { userId: customerA._id, productId: bananas._id, storeId: greenValley._id, quantity: 2 },
    { userId: customerA._id, productId: sourdough._id, storeId: sunrise._id, quantity: 1 }
  ]);

  const orderSpecs = [
    {
      customerId: customerA._id,
      storeId: greenValley._id,
      checkoutId: "seed-checkout-1",
      status: "pending" as const,
      storeName: greenValley.name,
      products: [
        { product: bananas, quantity: 2 },
        { product: milk, quantity: 1 }
      ]
    },
    {
      customerId: customerA._id,
      storeId: sunrise._id,
      checkoutId: "seed-checkout-1",
      status: "packed" as const,
      storeName: sunrise.name,
      products: [{ product: sourdough, quantity: 1 }]
    },
    {
      customerId: customerA._id,
      storeId: greenValley._id,
      checkoutId: "seed-checkout-2",
      status: "dispatched" as const,
      storeName: greenValley.name,
      products: [{ product: rice, quantity: 1 }]
    },
    {
      customerId: customerB._id,
      storeId: spice._id,
      checkoutId: "seed-checkout-3",
      status: "pending" as const,
      storeName: spice.name,
      products: [{ product: chai, quantity: 1 }]
    },
    {
      customerId: customerB._id,
      storeId: greenValley._id,
      checkoutId: "seed-checkout-4",
      status: "pending" as const,
      storeName: greenValley.name,
      products: [{ product: tomatoes, quantity: 1 }]
    }
  ];

  let orderIndex = 0;
  for (const spec of orderSpecs) {
    orderIndex += 1;
    const items = spec.products.map(({ product, quantity }) => {
      const priceCents = toCents(product.price);
      const lineSubtotalCents = priceCents * quantity;
      return {
        productId: product._id,
        nameAtPurchase: product.name,
        unitAtPurchase: product.unit,
        quantity,
        priceAtPurchase: product.price,
        priceAtPurchaseCents: priceCents,
        lineSubtotalCents,
        discountCents: 0,
        lineTotalCents: lineSubtotalCents,
        lineTotal: fromCents(lineSubtotalCents)
      };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
    await Order.create({
      customerId: spec.customerId,
      storeId: spec.storeId,
      checkoutId: spec.checkoutId,
      status: spec.status,
      paymentStatus: "paid",
      stripePaymentIntentId: `pi_seed_${orderIndex}`,
      orderItems: items,
      subtotalCents,
      discountCents: 0,
      totalCents: subtotalCents,
      subtotal: fromCents(subtotalCents),
      discountTotal: 0,
      total: fromCents(subtotalCents),
      pricingVersion: 1,
      paidAt: new Date(now.getTime() - orderIndex * 60 * 60 * 1_000)
    });
    for (const { product, quantity } of spec.products) {
      await Product.updateOne(
        { _id: product._id },
        [{ $set: { stockQty: { $max: [0, { $subtract: ["$stockQty", quantity] }] } } }]
      );
    }
  }

  await Notification.create([
    {
      userId: vendorA._id,
      type: "order.created",
      title: "New order",
      body: "You received a new order for seeded demo data.",
      orderId: (await Order.findOne({ storeId: greenValley._id }))?._id
    },
    {
      userId: customerA._id,
      type: "order.created",
      title: "Order confirmed",
      body: "Your seeded order is confirmed.",
      orderId: (await Order.findOne({ customerId: customerA._id }))?._id
    }
  ]);

  await Promise.all([
    User.syncIndexes(),
    Profile.syncIndexes(),
    Store.syncIndexes(),
    Product.syncIndexes(),
    Cart.syncIndexes(),
    CartItem.syncIndexes(),
    Order.syncIndexes(),
    StockReservation.syncIndexes(),
    CheckoutIntent.syncIndexes(),
    Coupon.syncIndexes(),
    CouponRedemption.syncIndexes(),
    StripeEvent.syncIndexes(),
    Notification.syncIndexes()
  ]);

  console.log("Seeded FreshMarket demo data.");
  console.log("Accounts (password: Password123!):");
  console.log("  admin@freshmarket.local       platform owner");
  console.log("  vendor-a@freshmarket.local    Green Valley Grocer");
  console.log("  vendor-b@freshmarket.local    Sunrise Bakery");
  console.log("  vendor-c@freshmarket.local    Spice Corner");
  console.log("  customer-a@freshmarket.local  cart + order history");
  console.log("  customer-b@freshmarket.local  order history");
  console.log(`  ${stores.length} stores, ${await Product.countDocuments()} products, ${await Coupon.countDocuments()} coupons`);
  console.log(`  customer A cart: ${await CartItem.countDocuments({ userId: customerA._id })} lines, coupon ${cart.appliedCouponCode}`);

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
