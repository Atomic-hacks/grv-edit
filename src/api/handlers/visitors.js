// Admin "Visitors" dashboard: who is coming to the site, where from, what
// they look at, and — the other half — which customers have gone quiet.
// Everything is read from SiteVisit (first-party page views, see
// server/visits.js), so numbers start from the day tracking was deployed.
import { prisma } from "../../server/prisma.js";
import { requireRole } from "../../server/requireRole.js";
import { getGa4Overview, isGa4Configured } from "../../server/ga4.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const DAY = 24 * 60 * 60 * 1000;

const parseRange = (url) => {
  const now = new Date();
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")) : now;
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")) : new Date(now - 30 * DAY);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
};

const PAID = ["PAID", "SHIPPED", "DELIVERED"];

export const getAdminVisitors = async (request, url) => {
  const guard = await requireRole(request, ["ADMIN", "ANALYST"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const range = parseRange(url);
  if (!range) return jsonResponse({ error: "Invalid date range" }, 400);
  const { from, to } = range;
  const inactiveDays = Math.min(Math.max(Number(url.searchParams.get("inactiveDays")) || 30, 7), 365);

  const [
    totals, daily, topPages, sources, devices, countries, newVsReturning,
    funnelRows, paidOrders, firstTracked, lastVisitRows, customers,
  ] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS views,
             COUNT(DISTINCT "visitorId")::int AS visitors,
             COUNT(DISTINCT "visitorId") FILTER (WHERE "userId" IS NOT NULL)::int AS "signedInVisitors"
      FROM "SiteVisit" WHERE "createdAt" BETWEEN ${from} AND ${to}`,
    prisma.$queryRaw`
      SELECT to_char(("createdAt" AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS views, COUNT(DISTINCT "visitorId")::int AS visitors
      FROM "SiteVisit" WHERE "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw`
      SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT "visitorId")::int AS visitors
      FROM "SiteVisit" WHERE "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY path ORDER BY views DESC LIMIT 10`,
    prisma.$queryRaw`
      SELECT COALESCE(referrer, 'Direct') AS source, COUNT(DISTINCT "visitorId")::int AS visitors
      FROM "SiteVisit" WHERE "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY visitors DESC LIMIT 8`,
    prisma.$queryRaw`
      SELECT COALESCE(device, 'unknown') AS device, COUNT(DISTINCT "visitorId")::int AS visitors
      FROM "SiteVisit" WHERE "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY visitors DESC`,
    prisma.$queryRaw`
      SELECT COALESCE(country, '??') AS country, COUNT(DISTINCT "visitorId")::int AS visitors
      FROM "SiteVisit" WHERE "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY visitors DESC LIMIT 8`,
    prisma.$queryRaw`
      SELECT COUNT(*) FILTER (WHERE first_seen >= ${from})::int AS "newVisitors",
             COUNT(*) FILTER (WHERE first_seen < ${from})::int AS "returningVisitors"
      FROM (
        SELECT "visitorId", MIN("createdAt") AS first_seen FROM "SiteVisit"
        WHERE "visitorId" IN (SELECT DISTINCT "visitorId" FROM "SiteVisit" WHERE "createdAt" BETWEEN ${from} AND ${to})
        GROUP BY "visitorId") t`,
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT "visitorId") FILTER (WHERE path LIKE '/product/%')::int AS "viewedProduct",
             COUNT(DISTINCT "visitorId") FILTER (WHERE path = '/cart')::int AS "openedCart",
             COUNT(DISTINCT "visitorId") FILTER (WHERE path LIKE '/checkout%')::int AS "reachedCheckout"
      FROM "SiteVisit" WHERE "createdAt" BETWEEN ${from} AND ${to}`,
    prisma.order.count({ where: { status: { in: PAID }, createdAt: { gte: from, lte: to } } }),
    prisma.siteVisit.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.siteVisit.groupBy({ by: ["userId"], where: { userId: { not: null } }, _max: { createdAt: true } }),
    prisma.user.findMany({
      where: { role: "CUSTOMER", active: true },
      select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } } },
      take: 5000,
    }),
  ]);

  const lastVisit = new Map(lastVisitRows.map((row) => [row.userId, row._max.createdAt]));
  const cutoff = new Date(Date.now() - inactiveDays * DAY);
  const lapsed = customers
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      signedUpAt: customer.createdAt,
      orders: customer._count.orders,
      lastVisit: lastVisit.get(customer.id) || null,
    }))
    .filter((customer) => !customer.lastVisit || customer.lastVisit < cutoff)
    // Customers who have never been seen come last; among the rest, the
    // ones who bought and then vanished are the most worth a nudge.
    .sort((a, b) => b.orders - a.orders || (b.lastVisit?.getTime() || 0) - (a.lastVisit?.getTime() || 0));

  const [{ views, visitors, signedInVisitors }] = totals;
  const [{ newVisitors, returningVisitors }] = newVsReturning;
  const [funnel] = funnelRows;

  return jsonResponse({
    trackingSince: firstTracked?.createdAt || null,
    inactiveDays,
    views,
    visitors,
    signedInVisitors,
    anonymousVisitors: Math.max(visitors - signedInVisitors, 0),
    newVisitors,
    returningVisitors,
    daily,
    topPages,
    sources,
    devices,
    countries,
    funnel: { visitors, ...funnel, paidOrders },
    customers: {
      total: customers.length,
      activeInPeriod: customers.length - lapsed.length,
      inactive: lapsed.length,
      neverSeen: lapsed.filter((customer) => !customer.lastVisit).length,
      list: lapsed.slice(0, 500),
    },
  });
};

// Google Analytics 4 numbers for the same dashboard. Reports "not
// configured" (with no error) until the three GA4_* env vars are set.
export const getAdminGa4 = async (request, url) => {
  const guard = await requireRole(request, ["ADMIN", "ANALYST"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  if (!isGa4Configured()) return jsonResponse({ configured: false });

  const date = /^\d{4}-\d{2}-\d{2}$/;
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!date.test(from) || !date.test(to)) return jsonResponse({ error: "Invalid date range" }, 400);

  try {
    return jsonResponse({ configured: true, ...(await getGa4Overview(from, to)) });
  } catch (error) {
    console.error("GA4 report failed", error);
    // The message names the cause (wrong key, no property access) but
    // carries no credentials.
    return jsonResponse({ configured: true, error: error.message }, 502);
  }
};
