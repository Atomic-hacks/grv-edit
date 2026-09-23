# GRV

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
- **Images**: Cloudinary

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
4. (Optional) Seed sample catalog data:
   ```
   pnpm run db:seed
   ```
5. Start the dev server:
   ```
   pnpm run dev
   ```

The dev server and all scripts load `.env.local` automatically (`set -a && . ./.env.local`)
— you don't need a separate dotenv tool.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Start Vite dev server with the API middleware |
| `pnpm run build` | `prisma generate` + production build |
| `pnpm run lint` | ESLint |
| `pnpm run preview` | Preview the production build locally |
| `pnpm run db:push` | Push `prisma/schema.prisma` to the database (no migration files — see below) |
| `pnpm run db:pull` | Introspect the database back into the schema |
| `pnpm run db:generate` | Regenerate the Prisma client |
| `pnpm run db:seed` | Seed catalog data from `src/data/products.js` |

**Schema changes**: this project uses `prisma db push` rather than `prisma migrate` —
there are no migration files. After editing `prisma/schema.prisma`, run
`pnpm run db:push` against your database before deploying.

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
