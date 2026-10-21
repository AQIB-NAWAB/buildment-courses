# API reference

Base URL in development: `http://localhost:5000`. Browser calls go through Vite's `/api` proxy on port 5173. Authenticated requests use `Authorization: Bearer <accessToken>`. Refresh is an httpOnly cookie scoped to `/api/auth`; `RETURN_REFRESH_TOKEN=true` also returns it in JSON for curl/tests.

## Error envelope

```json
{
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [{ "path": "price", "message": "Too small: expected number to be >0" }]
}
```

Not-found/conflict/short errors generally look like `{ "message": "...", "code": "..." }`. `details` may carry structured info such as `{ productId, available }`.

## Health

`GET /health` → `200` when MongoDB is connected, `503` otherwise.

```json
{ "status": "ok", "db": "connected", "redis": "connected", "service": "freshmarket-api" }
```

## Auth

### `POST /api/auth/register`

```json
{ "email": "new@example.com", "password": "Password123!", "role": "customer", "displayName": "New Shopper" }
```

`role` is `vendor|customer`; `admin` is rejected. Returns `201` with `userId` and, in development/test, `devOtp`. The OTP is also logged to the API console.

### `POST /api/auth/verify-otp`

```json
{ "email": "new@example.com", "otp": "123456" }
```

OTP expires after 10 minutes. Login before verification returns `403`.

### `POST /api/auth/login`

```json
{ "email": "customer-a@freshmarket.local", "password": "Password123!" }
```

Returns `accessToken`, safe `user`, and sets the refresh cookie. Wrong credentials → `401`; unverified → `403`.

### `POST /api/auth/refresh`

Uses the cookie or `{ "refreshToken": "..." }` (when enabled). Rotates the refresh token and returns a new access token.

### `POST /api/auth/logout` (JWT)

Clears the stored refresh hash and the cookie. `204`.

### `GET /api/auth/me` (JWT)

Returns safe user fields + profile display data.

## Stores

| Method/path | Auth | Body / notes |
|---|---|---|
| `GET /api/stores` | public | Active stores for filters |
| `GET /api/stores/:id` | public | Safe fields; active only |
| `POST /api/stores` | vendor | `{ name, description?, address?, logoUrl? }`; one store per vendor, `409` on duplicate |
| `GET /api/stores/me` | vendor | `404` when the vendor has not opened a shop |
| `PATCH /api/stores/:id` | vendor owner | Partial update; cross-vendor → `403` |

## Products

### Vendor

| Method/path | Body / notes |
|---|---|
| `POST /api/products` | `{ name, description?, price, unit, weightOrQuantity?, stockQty, isPerishable, category, isPublished? }`; `storeId` is resolved from the JWT, never accepted from the body |
| `GET /api/vendor/products` | All own products including drafts |
| `PATCH /api/products/:id` | Partial grocery fields + `isPublished`; cannot change `storeId` |
| `DELETE /api/products/:id` | Hard delete; past orders retain snapshots |
| `POST /api/products/:id/image` | `multipart/form-data`, field `image`, JPEG/PNG/WebP, max 5 MB; uploads to Cloudinary, replaces/deletes the previous asset |

### Public

`GET /api/products` query parameters:

| Param | Default | Notes |
|---|---|---|
| `page` | 1 | integer ≥ 1 |
| `limit` | 20 | max 100 |
| `category` | — | controlled category enum |
| `storeId` | — | valid ObjectId; invalid → 400 |
| `search` | — | MongoDB `$text` |
| `sort` | `newest` | `newest|price_asc|price_desc|name` |

Response:

```json
{
  "items": [{ "id": "...", "name": "Organic Bananas", "price": 49, "priceCents": 4900, "unit": "bunch", "availableQty": 40, "imageUrl": "/products/organic-bananas.svg", "store": { "id": "...", "name": "Green Valley Grocer" } }],
  "page": 1,
  "limit": 20,
  "total": 16,
  "totalPages": 1
}
```

Only `isPublished && isActive && stockQty - reservedQty > 0` products from active stores are returned. Drafts and out-of-stock products return `404` on detail.

## Cart

All cart routes require a customer JWT and are scoped by the token; `userId` is never accepted from the body/query.

| Method/path | Body / notes |
|---|---|
| `GET /api/cart` | `{ items, pricing, couponError? }`; grouped-ready store totals |
| `POST /api/cart` | `{ productId, storeId, quantity }`; store must match product; merges duplicate product lines; rechecks available stock |
| `PATCH /api/cart/:itemId` | `{ quantity }`; cross-user item → `404`; quantity above available → `400` |
| `DELETE /api/cart/:itemId` | `204`; cross-user item → `404` |
| `POST /api/cart/coupon` | `{ code }`; rate-limited per user+IP; generic `400 INVALID_COUPON` on ineligible codes |
| `DELETE /api/cart/coupon` | Removes the code and reprices |

Pricing response (all money in minor units):

```json
{
  "currency": "inr",
  "pricingVersion": 1,
  "subtotalCents": 21800,
  "discountCents": 400,
  "totalCents": 21400,
  "coupon": { "id": "...", "code": "FRESH10", "scope": "platform", "type": "percent", "value": 10, "storeId": null },
  "lines": [],
  "stores": []
}
```

## Checkout and payments

### `POST /api/checkout/start` (customer; alias `POST /api/payments/intent`)

```json
{ "checkoutId": "client-generated-uuid" }
```

- Recomputes pricing on the server.
- Reserves every line atomically; insufficient stock → `409 INSUFFICIENT_STOCK` with `{ productId, available }`, no Stripe call, no partial holds.
- Persists a durable `CheckoutIntent` snapshot.
- Creates a Stripe Payment Intent in minor units with metadata `{ userId, checkoutId }`.
- If Stripe fails, releases the reservations and returns `503`.
- Same `checkoutId` + same cart → returns the existing intent; changed cart or expired hold → `409`.
- A saved coupon that is no longer valid stops checkout before any stock is held: `409 COUPON_INVALID`. The client should refresh the cart preview.
- Concurrent starts with the same `checkoutId` are guarded by a unique intent placeholder. One request proceeds; the other returns `409 CHECKOUT_IN_PROGRESS` or the same intent if Stripe has already been created.

Response:

```json
{
  "checkoutId": "...",
  "paymentIntentId": "pi_...",
  "clientSecret": "pi_..._secret_...",
  "amountCents": 21400,
  "currency": "inr",
  "pricing": { }
}
```

### `POST /api/checkout` (customer)

```json
{ "paymentIntentId": "pi_..." }
```

Verifies Stripe status `succeeded`, owner/checkout/amount/currency, then fulfills from the snapshot: confirms reservations, creates one order per store, writes `paid` payment status, one CouponRedemption, clears the snapshotted cart lines, and enqueues `order.created`. First call → `201`; replay → `200` with the same orders. Missing/unpaid PI → `400/409`; expired reservation → `409` and `needs_reconciliation`.

### `POST /api/webhooks/stripe`

Raw-body, Stripe-signature only. Handles `payment_intent.succeeded`, `payment_intent.payment_failed`, and `payment_intent.canceled`; dedupes by `event.id`. It never reads the live cart.

## Orders

| Method/path | Auth | Notes |
|---|---|---|
| `GET /api/orders/my` | customer | Snapshot order history, newest first |
| `GET /api/orders/:id` | customer/vendor | Customer owner or fulfilling vendor only |
| `GET /api/vendor/orders` | vendor | Own store only, includes safe customer display data |
| `PATCH /api/vendor/orders/:orderId/status` | vendor | `{ status: "packed"|"dispatched", currentStatus? }`; only `pending→packed→dispatched`; stale → `409` |

Order DTO highlights: `store`, `status`, `paymentStatus`, `subtotalCents`, `discountCents`, `totalCents`, `couponCode`, `paidAt`, `items[]` with `nameAtPurchase`, `priceAtPurchaseCents`, `unitAtPurchase`, `quantity`, `discountCents`, `lineTotalCents`.

## Admin (course extension)

All routes require an `admin` JWT.

| Method/path | Notes |
|---|---|
| `GET /api/admin/metrics` | Users/vendors/customers/stores/products/orders/pending/GMV/low stock/reconciliation |
| `GET /api/admin/stores?page&limit&search` | Store + owner + product count |
| `PATCH /api/admin/stores/:id/status` | `{ isActive: boolean }`; hides/restores all store products in the catalogue |
| `GET /api/admin/products?page&limit&search` | Product + store + availability |
| `PATCH /api/admin/products/:id/status` | `{ isActive: boolean }`; platform suspension, no content editing |
| `GET /api/admin/orders?page&limit` | Read-only orders + customer/store summaries |
| `GET /api/admin/users?page&limit&search` | Safe identity fields only |
| `GET/PATCH /api/admin/coupons` | List/update kill switch, end window, caps |
| `POST /api/admin/coupons` | Create platform/store coupon |

## Status codes

`400` validation/empty cart/unavailable/coupon; `401` unauthenticated; `403` wrong role/ownership; `404` absent or intentionally hidden; `409` duplicate/stale/insufficient stock/checkout mismatch; `429` throttled; `503` Stripe/Cloudinary/dependency unavailable.
