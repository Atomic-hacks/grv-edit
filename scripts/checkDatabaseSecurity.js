// Read-only production preflight: prints schema metadata, never customer data
// or credentials. Exits nonzero if lockdown or the auth sync trigger is missing.
import { PrismaClient } from '@prisma/client';
import { loadEnv } from 'vite';
const local = loadEnv('production', process.cwd(), '');
if (!process.env.DATABASE_URL && local.DATABASE_URL) process.env.DATABASE_URL = local.DATABASE_URL;
const prisma = new PrismaClient();
try {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const tables = await tx.$queryRaw`
      SELECT c.relname AS name, c.relrowsecurity AS rls,
        has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_access,
        has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated_access
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    const triggers = await tx.$queryRaw`
      SELECT t.tgname AS name FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'auth' AND c.relname = 'users'
        AND t.tgname = 'on_auth_user_created' AND t.tgenabled <> 'D'`;
    return { tables, authTriggerPresent: triggers.length > 0 };
  });
  const unsafe = result.tables.filter((row) => !row.rls || row.anon_access || row.authenticated_access);
  console.log(JSON.stringify({ tablesChecked: result.tables.length, unsafeTables: unsafe, authTriggerPresent: result.authTriggerPresent }, null, 2));
  if (!result.tables.length || unsafe.length || !result.authTriggerPresent) process.exitCode = 1;
} catch (error) {
  console.error('Read-only database security check could not complete', { code: error.code || error.errorCode || 'CONNECTION_FAILED' });
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
