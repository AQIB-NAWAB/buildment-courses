# Intentionally deferred

The course is a four-week project. This repository implements the main customer, vendor, and platform-owner flows plus modules 24–25. The following are deliberately not shipped in this pass.

## Deployment and operations

- **Live HTTPS deployment** — hosting, DNS, TLS, production environment, and production Stripe webhook registration require your accounts. Dockerfiles, nginx SPA fallback, CI, env inventory, and deployment docs are included.
- **Rehearsed rollback / production smoke test** — documented as a procedure, not executed.
- **Managed MongoDB/Redis provisioning** — local Docker Compose only.

## Payments and money

- **Stripe Connect / vendor payouts** — explicitly out of course scope; the platform collects one payment per checkout.
- **Automatic refunds** when a payment succeeds after its reservation expired — the system records `needs_reconciliation` and surfaces it to the platform owner; manual resolution is required.
- **Multi-currency** — one configured currency (`CURRENCY`) and minor-unit math. The UI formats INR by default.
- **Atomic coupon global-cap claim** — validation + unique redemption indexes are implemented, but the course explicitly documents the count-then-redeem race. A production scarce-coupon system needs an atomic claim with expiry/release.
- **Tax calculation / invoicing** — not in the course.

## Identity and communication

- **Real email delivery** — OTP and notifications use console/dev output as the course permits. Resend/SendGrid is a documented extension.
- **Password reset / email change** — not in the course.
- **2FA, social login, SSO** — not in the course.
- **Per-session token families / multi-tab refresh grace** — single-flight refresh is implemented; simultaneous multi-tab rotation is not.

## Marketplace features

- **Reviews, ratings, favourites** — out of course scope.
- **Shipping, delivery slots, carrier tracking** — out of course scope; orders only have fulfilment status.
- **Real-time WebSockets / live push UI** — async jobs + console/mock notifications only; order status updates are seen on refresh.
- **Vendor analytics charts** — simple counts and paid revenue only.
- **Product variants/SKUs, barcodes, allergens, nutrition, expiry dates** — out of the course’s MVP.
- **Weighted-counter sales (500g of cheese)** — cart quantities are whole units; `unit` supports `kg`/`g` for display but does not price fractional weights.
- **Order cancellation/refund UI** — status enum includes `cancelled`, but no customer/vendor cancel workflow.
- **Soft delete / audit log** — products are hard-deleted; no audit trail.
- **Full admin CRUD / impersonation** — only minimal platform-owner oversight, by design.

## Client, testing, and content

- **Playwright browser e2e** — manual demo script + server integration tests + client unit/component tests are included. A Stripe-backed browser checkout suite is a next step.
- **Demo video and portfolio case study** — `docs/DEMO.md` and `docs/CHALLENGES.md` provide the material; recording/writing is yours.
- **i18n / RTL** — English UI only.
- **Mobile native apps** — responsive web only.
- **Course content import** — this is a standalone app; it does not import Buildment course records or LMS code.
