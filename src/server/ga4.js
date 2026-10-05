// Read-only Google Analytics 4 Data API client, used by the admin Visitors
// page. No Google SDK: the service-account login is a signed JWT exchanged
// for a short-lived token, then plain REST calls.
//
// Needs three server-side env vars (never VITE_-prefixed, never sent to the
// browser): GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY. The service
// account only needs the "Viewer" role on the GA4 property.
import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";

export const isGa4Configured = () =>
  Boolean(process.env.GA4_PROPERTY_ID && process.env.GA4_CLIENT_EMAIL && process.env.GA4_PRIVATE_KEY);

const base64url = (input) => Buffer.from(input).toString("base64url");

let cachedToken = null;
const getAccessToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(JSON.stringify({ iss: process.env.GA4_CLIENT_EMAIL, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })),
  ].join(".");
  // Env files and dashboards often store the key with literal "\n" sequences.
  const key = process.env.GA4_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error(`Google sign-in failed (${response.status}). Check GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY.`);
  const body = await response.json();
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
};

const call = async (method, body) => {
  const response = await fetch(`${DATA_API}/properties/${process.env.GA4_PROPERTY_ID}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({})))?.error?.message || response.status;
    throw new Error(`Google Analytics: ${detail}`);
  }
  return response.json();
};

// [{ dims: [..], metrics: [..numbers] }]
export const rowsOf = (report) =>
  (report.rows || []).map((row) => ({
    // Reports with no dimensions (the totals row) omit this field entirely.
    dims: (row.dimensionValues || []).map((d) => d.value),
    metrics: row.metricValues.map((m) => Number(m.value)),
  }));

const runReport = (range, dimensions, metrics, extra = {}) =>
  call("runReport", {
    dateRanges: [range],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    ...extra,
  }).then(rowsOf);

// The Data API has a daily quota per property; the dashboard is cached for a
// few minutes per date range so reloads don't burn it.
const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

export const getGa4Overview = async (from, to) => {
  const key = `${from}:${to}`;
  const hit = cache.get(key);
  if (hit && hit.at > Date.now() - TTL_MS) return hit.value;

  const range = { startDate: from, endDate: to };
  const [totals, daily, channels, countries, pages, realtime] = await Promise.all([
    runReport(range, [], ["activeUsers", "newUsers", "sessions", "screenPageViews", "engagementRate", "averageSessionDuration"]),
    runReport(range, ["date"], ["activeUsers", "sessions"], { orderBys: [{ dimension: { dimensionName: "date" } }] }),
    runReport(range, ["sessionDefaultChannelGroup"], ["sessions", "activeUsers"], {
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8,
    }),
    runReport(range, ["country"], ["activeUsers"], { orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 8 }),
    runReport(range, ["pagePath"], ["screenPageViews", "activeUsers"], {
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10,
    }),
    call("runRealtimeReport", { metrics: [{ name: "activeUsers" }] }).then(rowsOf),
  ]);

  const [t] = totals.length ? totals : [{ metrics: [0, 0, 0, 0, 0, 0] }];
  const value = {
    activeNow: realtime[0]?.metrics[0] || 0,
    activeUsers: t.metrics[0],
    newUsers: t.metrics[1],
    sessions: t.metrics[2],
    pageViews: t.metrics[3],
    engagementRate: t.metrics[4],
    avgSessionSeconds: t.metrics[5],
    daily: daily.map((r) => ({ day: `${r.dims[0].slice(0, 4)}-${r.dims[0].slice(4, 6)}-${r.dims[0].slice(6)}`, users: r.metrics[0], sessions: r.metrics[1] })),
    channels: channels.map((r) => ({ channel: r.dims[0], sessions: r.metrics[0], users: r.metrics[1] })),
    countries: countries.map((r) => ({ country: r.dims[0], users: r.metrics[0] })),
    pages: pages.map((r) => ({ path: r.dims[0], views: r.metrics[0], users: r.metrics[1] })),
  };
  cache.set(key, { at: Date.now(), value });
  return value;
};
