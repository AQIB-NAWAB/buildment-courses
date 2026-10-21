# Challenges and decisions

Honest notes from the build, in the spirit of the course’s closing chapter.

## 1. The course chapters disagree about when orders exist

Chapter 18 creates pending orders before payment. Chapters 19, 24, and 25 require a succeeded Payment Intent before orders and stock reservations before Stripe. Implementing both literally would create unpaid orders, orphan pending rows, and two different stock rules.

I chose the stronger invariant: **no order exists before a successful payment**. At checkout start the API persists a durable `CheckoutIntent` containing the priced lines, coupon allocation, cart item IDs, reservations, and a cart fingerprint. The Stripe webhook and the client `POST /checkout` both call the same idempotent fulfillment path, which reads that snapshot rather than the live cart. This preserves the course’s snapshot and paid-only lessons while making the flow coherent. The tradeoff is one extra collection and a reconciliation state for the rare “paid after the hold expired” case.

## 2. MongoDB transactions require a replica set

Checkout, reservation confirm/release, and coupon redemption must be atomic. A standalone `mongod` rejects transactions. The local Compose setup starts MongoDB with `--replSet rs0`, and `npm run db:init` initiates it. The README documents `directConnection=true` and the Atlas alternative. CI starts its own replica set. This is a setup dependency, not a code shortcut.

## 3. Money rounding across vendors and lines

Applying a percentage independently to every line produces totals that differ by a paisa from the cart discount. The pricing service computes a single integer discount, allocates it proportionally, and gives the remainder to the largest eligible lines with a stable product-ID tie-breaker. It then asserts that line discounts sum exactly to the cart discount and that `subtotal - discount === total`. Order creation repeats the per-order invariants. Major-unit fields exist for display/course compatibility, but all authoritative math is in minor units.

## 4. Reservation expiry versus a succeeded payment

A customer can start checkout, walk away, and have the hold expire — then Stripe can still succeed. Silently creating an order would oversell; silently refunding would require a refund pipeline the course does not cover. The system marks the `CheckoutIntent` as `needs_reconciliation`, refuses to create orders, and surfaces the count to the platform owner. Automatic refunds are explicitly deferred. This is the honest failure mode rather than a hidden one.

## 5. Double-click checkout and concurrent starts

A double-click must not create two intents, two reservations, or two payments. The first version reserved stock before writing the intent, so two concurrent starts with the same `checkoutId` could race and a failed duplicate insert could release the winner’s holds. The final flow writes a unique `CheckoutIntent` placeholder first, then reserves and creates the Payment Intent. A duplicate start gets `409 CHECKOUT_IN_PROGRESS` (or the existing intent if Stripe has already been created), and stale placeholders are only cleaned up when they have no holds and are older than 60 seconds. An integration test starts the same checkout twice concurrently and asserts one intent, one reservation set, and one Payment Intent.

A different race is two customers competing for the last unit with different checkout IDs. The guarded `reservedQty` update remains the arbiter: one succeeds, one gets `409 INSUFFICIENT_STOCK`. Both races are covered by tests.

## 6. Refresh rotation and React StrictMode

The refresh token is rotated on every use and stored only as a hash. In development, React StrictMode invokes effects twice; two simultaneous refresh requests could invalidate each other. The web client uses a single-flight refresh promise, so both bootstrap effects share one network request. Multiple tabs can still race rotation; that would need a grace window or a per-session token family, which is beyond this pass.

## 7. Cache invalidation without a scan

Deleting every catalogue key on each write requires `SCAN`/`KEYS` or an index. Instead, cache keys include a version. Product, store, and admin suspension writes increment `catalogue:version`; older keys become unreachable and expire by TTL. The first version is `0`, not `1`, so the first `INCR` actually changes the key space. Redis read/write failures fall through to MongoDB rather than turning a correct query into a 500.

## 8. Stripe webhooks and Express body parsing

Stripe signatures cover the raw bytes. The webhook router is mounted before `express.json()` and applies `express.raw()` only to `/api/webhooks/stripe`. If the route were mounted after the JSON parser, signature verification would fail permanently. Webhook event IDs are stored in a `stripeevents` collection so retries converge.

## 9. Admin was not part of the course

The course says, explicitly, that there is no platform admin and that an admin panel is out of scope. The requested platform-owner flow is therefore implemented as a narrow, labeled extension: metrics, read-only orders/users, store/product suspension, and coupon policy. It cannot impersonate vendors or edit their content. This keeps the course’s isolation lesson intact while satisfying the requested third flow.

## 10. Tests need real infrastructure, but not real money

The runtime intentionally uses real Stripe/Cloudinary adapters with no mock payment fallback. Tests need to exercise checkout without moving money or requiring Cloudinary credentials, so the server accepts injected `PaymentProvider`, `QueueAdapter`, and `CacheStore` implementations. Only test code uses fakes; `server.ts` and `worker.ts` always construct the real adapters. The integration suite runs against a real MongoDB replica set and Redis.

## 11. What I would do next

- Atomic coupon pre-claims with expiry/release, rather than count-then-redeem.
- A refund/reconciliation workflow for paid-after-expiry cases.
- A transactional outbox for notification delivery (the current enqueue failure is logged, not retried from a durable outbox).
- Playwright checkout coverage against Stripe test mode.
- A real email provider for OTP and order notifications.
- Live deployment and a load/concurrency test on the reservation path.
