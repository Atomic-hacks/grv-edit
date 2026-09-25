import { prisma as defaultPrisma } from "./prisma.js";

/**
 * Sliding-window rate limit backed by Postgres — no new infra, since the
 * app already has a database and this only needs to survive across
 * serverless invocations, not be fast enough for a login endpoint (Supabase
 * Auth already rate-limits its own sign-in calls; this is for the app's own
 * open, unauthenticated write endpoints).
 *
 * Returns { allowed, retryAfterSeconds }. Never throws: a rate-limit check
 * that itself fails should fail open, not take the endpoint down.
 */
export const checkRateLimit = async (
  key,
  { max = 5, windowMs = 60_000, prisma = defaultPrisma } = {},
) => {
  const now = Date.now();
  const windowStart = new Date(now - windowMs);

  try {
    const count = await prisma.rateLimitHit.count({
      where: { key, createdAt: { gte: windowStart } },
    });
    if (count >= max) {
      return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
    }

    await prisma.rateLimitHit.create({ data: { key } });

    // Opportunistic prune, cheap and rare enough (1-in-20) that this table
    // never needs a dedicated cleanup job.
    if (Math.random() < 0.05) {
      void prisma.rateLimitHit
        .deleteMany({ where: { createdAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } })
        .catch(() => {});
    }

    return { allowed: true };
  } catch (error) {
    console.error("Rate limit check failed, failing open", { key, error });
    return { allowed: true };
  }
};

/** Best-effort client IP from Vercel's forwarded-for header. */
export const clientIp = (request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
