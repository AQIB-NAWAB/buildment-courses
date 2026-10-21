# FreshMarket — Buildment Multi-Vendor Marketplace

A course-aligned implementation of the **FreshMarket — Multi-Vendor Grocery Marketplace** project from the Buildment course at:

`/home/aqib/projects/Buildment/content/import/multi-vendor-marketplace/`

This is a **separate repository** from the Buildment LMS. It does not import, modify, or copy Buildment application code, secrets, or unrelated assets. The only Buildment material used is the public course content (requirements, milestones, and teaching sequence).

FreshMarket is a local grocery marketplace where independent shops sell through one platform. A customer can fill one cart with products from several vendors, pay once with Stripe test mode, and receive **one order per vendor** with prices frozen at purchase time. Vendors see only their own store, products, and orders. A minimal platform-owner extension adds oversight without turning into a super-user.

---

## Stack

| Layer | Choice |
|---|---|
| API | Node.js 20.19+ · Express 5 · TypeScript strict · Mongoose 8 · Zod |
| Web | React 19 · Vite · TypeScript · Tailwind CSS 4 · TanStack Query · React Hook Form |
| Data | MongoDB 7 (single-node replica set for transactions) · Redis 7 |
| Payments | Stripe test mode (Payment Intents + Payment Element + signed webhook) |
| Images | Cloudinary |
| Jobs | BullMQ (`notifications` queue + separate worker) |
| Tests | Vitest · Supertest · Testing Library |
| Tooling | npm workspaces · ESLint flat config · Prettier · GitHub Actions |

Ports: **API 5000**, **client 5173**.

---

## What is implemented

### Customer
- Register, verify email with a 6-digit OTP, log in, refresh sessions, log out.
- Browse the public catalogue with category/store filters, full-text search, sorting, and pagination.
- Product detail with stock, unit, pack size, and store.
- Persistent multi-vendor cart with quantity controls, removal, grouped-by-store display, and a header count.
- Coupon validation and server-owned pricing (`FRESH10`, `BAKERY5`, `ONCE24` seeded).
- Checkout that reserves stock, creates a Stripe Payment Intent, confirms payment with Stripe Elements, and creates one order per vendor.
- Immutable order history with price/name/unit snapshots and fulfilment status.

### Vendor
- One-store-per-vendor onboarding and a storeless-vendor routing gate.
- Store settings.
- Product CRUD with grocery fields (`unit`, `weightOrQuantity`, `stockQty`, `isPerishable`, `category`).
- Draft/publish toggle and platform-suspension awareness.
- Cloudinary product photo upload with replacement cleanup.
- Dashboard with product, stock, order, and paid-revenue summaries.
- Vendor order inbox scoped to the authenticated store, with `pending → packed → dispatched` transitions and stale-update protection.

### Platform owner (documented course extension)
- Metrics: users, vendors, customers, stores, products, orders, pending fulfilment, paid GMV, low stock, reconciliation count.
- Read-only orders and users.
- Suspend/reactivate stores and individual products. Suspended inventory disappears from the public catalogue and cannot be purchased.
- Coupon creation and a kill switch.
- No vendor impersonation, no editing vendor content, no password/hash exposure.

### Platform behavior
- JWT access token in memory; opaque refresh token hashed in MongoDB, rotated on refresh, delivered as an httpOnly cookie.
- Role and ownership checks with `401` vs `403` separation and cross-vendor IDOR tests.
- Redis cache-aside for the public catalogue with versioned invalidation and graceful MongoDB fallback.
- MongoDB text index (`product_text_search`) for search.
- Stock reservations with `reservedQty`, available-to-promise serialization, transactional confirm/release, and a 60-second expiry sweep.
- Checkout idempotency by `checkoutId` and Payment Intent; unique `{stripePaymentIntentId, storeId}` orders.
- Coupon pricing in integer minor units with proportional line allocation and discount snapshots.
- Stripe webhook raw-body signature verification and event dedupe.
- Notification jobs after paid checkout and status changes; a separate worker process with retries/backoff and deterministic job IDs.

---

## Prerequisites

- Node.js **20.19+** (Node 22/24 works)
- npm 10+
- Docker (for local MongoDB and Redis)
- A **Stripe test-mode** secret key and publishable key
- A **Cloudinary** cloud name, API key, and API secret

Browsing, auth, cart, and admin flows work without Stripe/Cloudinary keys. Payment start returns a clear `503` until Stripe is configured; photo upload returns `503` until Cloudinary is configured. This is intentional — the project uses **real services, no runtime mock payment or fake image storage**.

---

## Quick start

```bash
# from the repository root
cd multi-vendor-course/01-food-marketplace

# 1. Install (include dev deps even if your shell has NODE_ENV=production)
npm install --include=dev

# 2. Create local env files
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env`:

```bash
# Generate two independent secrets
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>

# Stripe test mode
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from stripe listen (local)

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Edit `client/.env`:

```bash
VITE_API_URL=                       # empty in dev; Vite proxies /api to :5000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_SHOW_DEMO_ACCOUNTS=true
```

Start the data plane and seed:

```bash
npm run services:up                 # MongoDB 7 + Redis 7
npm run db:init                     # initiates single-node replica set rs0 (transactions)
npm run seed                        # demo stores, products, coupons, orders
```

Run the app (two terminals):

```bash
# terminal 1
npm run dev                         # API :5000 + Vite :5173

# terminal 2
npm run worker                      # BullMQ worker + inventory expiry sweep
```

Open **http://localhost:5173**.

### Stripe webhook locally

```bash
stripe login
stripe listen --forward-to localhost:5000/api/webhooks/stripe
# copy the printed whsec_... into server/.env, then restart the API
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any postal code.

### Demo accounts

All seeded accounts use password **`Password123!`**.

| Email | Role | What to explore |
|---|---|---|
| `customer-a@freshmarket.local` | customer | Two-store cart, coupon, order history |
| `customer-b@freshmarket.local` | customer | Empty cart, seeded order history |
| `vendor-a@freshmarket.local` | vendor | Green Valley Grocer |
| `vendor-b@freshmarket.local` | vendor | Sunrise Bakery |
| `vendor-c@freshmarket.local` | vendor | Spice Corner |
| `admin@freshmarket.local` | platform owner | Metrics, moderation, coupons |

The login page can fill a demo account for you when `VITE_SHOW_DEMO_ACCOUNTS=true`.

---

## Environment variables

### `server/.env`

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | yes | `development` / `test` / `production` |
| `PORT` | no | API port, default `5000` |
| `CLIENT_ORIGIN` | yes | Exact browser origin for CORS/credentials, e.g. `http://localhost:5173` |
| `MONGODB_URI` | yes | Replica-set connection string; transactions require it |
| `REDIS_URL` | yes | Cache, coupon throttling, BullMQ |
| `JWT_ACCESS_SECRET` | yes | Access-token signing secret |
| `JWT_REFRESH_SECRET` | yes | Reserved for refresh-token hardening |
| `ACCESS_TOKEN_TTL` | no | Default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | no | Default `7` |
| `RETURN_REFRESH_TOKEN` | no | `true` only for non-cookie API clients/tests |
| `COOKIE_SECURE` | no | Defaults to true in production |
| `CURRENCY` | no | Default `inr`; Stripe amounts use minor units (paise) |
| `STRIPE_SECRET_KEY` | for payment | Stripe **test-mode** secret |
| `STRIPE_WEBHOOK_SECRET` | for webhook | Signing secret for the local/production endpoint |
| `CLOUDINARY_*` | for uploads | Cloud name, API key, API secret |
| `RESERVATION_TTL_MINUTES` | no | Default `15` |
| `CATALOGUE_CACHE_TTL_SECONDS` | no | Default `300` |
| `ALLOW_SEED` | no | Required `true` to seed when `NODE_ENV=production` |

### `client/.env`

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | no | Empty in dev (Vite proxy); full HTTPS API origin in production |
| `VITE_STRIPE_PUBLISHABLE_KEY` | for payment | Stripe test publishable key (`pk_test_...`) |
| `VITE_SHOW_DEMO_ACCOUNTS` | no | `true` in local dev, `false` publicly |

`VITE_*` values are embedded in browser JavaScript. Never put a secret key, database URL, or webhook signing secret in a `VITE_*` variable.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run services:up` | Start MongoDB + Redis via Docker |
| `npm run services:down` | Stop the local data plane |
| `npm run db:init` | Initiate the `rs0` replica set if needed |
| `npm run seed` | Clear/reseed development data, indexes, and demo accounts |
| `npm run search:explain -- rice` | Print the MongoDB winning plan/execution stats for text search |
| `npm run dev` | API + web app together |
| `npm run worker` | Separate BullMQ worker/expiry process |
| `npm run build` | Compile server and build the client |
| `npm start` | Run the compiled API |
| `npm run typecheck` | TypeScript for both workspaces |
| `npm run lint` | ESLint for both workspaces |
| `npm test` | Server integration tests + client unit/component tests |
| `npm run check` | Typecheck → lint → test → build |
| `npm run format` | Prettier write |

Server tests use a dedicated `freshmarket_test` database. They expect the local replica set and Redis to be running; CI starts both. Runtime adapters are real; tests inject a fake payment provider and in-memory cache/queue only.

---

## Project structure

```
multi-vendor-course/01-food-marketplace/
├── server/
│   ├── src/
│   │   ├── app.ts                 # createApp: middleware order, routers, health
│   │   ├── server.ts              # API boot + graceful shutdown
│   │   ├── worker.ts              # BullMQ worker + inventory expiry scheduler
│   │   ├── modules/
│   │   │   ├── auth/              # JWT, refresh rotation, OTP, guards
│   │   │   ├── users/             # User + Profile models
│   │   │   ├── stores/            # one store per vendor
│   │   │   ├── products/          # vendor CRUD, public catalogue, upload
│   │   │   ├── cart/              # persistent multi-vendor cart
│   │   │   ├── pricing/           # coupons, integer-cent totals, allocation
│   │   │   ├── inventory/         # reservations, ATP, expiry
│   │   │   ├── checkout/          # durable snapshot, Stripe, fulfillment
│   │   │   ├── payments/          # Stripe adapter surface
│   │   │   ├── orders/            # split orders, snapshots, statuses
│   │   │   ├── promotions/        # Coupon + CouponRedemption
│   │   │   ├── admin/             # minimal platform owner
│   │   │   ├── notifications/     # job processors + Notification records
│   │   │   └── webhooks/          # raw Stripe webhook + event dedupe
│   │   └── shared/                # config, db, redis, cache, queue, adapters
│   ├── scripts/seed.ts
│   └── tests/                     # integration + fixtures/fakes
├── client/
│   ├── public/products/*.svg      # seeded local product artwork
│   └── src/
│       ├── api/                   # fetch wrapper, refresh-on-401, query hooks
│       ├── components/            # layout, cards, filters, badges, upload
│       ├── context/               # auth + toasts
│       ├── pages/                 # auth, shop, customer, vendor, admin
│       └── routes/guards.tsx
├── docs/                          # ERD, auth matrix, architecture, API, demo
├── docker-compose.yml
├── .github/workflows/ci.yml
└── README.md
```

---

## API overview

Base path `/api`; health is `GET /health`.

| Area | Routes |
|---|---|
| Auth | `POST /auth/register`, `/verify-otp`, `/login`, `/refresh`, `/logout`, `GET /auth/me` |
| Stores | `GET /stores`, `GET /stores/:id`, `POST /stores`, `GET /stores/me`, `PATCH /stores/:id` |
| Products | `POST /products`, `GET /vendor/products`, `PATCH/DELETE /products/:id`, `POST /products/:id/image`, `GET /products`, `GET /products/:id` |
| Cart | `GET/POST /cart`, `PATCH/DELETE /cart/:itemId`, `POST/DELETE /cart/coupon` |
| Checkout | `POST /checkout/start`, `POST /payments/intent` (alias), `POST /checkout` |
| Webhook | `POST /webhooks/stripe` |
| Orders | `GET /orders/my`, `GET /orders/:id`, `GET /vendor/orders`, `PATCH /vendor/orders/:orderId/status` |
| Admin | `GET /admin/metrics`, `GET/PATCH /admin/stores`, `GET/PATCH /admin/products`, `GET /admin/orders`, `GET /admin/users`, `GET/POST/PATCH /admin/coupons` |

See [`docs/API.md`](docs/API.md) for payloads and status codes.

---

## Core invariants

1. **Ownership chain**: `User (vendor) → Store → Product → CartItem → Order`, with order lines embedded as snapshots.
2. **One store per vendor** and one cart line per customer/product.
3. **Vendor isolation**: cross-vendor store/product/order access returns `403` (or `404` where non-existence is safer). Tested.
4. **No unpaid orders**: checkout start creates a durable `CheckoutIntent` + stock reservation; orders are created only from that snapshot after Stripe reports `succeeded`.
5. **Immutable receipts**: `nameAtPurchase`, `priceAtPurchase`, `unitAtPurchase`, `lineTotalCents`, discounts, and coupon snapshots never change when catalogues or coupons change.
6. **Atomic inventory**: guarded `reservedQty` updates and transactional confirm/release. A failed line rolls back the whole reservation; an expired hold never decrements on-hand stock.
7. **Idempotency**: one `checkoutId` → one Payment Intent; one Payment Intent + store → one order; one coupon + checkout → one redemption; webhook event IDs are deduplicated.
8. **Server-owned money**: the client never submits prices or totals. Integer minor units are canonical; compatibility major-unit fields are derived.
9. **Cache is optional for correctness**: Redis failures fall through to MongoDB; catalogue writes bump a version so stale responses are not served.
10. **Secrets stay server-side**: only placeholders in `.env.example`; no Buildment credentials copied.

---

## Testing and verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The server suite covers auth/OTP/refresh, catalogue visibility/search/filters, vendor isolation/IDOR, cart scoping, coupon pricing, split checkout, snapshots, reservations, insufficient stock, idempotent replay, webhook dedupe, vendor status transitions, and admin suspension. Client tests cover money/status formatting, form validation, and accessible status labels.

Manual demo: [`docs/DEMO.md`](docs/DEMO.md).

---

## Deployment

Dockerfiles are included for the API/worker and the static client, plus an nginx SPA fallback and CI workflow. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the deploy shape and required environment inventory.

The API and worker are separate processes and must share the same `REDIS_URL`, `MONGODB_URI` (if processors read orders), queue names, and deployed revision. The client needs a **build-time** `VITE_API_URL`; changing that value after build has no effect. Production refresh cookies use `SameSite=None; Secure`, so use HTTPS for both origins and set `CLIENT_ORIGIN` exactly.

Actual live deployment is **deferred until you provide hosting/DNS/Stripe webhook accounts**. Nothing in this repo creates external infrastructure.

---

## Course alignment and deliberate decisions

- **Source of truth**: the FreshMarket course outline and build chapters, not Ticketline and not the LMS’s own FreshMarket database records.
- **Admin is an extension**: the course explicitly says *“There is no platform admin in this course”* and lists an admin panel as out of scope. The minimal platform owner is implemented because you requested it, and is labeled as an extension in the UI and docs.
- **Checkout chapter reconciliation**: chapter 18 creates pending orders before payment; chapters 19, 24, and 25 require payment before orders and reservations before Stripe. This implementation follows the stronger paid-only invariant: a durable priced `CheckoutIntent` is created at checkout start, and orders are created from that snapshot only after payment succeeds.
- **Money**: integer minor units are canonical. The API also exposes `priceAtPurchase`, `subtotal`, `total`, and `lineTotal` for course/readability compatibility.
- **Deployment**: configuration and documentation are included; a live HTTPS deployment is not possible without your accounts.

See [`docs/COURSE-MAPPING.md`](docs/COURSE-MAPPING.md) for chapter-by-chapter coverage and [`docs/DEFERRED.md`](docs/DEFERRED.md) for the explicit deferral list.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Transactions fail / `Transaction numbers are only allowed on a replica set member` | Run `npm run services:up && npm run db:init`; confirm `MONGODB_URI` has `replicaSet=rs0&directConnection=true` |
| API boots but catalogue cache never HITs | Check Redis: `docker compose ps`; `/health` shows `redis` status |
| Checkout returns `503 Stripe is not configured` | Add `STRIPE_SECRET_KEY`; restart the API |
| Photo upload returns `503 Cloudinary is not configured` | Add all three `CLOUDINARY_*` values; restart the API |
| Stripe webhook signature fails | Mount order is already correct; make sure `STRIPE_WEBHOOK_SECRET` matches the endpoint/CLI session and restart |
| Login works in curl but not the browser | Check `CLIENT_ORIGIN`, credentials/CORS, HTTPS, and the production `SameSite=None; Secure` cookie policy |
| Tests fail with `React.act is not a function` | The shell has `NODE_ENV=production`; the workspace test scripts use `cross-env NODE_ENV=test`, or run `NODE_ENV=test npm test` |
| Deep link 404 on a static host | Configure SPA fallback to `index.html` (see `client/nginx.conf`) |
