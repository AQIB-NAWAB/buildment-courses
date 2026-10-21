# Authorization matrix

Authentication answers **who is calling** (JWT). Authorization answers **what they may touch** (role + object ownership/scope). Middleware order is always:

`requireAuth → requireRole(...) → ownership/scope lookup → handler`

## Roles

| Role | Capabilities |
|---|---|
| anonymous | Public catalogue, product detail, public store list/detail, health, auth endpoints |
| customer | Own cart, checkout, own orders, own profile |
| vendor | Own store, own product CRUD/photo, own orders and status transitions |
| admin | Platform metrics, read-only oversight, store/product suspension, coupon policy (course extension) |

One account has one role. `admin` cannot be selected during registration; it is seed/environment-only.

## Master matrix

| Action | Route | Authn | Role | Ownership / scope | Deny |
|---|---|---|---|---|---|
| Health | `GET /health` | none | — | — | — |
| Register / verify / login / refresh | `POST /api/auth/*` | none | — | — | 400/401/409 |
| Me | `GET /api/auth/me` | JWT | any | self | 401 |
| List active stores | `GET /api/stores` | none | — | `isActive: true` | — |
| Store detail | `GET /api/stores/:id` | none | — | active only, safe fields | 404 |
| Create store | `POST /api/stores` | JWT | vendor | one per `userId` | 403/409 |
| My store | `GET /api/stores/me` | JWT | vendor | `store.userId = user.id` | 403/404 |
| Update store | `PATCH /api/stores/:id` | JWT | vendor | `store.userId = user.id` | 403/404 |
| Public catalogue | `GET /api/products` | none | — | published, active, in stock, active store | — |
| Product detail | `GET /api/products/:id` | none | — | same visibility rules | 404 |
| Create product | `POST /api/products` | JWT | vendor | `storeId` resolved from JWT, never body | 403/404 |
| Vendor products | `GET /api/vendor/products` | JWT | vendor | own store, drafts included | 403/404 |
| Update/delete product | `PATCH/DELETE /api/products/:id` | JWT | vendor | `product.storeId → store.userId` | 403/404 |
| Upload photo | `POST /api/products/:id/image` | JWT | vendor | same ownership, before Cloudinary upload | 403/404 |
| Cart read | `GET /api/cart` | JWT | customer | `{ userId }` | 403 |
| Cart add | `POST /api/cart` | JWT | customer | `userId` from JWT; body `storeId` must match product | 400/403 |
| Cart update/delete | `PATCH/DELETE /api/cart/:itemId` | JWT | customer | `{ _id, userId }`; cross-user → 404 | 404 |
| Coupon apply/remove | `POST/DELETE /api/cart/coupon` | JWT | customer | own cart, rate-limited | 400/429 |
| Start checkout | `POST /api/checkout/start` | JWT | customer | own cart, `checkoutId` bound to user | 403/409 |
| Complete checkout | `POST /api/checkout` | JWT | customer | own `CheckoutIntent`, matching PI metadata | 403/402/409 |
| Stripe webhook | `POST /api/webhooks/stripe` | Stripe signature | — | raw body + event dedupe | 400 |
| My orders | `GET /api/orders/my` | JWT | customer | `{ customerId: user.id }` | 403 |
| Order detail | `GET /api/orders/:id` | JWT | customer/vendor | owns customer OR owns fulfilling store | 403/404 |
| Vendor orders | `GET /api/vendor/orders` | JWT | vendor | `{ storeId: myStore }` | 403 |
| Update status | `PATCH /api/vendor/orders/:orderId/status` | JWT | vendor | order store = my store + conditional transition | 403/404/409 |
| Admin metrics | `GET /api/admin/metrics` | JWT | admin | — | 403 |
| Admin stores/products | `GET/PATCH /api/admin/*` | JWT | admin | platform-wide, activation only | 403 |
| Admin orders/users | `GET /api/admin/orders|users` | JWT | admin | read-only | 403 |
| Admin coupons | `GET/POST/PATCH /api/admin/coupons` | JWT | admin | policy and kill switch | 403 |

## Status-code rules

| Code | Meaning |
|---|---|
| 400 | Validation, empty cart, unavailable product, invalid coupon, missing payment field |
| 401 | Missing/invalid/expired access token; wrong login password |
| 402 | Reserved for payment failures; current implementation returns 400/409 with a payment code |
| 403 | Authenticated but wrong role, unverified login, or cross-vendor object |
| 404 | Not found, or intentionally hidden (draft/OOS product, cross-user cart line, other vendor's order) |
| 409 | Duplicate store/email, stale order transition, insufficient stock at reservation, checkout replay mismatch |
| 429 | Auth or coupon-attempt throttling |
| 503 | Stripe/Cloudinary not configured, or dependency unavailable |

`requireAuth` never returns 403; `requireRole` never returns 401 when `requireAuth` ran first.

## IDOR / isolation checklist

- [x] Vendor B PATCH Vendor A store → `403`
- [x] Vendor B PATCH/DELETE Vendor A product → `403`
- [x] Vendor B upload to Vendor A product → `403`
- [x] Vendor B PATCH Vendor A order → `404`
- [x] Customer B PATCH/delete Customer A cart line → `404`
- [x] Customer token on vendor routes → `403`
- [x] Vendor token on customer checkout/cart routes → `403`
- [x] Customer A `GET /orders/my` does not include Customer B orders
- [x] Vendor B `GET /vendor/orders` returns only Store B orders
- [x] Admin metrics/users/orders never expose password, OTP, or refresh hashes

These cases are covered by `server/tests/integration.test.ts`.
