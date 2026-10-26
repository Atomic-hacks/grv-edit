# Staging release and test plan

Use this plan before merging the remediation into the production branch. Do not connect a Preview deployment to the production database, live Paystack secret, or production email audience.

## 1. Isolate staging

- Create a Supabase staging project or Supabase database branch with the current production schema and no real customer data.
- Confirm a restorable production backup before applying any production migration.
- In Vercel, configure **Preview** variables to use only staging values:
  - `DATABASE_URL` and `DIRECT_URL`: staging database
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`: staging Supabase
  - `PAYSTACK_SECRET_KEY`: Paystack **test** secret
  - `RESEND_API_KEY` and sender variables: a staging/test sender and controlled inboxes
  - `APP_URL`: the staging deployment URL
  - `CRON_SECRET`: a distinct staging secret
- Keep Production variables scoped to Production only.

This repository did not previously have a complete migration history. The new SQL file is incremental and assumes the existing application tables already exist. Do not run it against an empty database. Clone/apply the existing schema first, then apply `prisma/migrations/20261019120000_financial_integrity/migration.sql`.

## 2. Branch and automated checks

The remediation is currently on `feature/colourless-variants` with uncommitted changes. Review the diff before committing. A safe branch sequence is:

```bash
git switch -c staging/financial-integrity
git diff --check
npm test -- --run
npm run lint
npm run build
git add --all
git commit -m "Harden payments, returns, promotions, and waitlist operations"
git push -u origin staging/financial-integrity
```

Open a pull request without merging it. Confirm GitHub CI passes and Vercel creates a Preview deployment using the staging variables.

## 3. Schema checks

After applying the migration to staging:

```bash
npx prisma migrate status
npm run db:check-security
```

In Supabase, confirm these tables and columns exist:

- `RefundAttempt`
- `FirstOrderPromoRedemption`
- `DiscountRedemption`
- `WaitlistEntry.deliveryStatus`, `deliveryAttempts`, `lastDeliveryError`, `providerMessageId`, `notifiedAt`, `fulfilledAt`
- `Notification.waitlistEntryId`
- `RETURN_PENDING` and `RETURNED` order statuses

Check that anon users cannot read or mutate private orders, refund attempts, redemption records, waitlist entries, audit records, or staff data. Repeat representative requests as an authenticated customer and an admin.

## 4. Money and refund tests

Use Paystack test mode and a newly created staging order for every scenario.

### Normal refund

1. Pay for an order using a Paystack successful test card.
2. Create a refund case, move it through review, and approve it as an ADMIN/OWNER.
3. Initiate one refund.
4. Confirm `RefundAttempt` was created before the provider result and stores `amountKobo`.
5. Confirm the case stays processing until a signed Paystack refund webhook reports the outcome.
6. Replay the webhook and confirm the refund and email state change only once.

### Permission and state protection

1. Attempt approval and refund as CUSTOMER, SUPPORT, ANALYST, and FULFILMENT; expect 403.
2. Complete a refund, then try to approve and refund the same case again; expect rejection.
3. Create two refund cases for one payment. Process a partial refund in the first, then request more than the remaining paid amount in the second; expect rejection.

### Concurrency and ambiguous outcome

1. Send two refund-initiation requests for the same approved case at the same time; only one provider request and one active ledger entry may result.
2. Repeat with two cases whose combined amount exceeds the payment; at most the paid amount may be reserved/refunded.
3. Simulate a provider timeout after submission. Confirm the attempt and case become `UNKNOWN`, ordinary approval/retry is blocked, and no second refund is sent.
4. Reconcile the unknown transaction directly in Paystack before any manual recovery. The application does not yet provide a complete operator reconciliation action, so this scenario remains a release limitation.

Paystack supplies specific test cards for successful, failed, and needs-attention refund behavior; use the current values from its test-payment documentation rather than copying card data into this repository.

## 5. Orders, returns, and inventory

1. Create a paid order with a variant whose available stock is known.
2. Cancel while `PAID`; confirm stock returns once and a repeated/concurrent cancellation cannot return it twice.
3. Create another order and move it to `SHIPPED`, then `RETURN_PENDING`; confirm stock does not increase and no refund is created automatically.
4. Mark it `RETURNED`; confirm stock increases once and the waitlist outbox is queued.
5. Confirm the proposed refund defaults to paid total minus the `shippingAmount` stored on that order, even after changing the current shipping configuration.
6. Send two simultaneous last-item checkouts from different accounts. Exactly one inventory reservation should succeed.
7. Replay a successful payment webhook twice; confirm one order and one stock decrement.

## 6. Promotions and shipping

1. From one new account, send two simultaneous first-order checkouts. Only one should reserve the promotion.
2. Configure a discount with one remaining use and submit two simultaneous checkouts from separate users. Only one should reserve the final use.
3. Let or force an unpaid checkout into a terminal failed/abandoned state and run recovery. Confirm its promotion reservation is removed.
4. Complete payment and confirm its reservation becomes `REDEEMED`.
5. Remove the applicable staging shipping-fee row and attempt checkout. Expect 503, no Paystack initialization, no order, and an operational error in Sentry/logs.

## 7. Tracking, audit, and bulk actions

1. Save valid `https://` and `http://` tracking links; confirm they render as links.
2. Attempt `javascript:`, `data:`, malformed, and overlong URLs; expect rejection. Confirm direct SQL writes violating the protocol check are rejected for new/updated rows.
3. Force the audit insert to fail during a fulfilment or bulk case action; confirm the business change rolls back.
4. Include an invalid ID or transition in a bulk request; confirm none of the selected rows change.

## 8. Waitlist and email

1. Join a sold-out exact variant and confirm it appears in Admin → Waitlist with the customer and option.
2. Restock the option. Confirm one linked notification, `QUEUED` then `SENT`, attempt count, provider message ID, and notification timestamp.
3. Force Resend rejection; confirm `FAILED`, the error and attempt count are visible, then retry successfully.
4. Purchase the variant as the waiting customer and confirm the entry becomes `FULFILLED` with `fulfilledAt`.
5. Replay/retry notification work concurrently and confirm controlled inboxes do not receive duplicates.
6. Verify SPF, DKIM and DMARC and test delivery in Gmail, Outlook and a second provider.

Delivered, bounced and complained states are not yet consumed from Resend webhooks. Provider acceptance (`SENT`) must not be described operationally as inbox delivery.

## 9. Browser and accessibility

Test at 320, 375, 768, 1024 and desktop widths:

- sign-up, verification, login, logout and account switching
- browse, filters, product options, cart, checkout and payment return
- account orders, waitlist and support cases
- every admin role, navigation link, forbidden deep link and bulk action
- keyboard-only navigation, visible focus, Escape/focus return in panels, 200% and 400% zoom
- axe and Lighthouse on home, product, checkout, account and major admin pages
- VoiceOver or NVDA for forms, errors, dialogs and status announcements

## 10. Release decision

Do not merge to the production branch until:

- CI and the Preview build pass.
- The staging migration and rollback/restore procedure are proven.
- Refund, concurrency, inventory, promotion and shipping tests pass.
- RLS/grants and staff roles pass.
- Paystack webhooks reach the public staging URL and replay idempotently.
- Controlled inbox tests pass.
- Known limitations in `FINAL_AUDIT.md` are accepted with an owner and deadline.

For production, apply the reviewed schema migration before deploying application code. Monitor unknown refunds, retained payment attempts, stock holds, failed email jobs, missing shipping configuration and webhook errors during the release.
