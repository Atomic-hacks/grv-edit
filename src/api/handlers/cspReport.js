// Collector for Content-Security-Policy violation reports.
//
// The site shipped a report-only CSP with no report-uri, which means it has
// never blocked anything and never told anyone about it. This endpoint gives
// the policy somewhere to report to, so the enforcing policy can be widened
// or tightened on evidence instead of guesswork.
//
// It is unauthenticated by necessity — browsers post reports with no
// credentials — so it is throttled, size-capped, and never stores anything.
import { checkRateLimit, clientIp } from "../../server/rateLimit.js";
import { Sentry } from "../../server/sentry.js";

// Browser extensions and injected toolbars generate the overwhelming
// majority of real-world CSP noise, about pages we do not control and
// cannot fix. Dropping them keeps the signal readable.
const IGNORED_SCHEMES = [
  "chrome-extension:",
  "moz-extension:",
  "safari-extension:",
  "safari-web-extension:",
  "webkit-masked-url:",
  "about:",
  "data:text/html",
];

const MAX_BODY_BYTES = 16 * 1024;

// A reported URI can carry a query string, and ours carry verification and
// unsubscribe tokens. Only the origin and path are ever useful here.
const trimUri = (value) => {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    // Non-special schemes (chrome-extension:, moz-extension:) report an
    // origin of the literal string "null", which would erase the scheme and
    // let extension noise past the filter below. Rebuild it by hand.
    const base =
      url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
    return `${base}${url.pathname}`;
  } catch {
    return value.slice(0, 200);
  }
};

const isIgnorable = (blockedUri) =>
  IGNORED_SCHEMES.some((scheme) => blockedUri.startsWith(scheme));

/** Normalizes both report formats browsers use into one shape. */
export const normalizeCspReports = (payload) => {
  const raw = Array.isArray(payload)
    ? // Reporting API: [{ type: "csp-violation", body: {...} }]
      payload
        .filter((entry) => entry?.type === "csp-violation" || entry?.body)
        .map((entry) => entry.body)
    : // Legacy: { "csp-report": {...} }
      [payload?.["csp-report"]];

  return raw.filter(Boolean).map((report) => ({
    directive:
      report.effectiveDirective ||
      report["effective-directive"] ||
      report.violatedDirective ||
      report["violated-directive"] ||
      "unknown",
    blockedUri: trimUri(report.blockedURL || report["blocked-uri"] || ""),
    documentUri: trimUri(report.documentURL || report["document-uri"] || ""),
    disposition: report.disposition || "enforce",
  }));
};

export const handleCspReport = async (request) => {
  const limit = await checkRateLimit(`csp-report:${clientIp(request)}`, {
    max: 30,
    windowMs: 60_000,
  });
  // Always 204: a violation report is fire-and-forget, and an error here
  // would only generate console noise in a visitor's browser.
  if (!limit.allowed) return new Response(null, { status: 204 });

  const body = await request.text();
  if (!body || body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 204 });
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 204 });
  }

  for (const report of normalizeCspReports(payload)) {
    if (isIgnorable(report.blockedUri)) continue;
    console.warn("CSP violation", report);
    Sentry.captureMessage(
      `CSP ${report.disposition}: ${report.directive} blocked ${report.blockedUri || "inline"}`,
      {
        level: report.disposition === "report" ? "info" : "warning",
        tags: { route: "csp-report", cspDirective: report.directive },
      },
    );
  }

  return new Response(null, { status: 204 });
};
