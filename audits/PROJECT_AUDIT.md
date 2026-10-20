# GRV project audit — 19 October 2026

> Historical findings from the initial review. See [REMEDIATION.md](REMEDIATION.md) for implemented fixes and [SECOND_AUDIT.md](SECOND_AUDIT.md) for the current post-remediation assessment and newly identified release blockers.

## Scope and evidence

Repository review covering storefront, account/authentication, cart/checkout, waitlist, email, API routing, admin roles, deployment configuration, accessibility and performance. Findings below are code-confirmed unless explicitly marked deployment-dependent. Priorities: P1 = address before relying on the affected workflow in production; P2 = next release; P3 = improvement.

Validation: 109 tests across 17 files pass, ESLint passes, production build passes, and `git diff --check` passes. Seven unauthenticated API probes returned 401: waitlist, admin products, staff, orders, analytics, customer orders and `/api/me`. These are representative authentication checks, not exhaustive permission or ownership tests.

Limits: no real customer records were changed, payments made, emails sent, or deployment performed. Browser automation was unavailable; the local dev server also could not bind a port under the sandbox (EPERM). UI/accessibility findings are source-based, not visual or assistive-technology certification. Production database RLS/grants, auth trigger, provider credentials, delivery, cron operation and deployed headers remain unverified. Dependency advisory lookup (`pnpm audit --json`) failed with `fetch failed`; no clean dependency-security result is claimed. A passing build does not establish production configuration correctness.

## Waitlist changes implemented

- Completely sold-out products with multiple variants now select an actual variant, making the waitlist action visible.
- Only WAITING entries disable joining. NOTIFIED entries can be reactivated when the product sells out again; the API applies the same rule.
- Joining updates the customer's query cache immediately and shows a clear waiting/success label and email expectation.
- The API rejects malformed/null JSON, empty variant IDs, nonexistent variants and variants already in stock. Authentication, email verification and customer-scoped listing/deletion remain enforced.
- Restocking recognizes stock moving from zero **or a negative quantity** to positive, including stock returned by cancellation.
- Admin stock updates no longer contact the email provider inside the inventory transaction. Restock jobs create notification records and atomically claim waiting subscriptions before sending email outside that transaction. Concurrent workers skip already claimed entries; provider exceptions do not stop delivery attempts to other recipients. Failed sends remain unsent for the existing admin retry endpoint.
- Waitlist endpoints and restock delivery are extracted into independently testable modules. Thirteen regression tests were added, bringing the suite from 96 to 109 tests.

Files: `src/ProductDetail.jsx`, `src/lib/variantOptions.js`, `src/api/handlers/waitlist.js`, `src/server/waitlistNotifications.js`, `src/api/routes.js`, and their tests. No schema migration is required.

Residual waitlist limitations: stock commit and notification-job creation are separate, so a crash/database failure between them can miss the restock job. Failed emails require the existing admin retry API; the daily reminder job does not retry these notification records. For durable delivery, record an outbox event in the inventory transaction, then process/retry it in a scheduled worker. NOTIFIED currently means a notification was queued, not proof that an email reached an inbox. Live delivery must still be checked with a verified test account and a disposable product in staging.

## Security and customer-data findings

### S1 — P1: Admin query cache can cross staff sessions

Evidence: `src/context/AuthContext.jsx` signs out without clearing private queries; admin pages use keys such as `["admin", "customers", ...]` and `["admin", "orders"]` without a user identifier. `src/main.jsx` keeps data fresh for five minutes and retains queries for 24 hours. `AdminRoute` permits any staff role into the panel.

Impact: an owner/admin signs out and a lower-privilege staff member signs in without a full reload. The new session can receive the previous session's fresh cached admin data before any server permission check, potentially for the entire freshness interval. Server guards do not protect data already in browser memory.

Action: cancel in-flight private requests and remove private query data on every identity change, including logout and account switch; scope admin keys to user identity. Reproduce with two staff roles in the same tab and confirm restricted data never renders.

### S2 — P1: CSV exports permit spreadsheet formula injection

Evidence: `src/api/handlers/exports.js`, `csvCell`, escapes CSV delimiters/quotes but does not neutralize formula-leading input. Exports include customer-controlled names, city and state.

Impact: spreadsheet software may evaluate an exported customer field such as `=HYPERLINK(...)` as a formula when staff open the file. Actual effects depend on spreadsheet settings and software; no exploit was executed.

Action: treat untrusted fields as literal spreadsheet text, covering formula prefixes and leading control characters, or use explicitly typed XLSX cells. Validate in supported spreadsheet applications, including save/reopen behavior. Reference: [OWASP CSV injection](https://community.owasp.org/attacks/CSV_Injection).

### S3 — P2: CSP is report-only

Evidence: `vercel.json` sets `content-security-policy-report-only` and has no reporting destination.

Impact: this policy does not block unwanted scripts/connections, and violations are not centrally collected. Existing frame-denial and other headers still provide their own protection.

Action: validate actual auth, analytics, images, uploads and error-reporting flows, collect violations, then enforce a compatible policy. Reference: [MDN report-only CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only).

### S4 — P2: Rate limiting is non-atomic and fails open

Evidence: `src/server/rateLimit.js` counts hits and inserts a new hit in separate operations; errors explicitly allow requests.

Impact: concurrent bursts can exceed limits; a limiter storage failure removes protection from public write endpoints. Waitlist joining has no additional rate limiter.

Action: use atomic admission control and appropriate per-user/IP limits; define failure behavior per endpoint rather than globally allowing all requests.

### S5 — P2: Analytics receives sensitive URL context

Evidence: `src/App.jsx` tracks every pathname/search; `src/lib/analytics.js` sends `window.location.href` as `page_location`. Routes include unsubscribe tokens, payment references and authentication return paths.

Impact: bearer-like unsubscribe links and payment/account context may be sent to GA when analytics is configured. Authentication fragments can also be included because the full href is used.

Action: exclude auth/account/admin/payment/unsubscribe pages as appropriate; allowlist safe parameters and remove fragments before sending telemetry. Verify actual network payloads in staging.

### S6 — Deployment-dependent P1 check: Database access lockdown

Evidence: `scripts/lockDownPublicTables.js` enables RLS and revokes anon/authenticated privileges; README requires a separate invocation after schema changes. Its presence does not prove execution in production. Auth signup synchronization likewise requires `prisma/sql/sync_auth_user_trigger.sql` to be installed.

Impact if missing: exposed public-schema tables may allow direct REST access; missing auth synchronization prevents app-user lookup and authenticated features, including waitlist, despite successful Supabase login.

Action: inspect actual RLS, policies, grants and trigger state read-only in production; make these checks part of deployment. No production exposure is asserted by this audit.

## Checkout, inventory and feature reliability

### F1 — P1: Checkout can oversell stock

Evidence: `src/api/routes.js`, `finalizeOrderFromReference`, logs when stock is below the purchased quantity and then unconditionally decrements it. Stock is checked at checkout initiation, but there is no stock reservation covering the payment interval.

Impact: multiple customers can pay for the final unit and inventory can become negative. The atomic checkout-reference claim prevents duplicate processing of one payment, but does not prevent different payments competing for the same stock.

Action: implement expiring reservations or an equivalent atomic allocation design, with an explicit refund/manual-review path for paid orders that cannot be fulfilled. Test concurrent checkouts and late payment confirmation.

### F2 — P1: Successful payment is not compared to expected amount/currency

Evidence: `verifyCheckout` checks provider success and passes only the reference to finalization; the webhook similarly passes the reference after signature verification. `finalizeOrderFromReference` creates a PAID order from stored payload without comparing provider amount/currency.

Impact: an integrity mismatch would still finalize an order. This is a missing verification invariant, not proof of a working underpayment exploit; checkout initialization currently creates the amount server-side.

Action: compare reference, amount in minor units, currency and expected payment context before claiming/finalizing. Test mismatches through webhook and browser-return paths. Reference: [Paystack amount verification](https://paystack.com/docs/payments/accept-payments/).

### F3 — P1: Cleanup can erase a checkout that later receives a valid payment

Evidence: `src/server/runReminderChecks.js` deletes pending checkout rows older than two hours. Finalization requires the pending payload. A webhook with an unknown reference receives an OK response after finalization returns no order.

Impact: a delayed successful payment or delayed webhook after cleanup can have no order to fulfill and no surviving checkout payload to reconcile automatically.

Action: retain attempts with lifecycle states and reconcile provider status before expiry; keep enough immutable data to recover late settlements and alert on unmatched successful payments.

### F4 — P2: Wishlist reminders are marked sent even on delivery failure

Evidence: the wishlist reminder loop in `src/server/runReminderChecks.js` updates `reminderSent: true` and increments its counter in `finally`, including when the provider rejects or throws.

Impact: failed reminders are permanently skipped and reporting overstates successful sends.

Action: mark sent only after provider acceptance; track attempts/errors separately and retry with backoff.

### F5 — P2: Reminder targeting ignores customer email preferences

Evidence: abandoned-cart and wishlist queries in `src/server/runReminderChecks.js` do not filter user `active` or `marketingOptIn`. Promotional campaign audience resolution in `src/server/campaigns.js` does filter both.

Impact: reminder behavior can contradict the user's email preference and reach disabled customers.

Action: define which messages are transactional versus promotional and consistently enforce the corresponding preferences and suppression rules. This is a product/privacy finding, not a legal compliance determination.

### F6 — P2: Restock retry and queue durability remain incomplete

See residual waitlist limitations above. Additional evidence: `/api/admin/notifications/process` is an admin API, while the scheduled reminder sweep retries order emails and campaigns, not unsent stock notifications. Other notification paths still perform email calls inside interactive transactions.

Action: unify notification delivery behind a durable outbox, bounded batches, per-recipient retries and admin delivery status. Do not infer delivery from subscription status alone.

## UI, navigation, routing and ease of use

### U1 — P1: Category browsing stops after 60 products

Evidence: `src/catalog/CategoryPage.jsx` always sends `pageSize: 60`, displays the API total, but has no page control, next-page query or load-more action.

Impact: customers cannot reach matching products after the first 60 through that category view, even though the count says they exist.

Action: implement URL-backed pagination or accessible load-more; preserve filters and back-navigation state. Verify with at least 61 matching products.

### U2 — P2: Filter/Browse panels lack modal keyboard behavior

Evidence: `src/component/ui/SidePanel.jsx` has an overlay and aside but no dialog role, `aria-modal`, focus trap, initial/return focus, Escape handling or background-scroll lock. Its Filter/Browse consumers do not supply these behaviors.

Impact: keyboard focus can move behind the overlay and users cannot reliably dismiss or navigate the panel. Navbar implements several of these behaviors already, but the shared SidePanel does not reuse them.

Action: use a shared accessible dialog implementation; verify keyboard-only and screen-reader flows, including focus restoration and reduced motion.

### U3 — P2: Product-card navigation is mouse-oriented

Evidence: category product wrappers use an `onClick` on a plain div; `Card.jsx` uses visual div/image/title content rather than a product navigation link.

Impact: keyboard users cannot activate the same navigation, and open-in-new-tab/context-menu/link semantics are missing.

Action: use actual product links while keeping wishlist and quick-add controls separate from the link.

### U4 — P2: Error objects can crash error rendering

Evidence: `src/account/OrderDetail.jsx` renders `{error}` directly from React Query in `InlineNotice`. `src/admin/AdminCustomerDetail.jsx` also directly renders a query error object.

Impact: a failed request can cause React's invalid-child error instead of showing a recoverable message.

Action: render a safe string such as `error.message`, provide retry actions, and test rejected requests rather than only successful responses.

### U5 — P2: Category outage is presented as a missing page

Evidence: `CategoryPage.jsx` checks pending and then unresolved `categoryPath`; it has no separate `categoriesQuery.error` branch.

Impact: an API/network outage displays “We couldn't find that” instead of offering a retry. Broad `/:categorySlug/*` routing also means most unknown storefront URLs depend on this category lookup.

Action: distinguish loading, fetch failure, empty taxonomy and genuinely unknown paths; provide a retry for fetch failure. Reserve app-owned path segments so dynamic category slugs cannot conflict with account/admin/shop routes.

### U6 — P2: Waitlist journey has no management screen

Evidence: waitlist list/delete APIs exist, but `src/account/Account.jsx` only offers orders, cases, addresses and account details. `src/lib/adminNav.js` has no waitlist/delivery operations entry.

Impact: customers cannot review/cancel their subscriptions from account, and staff have no obvious delivery/retry dashboard. Login return preserves product path, but the selected variant is component state, so the customer's intended option can be lost on login.

Action: add account subscription management, staff demand/delivery visibility, and URL-backed variant selection or a preserved pending action. Give unverified users a direct verification route from the waitlist prompt.

### U7 — P3: SPA navigation resets useful browsing context

Evidence: `useScrollToTopOnNavigate` in `src/App.jsx` resets scroll whenever pathname changes, including browser Back. Product selection initializes again whenever the fetched product object changes.

Impact: returning from a product can lose the grid scroll position; a refreshed product response can change the selected option.

Action: restore scroll on history navigation and initialize option selection only when needed, preserving valid customer choices during refresh.

## Admin and operational maintainability

### A1 — P2: Admin navigation does not reflect role permissions

Evidence: `AdminRoute` admits OWNER/ADMIN/SUPPORT/FULFILMENT/ANALYST, while `adminNavGroups` and `AdminLayout` render the same links for every staff role. Staff management is OWNER-only; many catalogue routes accept ADMIN/OWNER only.

Impact: staff encounter forbidden screens and misleading actions. Combined with S1, cached restricted data is more serious than navigation confusion alone.

Action: define capability metadata shared by navigation and UI actions; retain authoritative server guards. Show a useful forbidden page and role-specific landing page.

### A2 — P2: Audit history is best effort and incomplete

Evidence: `recordAdminAction` swallows persistence errors. The main route module calls it for order operations, while many catalogue/discount/customer changes have no equivalent call. Dedicated case/fulfilment/staff handlers do record sensitive operations.

Impact: staff changes can occur without a durable audit record, and audit coverage varies by feature.

Action: persist critical audit events transactionally with changes or in a durable outbox; define expected coverage and surface failures operationally.

### A3 — P2: Schema rollout and deployment verification are manual

Evidence: README uses `prisma db push`; there are no versioned Prisma migrations. RLS lockdown and auth trigger installation are separate manual steps.

Impact: environments can drift, release ordering is hard to reproduce, and a successful frontend build can hide backend prerequisites.

Action: establish reviewed, versioned database changes and automated post-deploy read-only checks, plus tested backup/restore procedures. Do not run schema changes against customer data as part of this audit.

## Performance, discoverability and deployment

### P1 — P2: Large bundles increase loading cost

Measured production build: initial JavaScript about 962 kB minified / 289 kB gzip; address-fields chunk about 857 kB / 186 kB gzip. These are bundle measurements, not real-user performance scores. Lazy-loaded admin/account code is already a useful optimization.

Action: inspect bundle composition, load only necessary country/state data, and split optional storefront functionality. Measure mobile loading, interaction delay and layout shift before assigning targets.

### P2 — P2: Page metadata and HTTP not-found behavior are generic

Evidence: `index.html` provides one sitewide title/description/social image; Vercel's final catch-all serves index.html for arbitrary routes. The SPA can show a missing page while the document response remains successful.

Impact: product shares lack product-specific previews, and unknown routes can become soft 404s. This also complicates search visibility and monitoring.

Action: provide prerendering/SSR or edge route handling for meaningful metadata and proper status codes; add unique page titles for browser orientation even before SSR.

### P3 — P2: Local build silently generates a reduced sitemap

Observed `pnpm run build`: the sitemap script had no DATABASE_URL in its process, logged a database error and generated only nine static URLs; build still passed. The existing tracked sitemap was restored after this audit's build. Production behavior depends on its environment and was not verified.

Action: load build environment explicitly; preserve a known-good sitemap on transient failures or alert/fail appropriately for production. Verify coverage of public categories, products, brands, journal and sections.

### P4 — P3: Public source maps and preview limitations

Evidence: `vite.config.js` enables public source maps; `configureServer` installs the API only for development, not `vite preview`.

Impact: original browser source is downloadable (this does not by itself expose server secrets). A standalone production preview has no working API without another backend, which can look like broken features during QA.

Action: use hidden/uploaded source maps if public source disclosure is undesirable, and document or implement a full-stack preview workflow.

## Controls already present

- Supabase bearer tokens are verified server-side; roles and account active state are read from the database. Role is not taken from user-controlled profile metadata.
- OWNER-only role assignment and server role guards exist. Representative anonymous requests were rejected.
- Checkout initiation computes amounts server-side; Paystack webhooks use raw-body HMAC verification with a constant-time comparison. Atomic pending-checkout claiming prevents duplicate fulfillment of the same reference.
- Waitlist listing/deletion are customer-scoped, and joining requires verified email. These behaviors are covered by the new tests.
- Catalogue cache policy excludes credentials and private paths; local persisted queries use a public-data allowlist. This reduces disk/CDN exposure but does not solve the in-memory admin session issue.
- Login return paths have dedicated validation/tests. Journal content is rendered as React text rather than raw HTML.
- Security headers, Sentry integration, email text alternatives, public-write rate limits, campaign opt-in filtering and backup/lockdown scripts exist.

## Recommended execution order and release checks

1. Resolve S1, S2 and checkout F1–F3; verify actual RLS/grants/auth trigger. Add concurrency, payment mismatch and session-switch tests.
2. Finish durable restock/email retry handling, reminder semantics and category pagination.
3. Correct role-aware navigation, error rendering, dialog behavior, semantic product links and account waitlist management.
4. Complete bundle/SEO/deployment work and enforce a validated CSP.
5. Run a staging journey matrix: desktop/mobile guest browsing; verified/unverified login; each option/stock combination; join/rejoin/cancel waitlist; restock and provider failure; checkout success/pending/failed/late payment; account ownership isolation; every staff role; logout/account switch; unknown URLs and API outages. Use Paystack test mode, disposable products/accounts and a designated test inbox.

Production readiness remains conditional on those checks. This is a source audit plus automated local validation, not a penetration-test certification or a completed live-device usability study.
