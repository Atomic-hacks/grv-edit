// Node-only Prisma client singleton for use inside the Vite API middleware
// (src/api/*). Never import this from browser-rendered components.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

const getDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  const url = new URL(databaseUrl);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "5");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "20");
  }
  return url.toString();
};

const databaseUrl = getDatabaseUrl();
const prismaOptions = databaseUrl
  ? { datasources: { db: { url: databaseUrl } } }
  : {};

export const prisma =
  globalForPrisma.__prisma ??
  (globalForPrisma.__prisma = new PrismaClient(prismaOptions));
