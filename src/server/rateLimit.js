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
  {
    max = 5,
    windowMs = 60_000,
    prisma = defaultPrisma,
    failClosed = false,
  } = {},
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
    // Failing open keeps the storefront working when the limiter itself is
    // the only thing broken. Endpoints that cost real money per call when
    // abused (sending email) opt into failing closed instead: a database
    // outage already breaks them a moment later anyway, so the only thing
    // failing open buys there is an unmetered send.
    console.error(
      `Rate limit check failed, failing ${failClosed ? "closed" : "open"}`,
      { key, error },
    );
    return failClosed
      ? { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) }
      : { allowed: true };
  }
};

/**
 * Client IP for throttling, taken only from headers the edge sets itself.
 *
 * `x-forwarded-for` is attacker-controlled: anyone can send their own and
 * Vercel passes it through, so keying a rate limit on it let one caller mint
 * a fresh quota per request simply by changing a header — defeating every
 * per-IP throttle (contact form, verification emails, newsletter).
 * `x-vercel-forwarded-for` and `x-real-ip` are written by Vercel's edge and
 * cannot be forged by the client.
 *
 * Falling back to "unknown" shares one bucket rather than handing out an
 * unlimited supply of them: stricter, never looser.
 */
export const clientIp = (request) => {
  const trusted =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-real-ip");
  const ip = trusted?.split(",")[0]?.trim();
  return ip || "unknown";
};
