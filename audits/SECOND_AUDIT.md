# GRVHQ second production audit — 19 October 2026

## Executive assessment

The earlier remediation materially improved checkout inventory safety, waitlist reliability, staff-session isolation, exports, rate limiting, and admin recovery visibility. The current build passes 141 tests across 31 files, ESLint, the production build, and `git diff --check`.

The site should still not be treated as fully production-verified. This second pass found four release-blocking business-integrity risks: ambiguous refund retries, repeat/cumulative refunds, non-atomic promotion limits, and cancellation/restocking behavior for paid or shipped orders. Production database security, provider integration, and browser behavior also remain unverified because the configured database is unreachable from this environment and browser automation is unavailable.

Priority definitions:

- **P0:** Can directly cause duplicate money movement, financial loss, or sale of inventory that is not actually available. Fix before staff rely on the workflow.
- **P1:** Can cause material customer, revenue, privacy, or operational harm. Address before the next production release.
- **P2:** Significant hardening, usability, scalability, or compliance gap.
- **P3:** Quality improvement with lower immediate operational risk.

## P0 — release blockers

### A1. Refund provider timeouts can lead to a duplicate refund

`src/server/paystackRefund.js` converts every fetch exception into a generic failure. `initiateCaseRefund` then changes the case from `REFUND_PROCESSING` back to `APPROVED`, explicitly allowing another attempt. A timeout does not prove Paystack rejected the refund; it may accept the request and lose the response on the return path.

Required fix: write a durable refund attempt before calling Paystack. Keep uncertain outcomes in a review-required or processing state, query Paystack before retrying, and never make an ambiguous attempt immediately retryable. Add request timeouts and provider tests for accepted-response-lost behavior.

### A2. Completed refunds can be approved and refunded again

`updateCaseStatus` validates the target status but not the transition from the current status. It permits a case in `REFUNDED` or `REFUND_FAILED` to move back to `APPROVED`; an admin can then initiate another refund.

Required fix: enforce an explicit case transition table under a row lock. Make `REFUNDED` terminal. Restrict reopening failed refunds to a dedicated reviewed action that retains the original provider attempt identity.

### A3. Separate cases can cumulatively refund more than the payment

Each refund validates only that its own amount is no greater than `order.total`. There is no unique active-refund constraint per order and no sum of prior pending/completed refunds. Two cases for one order can each request the full total.

Required fix: lock the order/refund ledger, verify the successful Paystack amount and currency, subtract all accepted/pending/completed refunds, and reject amounts above the remaining balance. Store money in integer minor units or a fixed decimal type.

### A4. Shipped cancellation immediately creates sellable stock

The order transition table allows `SHIPPED → CANCELLED`. Cancellation immediately increments variant stock and triggers waitlist emails even though goods may still be with the courier or customer. The cancellation email says a refund will follow, but cancellation does not initiate or persist a refund workflow.

Required fix: separate cancellation, return-in-transit, received, inspected, restocked, and refund states. Do not increment stock for a shipped order until the item is physically received and approved for resale. Link paid cancellation to an explicit refund record and make the email state the actual refund status.

## P1 — high-priority gaps

### B1. First-order and limited-use promotions are raceable

Eligibility is read when checkout is initialized. At finalization, discount usage is unconditionally incremented and the result of the conditional `firstOrderPromoUsed` update is ignored. Concurrent attempts can both retain a first-order discount or pass the final `maxUses` slot.

Required fix: reserve promotion usage atomically with checkout creation and release it with failed payment inventory. Alternatively, restrict each account to one active discounted checkout and conditionally claim `usedCount < maxUses`. Add real PostgreSQL concurrency tests.

### B2. Missing shipping configuration silently charges zero

`getShippingFeeForState` returns `fallback?.fee ?? 0`. Unknown states use `DEFAULT`, while checkout accepts countries beyond Nigeria and pricing is based only on Nigerian regions.

Required fix: fail checkout closed when no reviewed fee exists. Define supported countries and validate country/state combinations. Use an explicit zero-valued fee row when free shipping is intended.

### B3. Fulfilment tracking URLs are not scheme-validated

`updateOrderFulfillment` accepts any trimmed `trackingUrl`; the customer order view renders it as an anchor.

Required fix: accept only valid HTTPS URLs, with an explicitly reviewed HTTP exception if required. Add maximum lengths to courier, tracking, and delivery-note fields.

### B4. Case bulk updates can partially mutate and then fail

`bulkUpdateCaseStatus` updates cases, then separately inserts events for every requested ID. The operations are not one transaction. A bad/nonexistent ID can cause event insertion to fail after statuses changed, and accurate prior states are not recorded.

Required fix: resolve and lock cases, validate all transitions, then update statuses, events, and required audit rows in one transaction.

### B5. Financial and operational audits are still best effort in several paths

Refund initiation, case and fulfilment changes, bulk catalogue changes, discount/shipping/promo changes, and several destructive actions write business state separately from audit records. `recordAdminAction` swallows failures unless explicitly required.

Required fix: commit every high-impact mutation and audit record in one transaction with `required: true`, including prior/final values needed for incident reconstruction.

### B6. Payment recovery capacity and alerting are insufficiently defined

The cron runs daily and reconciliation checks five attempts per pass. Unknown provider states keep stock indefinitely. The admin can run another pass, but there is no backlog-age alert, automatic escalation, or response SLA.

Required fix: run recovery frequently enough for volume, process the complete due backlog within platform limits, expose oldest-hold age and error counts, and alert staff when thresholds are breached.

### B7. Production database controls remain unverified

The read-only check again failed with Prisma `P1001`. This audit cannot confirm RLS, grants, the auth-user trigger, backups, restore viability, connection limits, or production indexes.

Required fix: run `pnpm run db:check-security` from approved staging/production infrastructure. Perform a restore drill and real concurrent transaction tests.

### B8. Admin authentication assurance is deployment-dependent

Server-side role checks are consistently present, but the repository does not establish MFA, staff session duration, breached-password protection, login alerting, or emergency role revocation.

Required fix: require MFA for owner/admin accounts, review Supabase Auth settings, test disablement/token revocation, and document emergency access removal.

## P2 — important gaps

### C1. Waitlist state and delivery evidence are incomplete

- `FULFILLED` exists in the schema/admin filter but is never written.
- `Notification.sent` means provider acceptance; delivered, bounced, complained, and suppressed states are absent.
- Notifications lack `variantId`, provider message ID, attempt count, last error, and sent timestamp. Admin delivery matching currently depends on user, product, and a message suffix.
- Removing a row can delete an unsent notification, but a sender already in flight may still complete.
- Concurrent retries rely partly on the provider's finite idempotency window because notification rows are not atomically claimed.

Required fix: use a variant-linked outbox keyed by entry/restock event with claim state, attempts, provider ID, accepted/delivered/bounced timestamps, and errors. Define whether purchase changes a subscription to `FULFILLED`.

### C2. Transactional email reliability is inconsistent

Order emails have durable retry state. Support acknowledgements/status changes, refund outcome emails, admin direct sends, and some general notifications do not have equivalent persisted jobs. A function crash after the database commit can lose them.

Required fix: use one durable email outbox for every transactional message and distinguish queued, accepted, delivered, bounced, and permanently failed states.

### C3. Data retention and deletion are incomplete

Terminal pending checkouts retain names, phones, and addresses. Notification, contact, case evidence, audit, and analytics retention is uneven. There is no self-service account deletion/export workflow, and uploaded evidence can become orphaned.

Required fix: approve retention by data class, add safe cleanup jobs, delete orphaned uploads, implement privacy requests, and align the privacy policy with actual providers and retention.

### C4. Upload controls need stronger cost and content boundaries

Admin direct-upload signatures do not impose file-size, pixel/duration, or allowed-format restrictions. Customer evidence checks browser-supplied MIME and size but not decoded content. Malware scanning is absent.

Required fix: sign maximum size/allowed formats where supported, enforce dimensions and duration, verify decoded content, set quotas, and define deletion/scanning policy.

### C5. Input-length limits are uneven

Contact submissions, some case notes, fulfilment fields, profile fields, and several catalogue fields lack consistent server-side maxima. Platform body limits do not protect database growth or admin rendering.

Required fix: use shared schemas with explicit type, length, enum, URL, and array bounds on every write endpoint.

### C6. Content Security Policy is only partially enforced

Base, object, frame, and form restrictions are enforced. Script, style, image, media, and connection restrictions remain report-only with no report collector.

Required fix: collect staging violations, remove unnecessary sources, then enforce the complete policy. Prefer nonce/hash controls where practical.

### C7. Money uses floating-point database fields

Prices, totals, fees, discounts, and refund amounts are `Float`. Percentage calculations and conversion to kobo can disagree at rounding boundaries.

Required fix: store monetary values as integer kobo or fixed `Decimal` with one rounding policy and reconcile during migration.

### C8. Dependency scan is not clean

The registry audit reports one high advisory: `deepmerge-ts@7.1.5` through Prisma configuration tooling (`GHSA-ggr8-5vv4-36mx`). No request objects are intentionally passed into that tooling, lowering practical exposure, but it remains open.

Required fix: test and adopt compatible Prisma tooling that uses `deepmerge-ts >= 8`.

### C9. Admin lists and exports have scaling ceilings

Customers/messages cap at 200, cases at 300, campaigns at 100, and visitor analysis can load 5,000 users. CSV exports load full datasets into function memory.

Required fix: add cursor pagination, streaming export jobs, date bounds, and indexes verified with production query plans.

### C10. SEO and HTTP routing remain SPA-limited

Unknown routes return `index.html` with HTTP 200 before client-side not-found rendering. Product/journal metadata is client-rendered, weakening crawlers and link previews.

Required fix: add SSR, prerendering, or edge routing for real 404s and item-specific canonical, Open Graph, and structured metadata.

### C11. Accessibility and responsive behavior are not certified

The code has focus styles, reduced-motion handling, modal focus management, labels, and live regions. Browser, keyboard, screen-reader, zoom/reflow, contrast, and axe testing were unavailable. A global skip link was not found, and dense admin tables rely on horizontal scrolling.

Required fix: test keyboard use, VoiceOver/NVDA, 200–400% zoom, touch targets, error announcements, focus order, and mobile admin tables. Add a skip link and stable main target.

### C12. Performance still needs measurement and budgets

The build succeeds, but initial JS remains about 878 kB minified / 267 kB gzip and Vite emits a large-chunk warning. The address chunk is about 429 kB / 101 kB gzip. `dist` is about 39 MB.

Required fix: measure Core Web Vitals on mobile hardware, split vendor/admin dependencies further, serve responsive AVIF/WebP, audit fonts, and enforce bundle budgets in CI.

## P3 — engineering and product improvements

- Add CI for frozen install, tests, lint, build, advisory policy, and security/migration checks. No repository CI workflow was found.
- Add a health/readiness endpoint that reports configuration/dependency degradation without exposing secrets.
- Split the monolithic `src/api/routes.js` into domain modules with shared validation.
- Make pagination, empty/loading/error states consistent across admin screens.
- Persist large direct-email jobs rather than relying on one background execution.
- Add inventory adjustment reasons and a stock ledger for reservations, returns, shrinkage, and corrections.
- Decide whether international checkout is supported; address entry permits it while shipping pricing is Nigeria-specific.

## Current strengths

- Roles come from the server-side user row, not client claims.
- Customer-owned orders, cases, addresses, wishlist, and waitlist data are scoped server-side.
- Checkout verifies Paystack status, reference, amount, and NGN currency.
- Inventory reservation/release uses transactions and conditional locking.
- Order row locking prevents the same cancellation from restocking twice.
- Waitlist joins validate verified email, variant existence, and sold-out state; restock jobs persist before provider calls.
- Private query caches clear on identity change; only allowlisted public catalogue queries persist.
- CSV exports neutralize formula injection.
- Rate limiting uses PostgreSQL advisory transaction locks and fails closed.
- Production artifacts contain no public source maps.

## Verification performed

- `pnpm test`: 141 tests in 31 files passed.
- `pnpm run lint`: passed.
- `pnpm run build`: passed; existing third-party directive/source-map warnings and large-chunk warning remain.
- `git diff --check`: passed.
- Production `.map` count: zero.
- `pnpm audit --json`: one high advisory; zero critical, moderate, or low.
- `pnpm run db:check-security`: failed with Prisma `P1001`; no database-security result is claimed.

No live payment, refund, email, database mutation, deployment, browser session, or customer action was performed.

## Recommended sequence

1. Freeze automated refund retries and shipped-order cancellation until A1–A4 are fixed and tested with Paystack test mode and real PostgreSQL.
2. Fix atomic promotion claims and fail-closed shipping configuration.
3. Make financial, case, fulfilment, and bulk mutations transactional with required audit records.
4. Validate database controls, backups, provider configuration, cron capacity, and admin MFA.
5. Replace waitlist/email delivery approximations with a variant-linked outbox and provider delivery events.
6. Complete staging browser tests for accessibility, responsive layouts, payments, refunds, waitlist, and roles.
7. Address retention, full CSP enforcement, dependency cleanup, SEO, and performance budgets.
