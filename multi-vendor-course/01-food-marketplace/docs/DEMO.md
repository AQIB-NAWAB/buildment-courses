# Demo script

This is the end-to-end walkthrough to run after `npm run seed` and `npm run dev` + `npm run worker`.

## 0. Prerequisites

- API `http://localhost:5000`, web `http://localhost:5173`
- MongoDB replica set + Redis running (`npm run services:up`, `npm run db:init`)
- Stripe test keys in `server/.env` and `client/.env`
- Cloudinary keys in `server/.env`
- `stripe listen --forward-to localhost:5000/api/webhooks/stripe` running
- Worker running (`npm run worker`)

Demo accounts all use `Password123!`:

| Account | Role |
|---|---|
| `customer-a@freshmarket.local` | customer |
| `vendor-a@freshmarket.local` | vendor |
| `admin@freshmarket.local` | platform owner |

## 1. Customer purchase across two vendors

1. Open `/login`, click **Customer** in the seeded accounts panel, then **Log in**.
2. You land on the market. Note the header cart badge.
3. Open **Cart**. Customer A already has bananas from Green Valley Grocer and sourdough from Sunrise Bakery.
4. Apply **`FRESH10`**. The cart should show a discount and a server-computed total.
5. Open a product detail page and add another quantity, then return to the cart.
6. Click **Continue to checkout** → **Start secure checkout**.
   - The API reserves stock for 15 minutes and creates a Stripe Payment Intent.
7. Pay with `4242 4242 4242 4242`, any future expiry, any CVC.
8. The confirmation page shows **two orders** — one for each vendor — with the same payment reference.
9. Open **Orders**. Each order shows the frozen product name, unit, price, and total.
10. As the vendor, change the product price; refresh the customer order. The receipt does **not** change.

## 2. Vendor onboarding, products, and photos

1. Log out and log in as `vendor-b@freshmarket.local`.
2. The vendor dashboard opens for Sunrise Bakery. Try a fresh vendor account to see `/vendor/open-shop` routing.
3. Go to **Products → Add product**.
4. Create a draft with name, price, unit, category, stock, and perishable flag.
5. After saving, the edit page unlocks the photo upload. Upload a JPEG/PNG/WebP under 5 MB.
6. Publish the product; it appears on the public shop.
7. Open **Orders** and advance an order: **Mark packed**, then **Mark dispatched**. The customer sees the new status after refresh.
8. Try to edit another vendor's product via the API; it returns `403`.

## 3. Platform owner oversight

1. Log in as `admin@freshmarket.local`.
2. **Overview** shows users, active stores, products, orders, paid GMV, low stock, and reconciliation count.
3. **Stores → Suspend** Green Valley Grocer. Return to the shop; its products disappear.
4. Reactivate the store; products return.
5. **Products → Suspend** one product; it disappears from the catalogue. Reactivate it.
6. **Coupons** shows `FRESH10`, `BAKERY5`, and `ONCE24`. Deactivate `FRESH10`; the cart/checkout rejects it on the next recomputation. Reactivate it.
7. **Users** and **Orders** are read-only; no password/OTP/refresh data is present.

## 4. Isolation checks with curl

```bash
API=http://localhost:5000/api
CUST_A=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"customer-a@freshmarket.local","password":"Password123!"}' | jq -r .accessToken)
VENDOR_A=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"vendor-a@freshmarket.local","password":"Password123!"}' | jq -r .accessToken)
VENDOR_B=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"vendor-b@freshmarket.local","password":"Password123!"}' | jq -r .accessToken)

# Vendor B lists only its own products
curl -s $API/vendor/products -H "Authorization: Bearer $VENDOR_B" | jq '.products[].name'

# Customer token on vendor orders -> 403
curl -i -s $API/vendor/orders -H "Authorization: Bearer $CUST_A" | head -1

# Use a real product id from the catalogue, then attempt cross-vendor PATCH -> 403
PRODUCT=$(curl -s "$API/products?storeId=$(curl -s $API/vendor/products -H "Authorization: Bearer $VENDOR_A" | jq -r '.products[0].storeId')" | jq -r '.items[0].id')
curl -i -s -X PATCH $API/products/$PRODUCT -H "Authorization: Bearer $VENDOR_B" \
  -H 'Content-Type: application/json' -d '{"price":1}' | head -1
```

Expected: vendor B product names only, customer/vendor-order `403`, cross-vendor PATCH `403`.

## 5. Reservations and the last unit

The seeded **Last Banana** has `stockQty: 1`.

1. Log in as Customer A and Customer B in two browser profiles.
2. Add Last Banana to both carts.
3. Start checkout in both tabs nearly simultaneously.
4. One succeeds and receives a Payment Intent; the other gets `409 INSUFFICIENT_STOCK`.
5. Do not pay the successful tab. Wait for the 15-minute hold to expire (or shorten `RESERVATION_TTL_MINUTES` and restart), then run/observe the worker.
6. The product's `reservedQty` returns to 0 and `availableQty` becomes 1 again.

This is also covered automatically by the insufficient-stock integration test.

## 6. Snapshot immutability

1. Complete a paid checkout.
2. Note `priceAtPurchaseCents` on the receipt.
3. Edit the product price in the vendor dashboard.
4. Refresh the customer order. The receipt still shows the old price, name, unit, and line total.

## 7. Cache and search

1. Request the same catalogue URL twice; API logs show `CACHE MISS` then `CACHE HIT`.
2. Edit/publish a product; the catalogue version increments and the next request misses.
3. Search `?search=milk`; MongoDB's text index returns the matching product.
4. Prove the index plan: `npm run search:explain -- milk` (from the project root). The winning plan should reference `product_text_search`, not a collection scan.
5. Stop Redis (`docker compose stop redis`); the catalogue still returns `200` from MongoDB and `/health` reports `redis: "degraded"`.
6. Start Redis again; cache hits resume.

## 8. Worker and webhook

1. Complete a paid checkout with the worker running; watch for `[NOTIFY] order ...` lines in the worker terminal.
2. Stop the worker, complete another paid checkout, then start the worker; the queued job is consumed.
3. Stripe CLI shows `payment_intent.succeeded` delivered and the API returns `200`.
4. Replay the same event; no duplicate order set or redemption is created.

## 9. Build verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all pass; `client/dist/` and `server/dist/` are produced.
