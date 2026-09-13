// Node-only Prisma client singleton for use inside the Vite API middleware
// (src/api/*). Never import this from browser-rendered components.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ?? (globalForPrisma.__prisma = new PrismaClient());
