# Course mapping

Source: `/home/aqib/projects/Buildment/content/import/multi-vendor-marketplace/` (FreshMarket, 25 modules + closing). Ticketline is a different course and is not used.

| Course module | Implemented in this repo | Status / notes |
|---|---|---|
| 01 Introduction | Product name, scope, actors, invariants in README/docs | Product narrative preserved; personal branding left to the owner |
| 02 Project skeleton | Root workspace, `server/`, `client/`, `docs/`, health route | Module-based server folders; Vite client; `/health` plus DB/Redis |
| 03 Why MongoDB | Mongoose models, references + embedded order lines | MongoDB is mandated by the course; the LMS itself remains relational |
| 04 Config and database | `shared/config.ts`, `db.ts`, env examples, fail-fast core config | Feature keys (Stripe/Cloudinary) return clear `503` until supplied |
| 05 Data model and seed | User/Profile/Store/Product/CartItem/Order + `scripts/seed.ts` | Added `Cart`, reservations, CheckoutIntent, coupons, events, notifications for later modules |
| 06 Authentication API | bcrypt, JWT access, opaque hashed refresh, OTP, `requireAuth` | Refresh is rotated; OTP is console/dev per course |
| 07 Login and registration | Login/register/OTP pages, in-memory access token, refresh-on-401 | Demo account quick-fill panel |
| 08 Authorization and isolation | `requireRole`, ownership helpers, `docs/AUTHORIZATION.md`, IDOR tests | 401 vs 403 rules; cross-vendor isolation tested |
| 09 Vendor store API | Store CRUD, one-store unique index, slug, `/stores/me` | Cross-vendor PATCH → 403 |
| 10 Open your shop | Onboarding page + storeless-vendor redirect | `GET /stores/me` 404 is the onboarding signal |
| 11 Manage products API | Vendor product CRUD with ownership; drafts included in vendor list | `storeId` resolved from JWT, never body |
| 12 Vendor dashboard | Dashboard stats, product table, create/edit, publish toggle | Responsive table + forms |
| 13 Product photos | Cloudinary multipart upload, 5 MB/type checks, old-asset deletion | Seed images are local SVGs; vendor uploads require Cloudinary |
| 14 Browse catalogue API | Public filters, search, pagination, populate, N+1 avoidance, 404 for draft/OOS | Visibility uses available stock and active stores |
| 15 Shop the marketplace | Shop grid, filter bar, sort, pagination, product detail | Accessible labels, empty/error/loading states |
| 16 Cart API | Persistent multi-vendor cart, stock checks, user scoping, merge-on-add | Quantity/cross-user tests |
| 17 Your cart | Grouped by store, quantity controls, remove, coupon, header count | Server-owned totals |
| 18 Checkout and orders | Split per vendor, price/name/unit snapshots, customer/vendor order views | **Adapted**: no unpaid orders; durable `CheckoutIntent` snapshot |
| 19 Payment processing | Stripe test Payment Intents, Payment Element, webhook, payment-gated fulfillment, idempotency | Stripe keys required; webhook dedupe |
| 20 Track orders | Confirmation, customer history/detail, vendor inbox, status badges/transitions | `pending → packed → dispatched` with stale `409` |
| 21 Cache and search | Redis cache-aside, versioned invalidation, text index, Mongo fallback | Redis optional for read correctness |
| 22 Async jobs and queues | BullMQ queue, separate worker, retries/backoff, deterministic job IDs, notifications, expiry sweep | Enqueue failure is logged; no outbox |
| 23 Deploy | Dockerfiles, nginx SPA fallback, CI, env inventory, deployment docs | **Live deployment execution deferred** until accounts/DNS/Stripe endpoint exist |
| 24 Inventory reservations | `StockReservation`, `reservedQty`, ATP, transactional reserve/confirm/release, expiry worker, concurrency test | Reservation starts at checkout start, before Stripe |
| 25 Promotions and pricing | Coupon/CouponRedemption, platform/store scope, percent/fixed, caps, server pricing, allocation, snapshots, rate limits | Global-cap race documented; atomic claim deferred |
| 99 Closing | README, ERD, architecture, authorization, API, demo, challenges, deferred list | Demo video/case-study recording is the owner’s deliverable |

## Deliberate deviations

| Course expectation | This implementation | Why |
|---|---|---|
| No admin role/panel | Minimal platform-owner extension | Explicit user request; clearly labeled, narrow oversight only |
| Orders created pending at checkout | Orders created only after succeeded payment, from a durable snapshot | Reconciles conflicting chapters 18/19/24/25 and protects paid-only invariant |
| `Order.subtotal/total` | Canonical `*Cents` plus compatibility major-unit fields | Prevents floating-point drift while keeping receipts readable |
| `paymentStatus` set on orders | Set to `paid` at creation | No unpaid/ghost orders; webhook/client share one idempotent path |
| Cloudinary required for images | Seed uses local SVGs; uploads use Cloudinary | Demo works without Cloudinary, while vendor uploads remain real |
| Live HTTPS deployment | Config/docs/CI only | Cannot create hosting/DNS/webhook accounts on the owner’s behalf |

## Out-of-scope course items intentionally not built

Stripe Connect/payouts, shipping/logistics, reviews/ratings, real-time WebSockets, real email delivery, mobile native apps, i18n, advanced analytics, ERP/warehouse inventory, Kafka, product variants/SKUs, weighted-counter sales, multi-currency. See [`DEFERRED.md`](DEFERRED.md).
