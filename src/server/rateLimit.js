import { prisma as defaultPrisma } from "./prisma.js";

// Serialize admission per key across all serverless instances with a Postgres
// advisory transaction lock. An unavailable limiter blocks writes by default;
// callers may explicitly opt into fail-open for nonessential telemetry.
export const checkRateLimit = async (
  key,
  { max = 5, windowMs = 60_000, prisma = defaultPrisma, failOpen = false } = {},
) => {
  const now = Date.now();
  const windowStart = new Date(now - windowMs);

  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
      const count = await transaction.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } });
      if (count >= max) return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      await transaction.rateLimitHit.create({ data: { key } });
      return { allowed: true };
    });
  } catch (error) {
    console.error("Rate limit check failed", { key, error });
    return { allowed: failOpen, retryAfterSeconds: 60 };
  }
};

/** Best-effort client IP from Vercel's forwarded-for header. */
export const clientIp = (request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
