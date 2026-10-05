// Locks the database against Supabase's public REST interface.
//
// Supabase exposes every table in the `public` schema over HTTP, and the
// "anon" key that does it is shipped inside the website's JavaScript. Unless
// row-level security is on, that key alone can read (and with the right
// grants, write) every table: customers, addresses, orders.
//
// This app never uses that interface — all data goes through /api/* and
// Prisma, which connects as the table owner and is not subject to RLS. So
// the correct posture is: RLS enabled everywhere with NO policies (deny by
// default), and no table privileges for anon/authenticated at all.
//
// Idempotent. Re-run after any `prisma db push` that adds tables:
//   set -a && . ./.env.local && set +a && node scripts/lockDownPublicTables.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;

  for (const { tablename } of tables) {
    // tablename comes from pg_tables, not user input; quoted as an identifier.
    const ident = `"public"."${tablename.replace(/"/g, '""')}"`;
    await prisma.$executeRawUnsafe(`ALTER TABLE ${ident} ENABLE ROW LEVEL SECURITY`);
  }
  await prisma.$executeRawUnsafe(
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`,
  );
  await prisma.$executeRawUnsafe(
    `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated`,
  );
  // So tables created by future schema pushes start locked too.
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`,
  );

  const status = await prisma.$queryRaw`
    SELECT c.relname AS table, c.relrowsecurity AS rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`;
  const unlocked = status.filter((row) => !row.rls);
  console.log(`${status.length} tables checked; ${status.length - unlocked.length} have RLS on.`);
  if (unlocked.length) {
    console.error("STILL UNLOCKED:", unlocked.map((row) => row.table).join(", "));
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error("Lock-down failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
