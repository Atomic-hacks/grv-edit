import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("../../server/prisma.js", () => ({ prisma: {} }));
vi.mock("../../server/supabaseAdmin.js", () => ({ getSupabaseAdmin: () => ({}) }));

const { checkoutReturnOrigin } = await import("../routes.js");

const req = (url) => new Request(url, { method: "POST" });
const originalAppUrl = process.env.APP_URL;
afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
});

describe("checkoutReturnOrigin", () => {
  it("ignores a forged Host header (payment redirect hijack)", () => {
    delete process.env.APP_URL;
    expect(checkoutReturnOrigin(req("https://evil.test/api/checkout/initialize")))
      .toBe("https://www.grvhq.com");
  });

  it("ignores a lookalike host", () => {
    delete process.env.APP_URL;
    for (const host of ["grvhq.com.evil.test", "wwwgrvhq.com", "www.grvhq.com.attacker.io"]) {
      expect(checkoutReturnOrigin(req(`https://${host}/api/checkout/initialize`)), host)
        .toBe("https://www.grvhq.com");
    }
  });

  it("uses APP_URL when it is a real https URL", () => {
    process.env.APP_URL = "https://www.grvhq.com";
    expect(checkoutReturnOrigin(req("https://evil.test/x"))).toBe("https://www.grvhq.com");
  });

  it("never returns a placeholder APP_URL, which would break checkout", () => {
    process.env.APP_URL = "https://<your-vercel-domain>";
    const origin = checkoutReturnOrigin(req("https://www.grvhq.com/api/checkout/initialize"));
    expect(origin).not.toContain("<");
    expect(() => new URL(`${origin}/checkout/complete`)).not.toThrow();
  });

  it("survives APP_URL being unset, blank or malformed", () => {
    for (const value of [undefined, "", "   ", "not-a-url", "ftp://x"]) {
      if (value === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = value;
      const origin = checkoutReturnOrigin(req("https://www.grvhq.com/api/checkout/initialize"));
      expect(() => new URL(origin), String(value)).not.toThrow();
      expect(origin, String(value)).toBe("https://www.grvhq.com");
    }
  });

  it("always yields a usable absolute callback URL", () => {
    delete process.env.APP_URL;
    for (const host of ["www.grvhq.com", "evil.test", "grvhq.com"]) {
      const url = new URL(`${checkoutReturnOrigin(req(`https://${host}/x`))}/checkout/complete`);
      expect(url.protocol).toBe("https:");
      expect(url.pathname).toBe("/checkout/complete");
    }
  });
});
