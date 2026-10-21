import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { Cart } from "../src/modules/cart/cart.model.js";
import { CartItem } from "../src/modules/cart/cartItem.model.js";
import { Coupon } from "../src/modules/promotions/coupon.model.js";
import { Product } from "../src/modules/products/product.model.js";
import { Store } from "../src/modules/stores/store.model.js";
import { Profile } from "../src/modules/users/profile.model.js";
import { User } from "../src/modules/users/user.model.js";
import { signAccessToken } from "../src/shared/auth/tokens.js";

export interface Fixture {
  admin: { id: string; token: string };
  vendorA: { id: string; token: string; storeId: string };
  vendorB: { id: string; token: string; storeId: string };
  customerA: { id: string; token: string };
  customerB: { id: string; token: string };
  products: {
    bananas: { id: string; price: number; storeId: string };
    milk: { id: string; price: number; storeId: string };
    bread: { id: string; price: number; storeId: string };
    draft: { id: string; price: number; storeId: string };
    outOfStock: { id: string; price: number; storeId: string };
  };
  couponCode: string;
}

export async function createFixture(): Promise<Fixture> {
  const passwordHash = await bcrypt.hash("Password123!", 4);
  const users = await User.create([
    { email: "admin@test.local", passwordHash, role: "admin", isVerified: true },
    { email: "vendor-a@test.local", passwordHash, role: "vendor", isVerified: true },
    { email: "vendor-b@test.local", passwordHash, role: "vendor", isVerified: true },
    { email: "customer-a@test.local", passwordHash, role: "customer", isVerified: true },
    { email: "customer-b@test.local", passwordHash, role: "customer", isVerified: true }
  ]);
  const [admin, vendorA, vendorB, customerA, customerB] = users;
  if (!admin || !vendorA || !vendorB || !customerA || !customerB) {
    throw new Error("fixture users failed");
  }
  await Profile.create(
    users.map((user) => ({ userId: user._id, displayName: user.email.split("@")[0] }))
  );

  const stores = await Store.create([
    {
      name: "Vendor A Market",
      slug: "vendor-a-market",
      userId: vendorA._id,
      description: "Produce",
      address: "1 Market St"
    },
    {
      name: "Vendor B Bakery",
      slug: "vendor-b-bakery",
      userId: vendorB._id,
      description: "Bread",
      address: "2 Mill St"
    }
  ]);
  const [storeA, storeB] = stores;
  if (!storeA || !storeB) throw new Error("fixture stores failed");

  const products = await Product.create([
    {
      name: "Organic Bananas",
      price: 50,
      unit: "bunch",
      stockQty: 20,
      isPerishable: true,
      category: "produce",
      isPublished: true,
      storeId: storeA._id,
      imageUrl: "/products/organic-bananas.svg"
    },
    {
      name: "Whole Milk",
      price: 60,
      unit: "L",
      stockQty: 10,
      isPerishable: true,
      category: "dairy",
      isPublished: true,
      storeId: storeA._id
    },
    {
      name: "Sourdough",
      price: 100,
      unit: "each",
      stockQty: 8,
      isPerishable: true,
      category: "bakery",
      isPublished: true,
      storeId: storeB._id
    },
    {
      name: "Secret Draft",
      price: 25,
      unit: "each",
      stockQty: 5,
      isPerishable: false,
      category: "pantry",
      isPublished: false,
      storeId: storeA._id
    },
    {
      name: "Sold Out",
      price: 30,
      unit: "each",
      stockQty: 0,
      isPerishable: false,
      category: "pantry",
      isPublished: true,
      storeId: storeA._id
    }
  ]);
  const [bananas, milk, bread, draft, outOfStock] = products;
  if (!bananas || !milk || !bread || !draft || !outOfStock) {
    throw new Error("fixture products failed");
  }

  const now = new Date();
  await Coupon.create({
    code: "FRESH10",
    scope: "platform",
    type: "percent",
    value: 10,
    maxDiscountCents: 500,
    minSubtotalCents: 0,
    startsAt: new Date(now.getTime() - 60_000),
    endsAt: new Date(now.getTime() + 86_400_000),
    maxRedemptionsPerUser: 3
  });

  return {
    admin: { id: admin.id, token: signAccessToken(admin.id, "admin") },
    vendorA: {
      id: vendorA.id,
      token: signAccessToken(vendorA.id, "vendor"),
      storeId: storeA.id
    },
    vendorB: {
      id: vendorB.id,
      token: signAccessToken(vendorB.id, "vendor"),
      storeId: storeB.id
    },
    customerA: { id: customerA.id, token: signAccessToken(customerA.id, "customer") },
    customerB: { id: customerB.id, token: signAccessToken(customerB.id, "customer") },
    products: {
      bananas: { id: bananas.id, price: 50, storeId: storeA.id },
      milk: { id: milk.id, price: 60, storeId: storeA.id },
      bread: { id: bread.id, price: 100, storeId: storeB.id },
      draft: { id: draft.id, price: 25, storeId: storeA.id },
      outOfStock: { id: outOfStock.id, price: 30, storeId: storeA.id }
    },
    couponCode: "FRESH10"
  };
}

export async function addToCart(
  customerId: string,
  fixture: Fixture,
  lines = [
    { productId: fixture.products.bananas.id, storeId: fixture.products.bananas.storeId, quantity: 2 },
    { productId: fixture.products.bread.id, storeId: fixture.products.bread.storeId, quantity: 1 }
  ]
) {
  await Cart.create({ userId: new Types.ObjectId(customerId), appliedCouponCode: fixture.couponCode });
  for (const line of lines) {
    await CartItem.create({
      userId: new Types.ObjectId(customerId),
      productId: new Types.ObjectId(line.productId),
      storeId: new Types.ObjectId(line.storeId),
      quantity: line.quantity
    });
  }
}
