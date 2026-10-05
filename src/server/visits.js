// First-party page-view tracking. Deliberately minimal: a random browser id,
// the path, the referring host, device class and country (from Vercel's edge
// header). No IP address, no user agent string and no cookies are stored.
import { prisma } from "./prisma.js";
import { getCurrentUser } from "./getCurrentUser.js";
import { clientIp } from "./rateLimit.js";
import { runInBackground } from "./background.js";

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|facebookexternalhit/i;
const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

const noContent = () => new Response(null, { status: 204 });

// Page-view tracking fires on every navigation, so it must cost the database
// as little as possible. The abuse limit is therefore kept in memory (per
// server instance, good enough to stop a script hammering the endpoint)
// instead of costing two database round trips per view like checkRateLimit.
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
export const allowTrackHit = (key, now = Date.now()) => {
  const recent = (hits.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (now - times[times.length - 1] >= WINDOW_MS) hits.delete(k);
  }
  return true;
};

export const deviceFrom = (userAgent = "") => {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobi|android|iphone/i.test(userAgent)) return "mobile";
  return "desktop";
};

// Only the host of the referrer is kept, and never our own site.
export const referrerHostFrom = (referrer, ownHost) => {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host && host !== ownHost?.replace(/^www\./, "") ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
};

// A path with the query string removed and nothing that could carry a
// credential: /reset-password and /confirm-email links include tokens.
export const cleanPath = (value) => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  const path = value.split(/[?#]/)[0].slice(0, 300);
  if (/^\/(admin|api|reset-password|confirm-email|email-confirmed|unsubscribe)(\/|$)/i.test(path)) return null;
  return path || "/";
};

export const recordVisit = async (request) => {
  const userAgent = request.headers.get("user-agent") || "";
  if (BOT.test(userAgent)) return noContent();

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  const path = cleanPath(body?.path);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(visitorId) || !path) return noContent();

  if (!allowTrackHit(clientIp(request))) return noContent();

  // Staff browsing the storefront would otherwise inflate their own numbers.
  const user = request.headers.get("authorization") ? await getCurrentUser(request).catch(() => null) : null;
  if (user && user.role !== "CUSTOMER") return noContent();

  const ownHost = new URL(request.url).hostname;
  // The browser doesn't wait for the insert; it finishes after the 204.
  runInBackground(prisma.siteVisit.create({
    data: {
      visitorId,
      userId: user?.id || null,
      path,
      referrer: referrerHostFrom(typeof body.referrer === "string" ? body.referrer : "", ownHost),
      device: deviceFrom(userAgent),
      country: (request.headers.get("x-vercel-ip-country") || "").slice(0, 2).toUpperCase() || null,
    },
  }), "Record visit");

  if (Math.random() < 0.01) {
    void prisma.siteVisit
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } })
      .catch(() => {});
  }
  return noContent();
};
