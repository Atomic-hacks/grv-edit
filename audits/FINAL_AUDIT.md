# Production readiness audit — 19 October 2026

## Decision

The repository is materially safer, and all local automated checks pass. It is **not ready for an unguarded production release** until the migration is applied in staging, backups and restore are verified, and the real database/provider tests below pass. No production database, payment, refund, email, DNS, or deployment action was performed from this workspace.

## Requested controls

| # | Status | Evidence and remaining work |
| --- | --- | --- |
| 1 | Implemented, provider test required | A durable `RefundAttempt` is created before Paystack. Timeouts and 5xx responses become `UNKNOWN`; another approval/refund is blocked. Add an operator reconciliation action that lists Paystack refunds before any reviewed retry. |
| 2 | Implemented | Explicit case transitions make `REFUNDED`, `REFUND_UNKNOWN`, and execution states terminal through ordinary status endpoints. |
| 3 | Implemented, concurrency test required | The payment and order are verified; the order row is locked; all active/completed attempt amounts in kobo are summed against the Paystack amount. |
| 4 | Implemented | Approval and refund execution require ADMIN/OWNER server-side. No automatic refund path was added. |
| 5 | Implemented | `SHIPPED → RETURN_PENDING` does not restock. `RETURN_PENDING → CANCELLED` records receipt and restores stock. |
| 6 | Implemented | The default returned-shipment refund is captured paid total less captured `shippingAmount`. Staff can still enter a smaller reviewed partial refund. |
| 7 | Implemented, concurrency test required | First-order and limited-code reservations are atomic with checkout and inventory. First-order use is unique per user. Terminal unpaid attempts release reservations. |
| 8 | Implemented | Missing shipping configuration returns 503 and reports to Sentry instead of charging zero. Supported-country policy is still undefined. |
| 9 | Implemented | HTTP(S) is enforced in the handler, safe rendering, and a PostgreSQL check constraint. Existing rows must be reviewed before validating the constraint. |
| 10 | Implemented for cases and fulfilment | Bulk case changes and fulfilment updates commit state, events and required audits together. A full inventory of every legacy admin mutation is still needed. |
| 11 | Partially implemented | New refund money uses integer kobo. Existing product/order/discount/shipping Float columns remain until a verified backup/restore and reconciliation migration are completed. |
| 12 | Open | Recovery still checks five payments per pass and the repository cron remains daily. Configure a 10–15 minute authenticated Supabase schedule, safe row claiming, backlog draining and alerts. |
| 13 | Implemented except delivery webhooks | Waitlist entries have variant identity, delivery state, attempts, errors, provider ID and timestamps; purchase marks `FULFILLED`. Resend delivered/bounced/complained webhook handling remains open. |
| 14 | Partially implemented | Order and waitlist notifications are durable and retryable. Support, contact replies, refund outcomes, campaigns and other non-order emails do not yet share one general outbox. |
| 15 | Unverified release gate | Run Security Advisor, the repository security script, and anon/customer/admin tests against staging and production. The configured database was unreachable here. |
| 16 | Unverified release gate | Confirm backup/PITR entitlement and complete a restore into a scratch project before the money-column migration. |
| 17 | Unverified release gate | Run real PostgreSQL parallel tests for two refunds, final promo use and last-item checkout. Unit tests cannot prove lock behavior. |
| 18 | Unverified release gate | Run axe/Lighthouse, real-device and screen-reader tests, Paystack test-mode payments/refunds, inbox tests, and SPF/DKIM/DMARC checks. |
| 19 | Implemented | `.github/workflows/ci.yml` runs tests, lint and build on each push/PR. Branch protection still must require the job. |
| 20 | Open | Full CSP remains report-only. Collect violations for a week, reduce the allowlist, then enforce it. |
| 21 | Partially implemented | Routes/admin are split, but the initial chunk is 878.36 kB minified (267.43 kB gzip) and still triggers Vite's warning. Split core vendors and measure Framer Motion/address costs. |
| 22 | Partially implemented | Sitemap hardening exists, but product/collection pages remain client rendered. Prerender/SSR metadata, structured data, canonical URLs and real HTTP 404s remain open. |
| 23 | Open | Define retention, scheduled purge, export, deletion/anonymization, and orphaned Cloudinary upload cleanup. Update the privacy policy to match implemented behavior. |

## Additional risks found

- Staff security depends on Supabase deployment settings. Require MFA for OWNER/ADMIN, review session duration, and test role revocation.
- The dependency audit still has one high advisory in Prisma configuration tooling (`deepmerge-ts`); test the compatible major upgrade.
- International addresses are accepted while shipping logic is based on Nigerian regions. Decide and enforce the supported-country policy.
- Admin exports and several list endpoints have memory or fixed-result ceilings. Add cursor pagination and queued/streamed exports before volume grows.
- Upload controls lack complete content verification, dimensions/duration limits, malware scanning, quotas and lifecycle cleanup.
- Unknown refund outcomes are safely blocked but currently need database/Paystack-assisted operator reconciliation. They must never be retried based only on elapsed time.

## Verification completed locally

- 141 tests across 31 files passed.
- ESLint passed.
- Production build passed.
- Prisma schema formatted and client generation passed.
- Build retained the known third-party directive/source-map warnings and large initial-chunk warning.
- Sitemap generation could not query the unavailable database and preserved the known sitemap; catalogue coverage remains a release check.

## Safe release order

1. Freeze schema/application deploys; verify backup and restore in a scratch project.
2. Apply the financial-integrity migration in staging and validate old tracking URLs before validating its check constraint.
3. Run security, role, parallel checkout/promo/refund, return/restock and Paystack timeout tests against staging.
4. Test waitlist and every email class through real inboxes; configure delivery webhooks and the 10–15 minute recovery schedule.
5. Deploy schema before application, smoke test with test-mode transactions, then monitor refund unknowns, payment holds, email failures and shipping-config errors.
