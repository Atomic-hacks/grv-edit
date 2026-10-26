# Remediation and release notes — 19 October 2026

> This records completed remediation. The post-remediation review in [SECOND_AUDIT.md](SECOND_AUDIT.md) identifies additional financial and operational gaps that still require work.

This supersedes the status of the original findings in PROJECT_AUDIT.md. Changes are local and have not been deployed. No production database data was changed. A reviewed migration is now required before the corresponding application build is deployed.

The current implementation status and remaining release risks are recorded in [FINAL_AUDIT.md](FINAL_AUDIT.md).

## Implemented

| Area | Changes |
| --- | --- |
| Staff-session privacy | Private React Query requests are cancelled and private cache entries removed before publishing a different identity. Sign-out also explicitly removes private data. Public catalogue persistence remains allowlisted. Private API responses get no-store. |
| Admin permissions | Role-aware menus and dashboard links, explicit forbidden states for deep links, and restricted order lifecycle controls. Fulfilment staff can read orders for their existing fulfilment duties; shipping/cancellation lifecycle mutations remain ADMIN/OWNER-only. |
| Exports | Customer-controlled CSV values that resemble formulas or contain control characters are neutralized before CSV quoting. |
| Payment integrity | Webhook and browser verification require matching reference, successful transaction status, exact amount in minor units and NGN currency before consuming an attempt. Verification calls are bounded by timeouts. |
| Stock | Duplicate cart lines are aggregated. New attempts atomically allocate available, non-archived stock and persist the reservation in one transaction. Legacy attempts allocate atomically at finalization. Admin stock fields explicitly describe available units, excluding pending-payment holds. Insufficient inventory rolls back without a negative stock write. |
| Payment recovery | Earlier attempts are retained when another checkout starts. Browser retries reuse a stable attempt key for the same cart/address/promo request. Old attempts are verified with the provider instead of deleted. Confirmed failed/abandoned/reversed attempts release a reservation once while retaining their payload. Successful late payments can be recovered. |
| Recovery visibility | Admin → Delivery & Payments shows retained attempts, stock holds and queued emails, with an explicit recovery action. Customer checkout provides the reference and a status link on uncertain initialization. Paid attempts requiring review say not to pay again. |
| Cancellation | Order row locking prevents concurrent double-restocking. Only allowed order lifecycle transitions proceed. Cancellation and its required audit record commit together. |
| Deletion protection | Product/variant deletion locks inventory and refuses deletion when orders or retained payment attempts reference it. Archive products to preserve recovery and history. |
| Audit durability | Order status changes, role changes and product/variant deletions require their audit write in the same database transaction. Other legacy audit callers remain best effort. |
| Waitlist | Sold-out options remain selectable, notified entries can rejoin, selection survives login in the URL, success/errors are explicit, and account subscriptions can be removed. Restock outbox records are created with individual, bulk, cancellation, and payment-release inventory changes; email sends occur afterward. Admin → Waitlist shows the customer, exact option/SKU, stock, subscription state, and delivery state, with search, filters, audited removal, queued-email retry, and repair of waiting entries whose option is already in stock. Scheduled recovery retries unsent notifications; provider idempotency keys reduce duplicate delivery on concurrent/retried sends. |
| Reminders | Marketing preferences and active-account state filter recipients. Wishlist failures remain eligible for retry; success counters only advance after provider acceptance. Reminder queries are bounded. |
| Rate limits | PostgreSQL advisory transaction locks serialize count-and-insert admission per key. Storage failures block public writes by default. Waitlist joining is rate limited; old rate-limit hits are pruned in the scheduled sweep. |
| Analytics | Private journeys are excluded from explicit page views; public events omit query strings/fragments. Global location/referrer defaults are sanitized. Do Not Track and Global Privacy Control are honored. Verify enhanced-measurement settings in GA before release. |
| Navigation/accessibility | Category pagination preserves repeated filter values in URLs; network failures offer retry instead of false not-found messaging. Product navigation uses links. Filter/Browse panels trap focus, support Escape and restore focus. History navigation restores recorded scroll positions. Root category slugs cannot newly collide with application routes. |
| Error handling | Account/order customer errors render messages rather than Error objects. Invalid encoded API paths get 400. |
| Performance | Optional storefront routes are lazy loaded. Address data retains every source country/state but removes unused metadata; its JS chunk falls from about 857 kB to 429 kB (gzip 186 kB to 101 kB). Initial JS falls from about 962 kB to 878 kB (gzip 289 kB to 267 kB). These are build sizes, not real-user performance scores. |
| Deployment hygiene | Base/object/frame/form CSP restrictions are enforcing while the integration-sensitive full policy remains report-only. Public source maps are removed after Vite/Sentry upload completes. Preview and dev share API middleware. Sitemap generation loads local build configuration, validates APP_URL, preserves a compatible known-good sitemap on lookup failure and fails production when no valid fallback exists. |
| Database checks | Added `pnpm run db:check-security`, a read-only metadata check for RLS, public grants and the signup-sync trigger. It prints no customer data or credentials. |
| Refund integrity | Refund attempts are persisted in integer kobo before Paystack is called. Network and provider-server ambiguity moves the attempt to `UNKNOWN` and blocks another approval/refund. Fixed case transitions make completed refunds terminal. The order row is locked while cumulative created, pending, unknown and processed refunds are checked against Paystack's paid amount. Only ADMIN/OWNER can approve or initiate refunds. |
| Returns | A shipped order now moves to `RETURN_PENDING` without restocking. Stock is restored only when staff marks the received return `CANCELLED`. The default refund basis for a returned/cancelled shipment is the paid order total less the shipping amount captured at checkout. |
| Promotions | First-order and limited-code eligibility is reserved atomically with stock and checkout creation. Unique first-order redemption records prevent concurrent reuse; limited codes count active reservations. Terminal unpaid attempts release reservations and paid attempts mark them redeemed. |
| Shipping and tracking | Missing regional shipping configuration blocks checkout and reports an operational error. Tracking URLs are restricted to HTTP(S) at input and rendering; the migration adds a PostgreSQL check constraint for new/updated rows. Fulfilment field lengths are bounded. |
| Transaction boundaries | Case bulk changes and fulfilment single/bulk changes now commit their state, events and required audit rows together. |
| Waitlist evidence | Entries store the exact variant plus queued/sent/failed delivery state, attempts, provider message ID, last error, notification time and fulfillment time. Notifications link directly to entries. Buying a matching variant marks the entry `FULFILLED`. |
| CI | GitHub Actions now runs a frozen install, Prisma generation, all tests, lint and the production build on pushes and pull requests. |

## Verification

- Targeted unit and production-handler regression tests cover reference/amount/currency mismatches, duplicate webhook delivery, legacy inventory shortage, pre-payment reservations, uncertain and rejected initialization, idempotent browser retries, concurrent cancellation and audit rollback, account-cache isolation, export sanitization, reminder behavior, role navigation, waitlist delivery and admin management, bulk-restock notification creation, and dataset completeness.
- Tests use isolated database/provider stand-ins. They validate the actual handlers but do not replace a real PostgreSQL concurrency or Paystack integration test.
- Final verification: 141 tests across 31 files pass; ESLint, production build and `git diff --check` pass. The production artifact contains zero `.map` files. The initial bundle still emits Vite's size warning.
- Registry audit initially returned 20 advisories (15 high, 5 moderate). Compatible transitive updates reduce it to one high, with no moderate/low/critical findings. The remaining `deepmerge-ts` finding is in Prisma's configuration tooling. Its fix requires version 8, which changes behavior; this project does not feed HTTP request objects into that code. No forced major dependency override was introduced. See [the advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) and [breaking changes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0). This is a remaining finding, not a clean vulnerability scan.
- Database metadata verification could not connect (Prisma P1001), including a network-enabled attempt. Production RLS, grants and the auth trigger remain unverified.
- Browser automation was unavailable. No claim is made about visual QA, real screen-reader behavior, production payment settlement or inbox delivery.

## Release gates

1. Take and verify a restorable database backup. Apply `prisma/migrations/20261019120000_financial_integrity/migration.sql` in staging before deploying this application build. Then run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm run lint`, `pnpm run build`, and `pnpm run db:check-security`. Confirm runtime DATABASE_URL and server credentials are real, and APP_URL is the intended HTTPS origin.
2. Run two concurrent real PostgreSQL checkouts for a last-unit product and verify only one reservation succeeds. Pay it, replay its webhook, and verify one order and no second stock decrement. Check payment mismatch rejection, failed-payment release, an initialization timeout, and a late legacy payment that needs review. Test a rollback caused by audit/outbox failure.
3. Confirm recovery scheduling and function execution time for the hosting plan. The existing daily Vercel cron is preserved for plan compatibility. Recovery processes bounded batches (five payments per pass); the admin screen can run additional passes. New checkouts also attempt recovery of older contested-stock attempts. At meaningful volume, configure a more frequent authenticated recovery schedule and monitor backlog before enabling checkout traffic.
4. Unknown/provider-error payment states deliberately keep their stock hold and payment payload. They are not proof of an unpaid transaction. Staff must reconcile these references with Paystack; never manually delete attempts or release inventory based only on age. Confirm that staff can operate this workflow and that operational/Sentry alerts are configured.
5. Test waitlist join → restock → inbox, unsubscribe/remove, rejoin after another sell-out, provider failure/retry, and concurrent delivery. Resend idempotency has a provider-defined retention window and is not an unlimited exactly-once guarantee. Confirm sender-domain configuration and APP_URL.
6. In a single browser tab, test owner logout → analyst/support login and verify prior private data never appears. Test each role's navigation and order controls. Test keyboard-only panels, mobile layouts, checkout/address fields, all category pages and history navigation. Disable GA's automatic history page-view tracking/enhanced measurements as needed to preserve the explicit sanitized tracking model.
7. Deploy the reviewed artifact, verify headers and source-map absence, then perform read-only production smoke checks and monitor payment/email errors. No live deployment was performed by this remediation.

## Rollback and operational cautions

- **Do not deploy the old checkout finalizer while reserved attempts exist.** Older code decrements stock at payment completion and does not understand reservations, so it could decrement stock twice.
- To drain safely, first keep this compatible finalizer deployed and set CHECKOUT_RESERVE_STOCK=false to stop creating new reservations. Resolve/reconcile all attempts still showing Stock held = Yes (the active-hold count must reach zero). Only when that count is zero can an older inventory model be considered. Keep payment payloads and take a database backup before any recovery/rollback work.
- CHECKOUT_RESERVE_STOCK defaults to true. Disabling it preserves conditional stock allocation at finalization, but customers who pay for competing last units may require manual reconciliation. It is a rollback/drain control, not equivalent protection against collecting more payments than available inventory.
- Retained failed attempts contain delivery details in the existing private database. Define and implement a reviewed retention policy after financial reconciliation; this patch does not purge them automatically.
- A paid legacy/late checkout with unavailable stock stays recoverable and returns PAYMENT_REVIEW_REQUIRED instead of inventing stock or asking for payment again. Staff must resolve fulfilment/refund with the customer. No automatic refunds are initiated.

## Remaining work

- Staging and production checks above, including real database/provider concurrency and browser testing.
- A compatible upstream Prisma tooling update for the remaining dependency advisory.
- Full script/connect CSP enforcement after observing actual integration violations.
- Broader transactional audit coverage for remaining catalogue/customer/discount/fulfilment/case mutations.
- Product-specific server-rendered metadata and proper HTTP document 404 responses. Client page titles improve orientation, but SPA hosting still requires an SSR/prerender/edge-routing change for complete crawler behavior.
- More initial-bundle optimization and measured mobile performance; the initial bundle still produces Vite's size warning.
