import { describe, it, expect, vi } from "vitest";

const rateLimitCalls = [];
vi.mock("../../server/rateLimit.js", () => ({
  checkRateLimit: async (key, opts) => {
    rateLimitCalls.push({ key, ...opts });
    return { allowed: !key.includes("flooded") };
  },
  clientIp: (request) => request.headers.get("x-vercel-forwarded-for") || "unknown",
}));
const captured = [];
vi.mock("../../server/sentry.js", () => ({
  Sentry: { captureMessage: (m, o) => captured.push({ m, o }), captureException: () => {} },
}));
vi.mock("../../server/prisma.js", () => ({ prisma: {} }));
vi.mock("../../server/supabaseAdmin.js", () => ({ getSupabaseAdmin: () => ({}) }));

const { handleApiRequest } = await import("../routes.js");

const post = (body, { ip = "102.90.98.94", type = "application/csp-report" } = {}) =>
  handleApiRequest(
    new Request("https://www.grvhq.com/api/csp-report", {
      method: "POST",
      headers: { "content-type": type, "x-vercel-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const violation = (blocked) => ({
  "csp-report": {
    "effective-directive": "script-src",
    "blocked-uri": blocked,
    "document-uri": "https://www.grvhq.com/",
  },
});

describe("POST /api/csp-report", () => {
  it("is routed and accepts an unauthenticated report", async () => {
    const response = await post(violation("https://evil.test/x.js"));
    expect(response.status).toBe(204);
  });

  it("forwards a real violation to Sentry", async () => {
    captured.length = 0;
    await post(violation("https://evil.test/x.js"));
    expect(captured).toHaveLength(1);
    expect(captured[0].o.tags).toMatchObject({ cspDirective: "script-src" });
  });

  it("drops browser-extension noise", async () => {
    captured.length = 0;
    for (const uri of ["chrome-extension://abc/inject.js", "moz-extension://x/y.js", "safari-web-extension://z"]) {
      await post(violation(uri));
    }
    expect(captured).toHaveLength(0);
  });

  it("is rate limited", async () => {
    rateLimitCalls.length = 0;
    await post(violation("https://evil.test/x.js"));
    expect(rateLimitCalls[0].key).toContain("csp-report:");
    expect(rateLimitCalls[0].max).toBeGreaterThan(0);
  });

  it("stays quiet when throttled", async () => {
    captured.length = 0;
    const response = await post(violation("https://evil.test/x.js"), { ip: "flooded" });
    expect(response.status).toBe(204);
    expect(captured).toHaveLength(0);
  });

  it("rejects an oversized body without parsing it", async () => {
    captured.length = 0;
    const response = await post("x".repeat(64 * 1024));
    expect(response.status).toBe(204);
    expect(captured).toHaveLength(0);
  });

  it("never 500s on malformed input", async () => {
    for (const body of ["not json", "", "[]", "null", '{"unexpected":1}']) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(204);
    }
  });
});
