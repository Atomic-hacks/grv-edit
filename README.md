# GRVHQ

Storefront: React 19 + Vite frontend, Prisma/Postgres (Supabase) backend served from a
single Vercel serverless function, Supabase Auth, Paystack for payments, Resend for
transactional email, and Cloudinary for image uploads.

## Stack

- **Frontend**: React 19, React Router, Tailwind v4, Framer Motion — `src/`
- **Backend**: one catch-all serverless function ([api/[...path].js](api/%5B...path%5D.js))
  that routes into [src/api/routes.js](src/api/routes.js) via a small route table
- **Database**: Postgres via Prisma ([prisma/schema.prisma](prisma/schema.prisma)), hosted
  on Supabase
- **Auth**: Supabase Auth (session tokens verified server-side; role/state of record
  lives in the Prisma `User` row, not in client-supplied data)
- **Email**: Resend, via [src/server/sendEmail.js](src/server/sendEmail.js) and the shared
  templates in [src/server/emailTemplates.js](src/server/emailTemplates.js)
- **Payments**: Paystack (checkout + webhook)
- **Images and video**: Cloudinary (direct signed uploads from the browser)
- **Analytics**: Google Analytics 4 in the storefront, plus first-party visit counts and an optional GA4 Data API panel in Admin → Visitors
- **Errors**: Sentry

## Local setup

1. Install dependencies:
   ```
   pnpm install
   ```
2. Copy `.env.example` to `.env.local` and fill in every value — see the comments in
   that file for where each credential comes from (Supabase project settings,
   Cloudinary dashboard, Paystack dashboard, Resend dashboard).
3. Push the Prisma schema to your database:
   ```
   pnpm run db:push
   ```
4. Create the starting page sections (Home, Shop, Departments), then add your
   categories, brands and products in the admin:
   ```
   pnpm run db:seed-content
   ```
5. Start the dev server:
   ```
   pnpm run dev
   ```

The dev server and all scripts load `.env.local` automatically (`set -a && . ./.env.local`)
— you don't need a separate dotenv tool.

For the separate staging project, create the complete, repeatable test fixture with:

```
npm run db:seed-staging
```

This command loads `.env.staging.local`, verifies that its database and Supabase URLs
refer to the same project, then upserts test Auth accounts, catalogue/variants,
shipping fees, promotions, cart, wishlist, waitlist, order, support, messaging and
admin-dashboard data. It never deletes existing rows. The two staging login emails
and their newly generated password are printed after the records are verified.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Start Vite dev server with the API middleware |
| `pnpm run build` | `prisma generate` + production build |
| `pnpm run lint` | ESLint |
| `pnpm run preview` | Preview the production build locally |
| `pnpm run db:push` | Push `prisma/schema.prisma` directly; use only for disposable/staging databases |
| `pnpm run db:pull` | Introspect the database back into the schema |
| `pnpm run db:generate` | Regenerate the Prisma client |
| `pnpm run db:seed-content` | Create the default Home/Shop/Departments page sections (safe to re-run) |
| `npm run db:seed-staging` | Seed and verify a complete staging-only test fixture; prints fresh test credentials |
| `pnpm run db:backup` | Full JSON backup of the database to `~/grv-backups` (outside the repo; contains customer data) |
| `pnpm run db:lock` | Lock the database against Supabase's public REST API. **Re-run after any `db:push` that adds tables** |
| `npm run db:check-financial-migration` | Read-only verification of the production financial-integrity schema using `.env.local` |
| `npm run db:check-financial-migration:staging` | Read-only verification using `.env.staging.local` |
| `npm run db:check-security` | Read-only production RLS, public-grant, and auth-trigger verification using `.env.local` |
| `npm run db:check-security:staging` | The same security verification using `.env.staging.local` |
| `pnpm test` | Unit tests (Vitest) |

**Schema changes**: do not use `prisma db push` against the live database. Production
changes must be reviewed SQL migrations under `prisma/migrations`. The current
financial-integrity rollout is
[`prisma/migrations/20261019120000_financial_integrity/migration.sql`](prisma/migrations/20261019120000_financial_integrity/migration.sql).
Apply it in the production Supabase SQL editor only after taking and checking a
backup, then run `npm run db:check-financial-migration` before deploying the code.

## Deployment

Deploys to Vercel. [vercel.json](vercel.json) routes all `/api/*` traffic to the single
serverless function and runs the abandoned-cart/wishlist reminder sweep
(`/api/admin/reminders/run`) daily via Vercel Cron, authenticated with `CRON_SECRET`.

## Backend structure

All API logic lives in [src/api/routes.js](src/api/routes.js): a `ROUTES` table maps each
path (with `:param` placeholders where needed) and HTTP method to a handler function
defined earlier in the same file, plus a per-route error message. `handleApiRequest` at
the bottom of the file matches the request against that table, in order, and returns
`404` for an unmatched path or `405` for a matched path with the wrong method.

Admin endpoints (`/api/admin/*`) each call `requireAdmin` themselves at the top of their
handler, independent of routing — see [src/server/requireAdmin.js](src/server/requireAdmin.js).
When adding a new admin endpoint, copy that guard into the new handler; the route table
does not enforce it for you.
# archademy

## Before going live

- Set every variable in `.env.example` in Vercel (Settings → Environment Variables), with
  `APP_URL` set to the real site address. Server-only secrets must never start with `VITE_`.
- Add `&connection_limit=1` to `DATABASE_URL` in Vercel (serverless + Supabase pooler).
- Run `pnpm run db:lock` after pushing the schema to a new database, and apply
  [prisma/sql/sync_auth_user_trigger.sql](prisma/sql/sync_auth_user_trigger.sql) in the Supabase SQL editor
  so new sign-ups get a `User` row.
- The Content-Security-Policy in `vercel.json` is report-only. Once the browser console shows
  no violations on your real pages, change it to enforcing.
- Take a backup (`pnpm run db:backup`) before and after loading real data.


## Safety fixes and rollout

See [audits/REMEDIATION.md](audits/REMEDIATION.md) for current fixes, verification,
release gates and the checkout rollback procedure. The original findings remain
in [audits/PROJECT_AUDIT.md](audits/PROJECT_AUDIT.md) as historical context.

`pnpm run db:check-security` inspects RLS, public grants and the signup trigger
without modifying database state. `pnpm run preview` now loads `.env.local` like
development and includes the API middleware; use staging/provider test settings
for end-to-end QA.

Checkout stock now represents units available for purchase, excluding pending
payment reservations. Admin → Delivery & Payments shows outstanding holds and
runs recovery checks. Do not delete old PendingCheckout records based only on
age, and do not roll back to the old finalizer while reservations remain.
