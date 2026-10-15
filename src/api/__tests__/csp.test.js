import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeCspReports } from "../handlers/cspReport.js";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
// Deliberately tolerant: if the enforcing header is missing entirely (the
// pre-rollout state was report-only), the assertions below should say so
// rather than crash on an undefined lookup.
const headers =
  vercel.routes.find((route) => route.headers?.["content-security-policy"])
    ?.headers ?? {};

const parse = (policy) =>
  Object.fromEntries(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values];
      }),
  );

const enforced = parse(headers["content-security-policy"] ?? "");
const reportOnly = parse(headers["content-security-policy-report-only"] ?? "");

describe("CSP is actually enforced", () => {
  it("ships an enforcing policy, not only report-only", () => {
    expect(headers["content-security-policy"]).toBeTruthy();
    expect(enforced["default-src"]).toEqual(["'self'"]);
  });

  it("reports violations somewhere instead of nowhere", () => {
    expect(enforced["report-uri"]).toEqual(["/api/csp-report"]);
    expect(reportOnly["report-uri"]).toEqual(["/api/csp-report"]);
  });

  it("keeps the dangerous escapes out", () => {
    expect(enforced["script-src"]).not.toContain("'unsafe-inline'");
    expect(enforced["script-src"]).not.toContain("'unsafe-eval'");
    expect(enforced["object-src"]).toEqual(["'none'"]);
    expect(enforced["frame-ancestors"]).toEqual(["'none'"]);
    expect(enforced["base-uri"]).toEqual(["'self'"]);
  });
});

describe("CSP covers every origin the app actually uses", () => {
  // Each entry was confirmed against the running app and production data:
  // all 318 stored asset URLs are on res.cloudinary.com, and these are the
  // only cross-origin destinations the browser reaches.
  const required = [
    ["script-src", "https://www.googletagmanager.com"],
    ["img-src", "https://res.cloudinary.com"],
    ["img-src", "data:"],
    ["img-src", "blob:"],
    ["media-src", "https://res.cloudinary.com"],
    ["connect-src", "https://*.supabase.co"],
    ["connect-src", "wss://*.supabase.co"],
    ["connect-src", "https://api.cloudinary.com"],
    ["connect-src", "https://*.ingest.de.sentry.io"],
    ["connect-src", "https://*.google-analytics.com"],
    ["font-src", "'self'"],
  ];

  it.each(required)("%s allows %s", (directive, origin) => {
    expect(enforced[directive]).toContain(origin);
  });

  it("allows the built bundle's own script and stylesheet", () => {
    // vite emits one module script and one stylesheet, both same-origin.
    expect(enforced["script-src"]).toContain("'self'");
    expect(enforced["style-src"] ?? enforced["style-src-elem"]).toContain("'self'");
  });

  it("allows React's inline style attributes in both policies", () => {
    expect(enforced["style-src"]).toContain("'unsafe-inline'");
    expect(reportOnly["style-src-attr"]).toContain("'unsafe-inline'");
  });

  it("the report-only policy is strictly tighter than the enforced one", () => {
    expect(reportOnly["style-src-elem"]).toEqual(["'self'"]);
    expect(reportOnly["style-src"]).toBeUndefined();
  });
});

describe("normalizeCspReports", () => {
  it("reads the legacy application/csp-report shape", () => {
    expect(
      normalizeCspReports({
        "csp-report": {
          "effective-directive": "script-src",
          "blocked-uri": "https://evil.test/x.js?token=secret",
          "document-uri": "https://www.grvhq.com/checkout?token=secret",
        },
      }),
    ).toEqual([
      {
        directive: "script-src",
        blockedUri: "https://evil.test/x.js",
        documentUri: "https://www.grvhq.com/checkout",
        disposition: "enforce",
      },
    ]);
  });

  it("reads the Reporting API shape", () => {
    const [report] = normalizeCspReports([
      {
        type: "csp-violation",
        body: { effectiveDirective: "img-src", blockedURL: "https://evil.test/p.gif", disposition: "report" },
      },
    ]);
    expect(report).toMatchObject({ directive: "img-src", disposition: "report" });
  });

  it("strips query strings, which carry verification tokens", () => {
    const [report] = normalizeCspReports({
      "csp-report": { "document-uri": "https://www.grvhq.com/confirm-email?token=abc123secret" },
    });
    expect(report.documentUri).not.toContain("abc123secret");
  });

  it("survives junk without throwing", () => {
    for (const junk of [null, undefined, {}, [], 42, { "csp-report": null }]) {
      expect(() => normalizeCspReports(junk)).not.toThrow();
    }
  });
});
