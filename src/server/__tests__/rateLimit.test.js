import { describe, it, expect } from "vitest";
import { checkRateLimit, clientIp } from "../rateLimit.js";

const fakePrisma = () => {
  const hits = [];
  return {
    hits,
    rateLimitHit: {
      count: async ({ where }) =>
        hits.filter(
          (hit) => hit.key === where.key && hit.createdAt >= where.createdAt.gte,
        ).length,
      create: async ({ data }) => {
        const hit = { ...data, createdAt: new Date() };
        hits.push(hit);
        return hit;
      },
      deleteMany: async () => ({ count: 0 }),
    },
  };
};

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const prisma = fakePrisma();
    for (let i = 0; i < 5; i += 1) {
      const result = await checkRateLimit("contact:1.2.3.4", { max: 5, prisma });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks once the limit is reached within the window", async () => {
    const prisma = fakePrisma();
    for (let i = 0; i < 5; i += 1) {
      await checkRateLimit("contact:1.2.3.4", { max: 5, prisma });
    }
    const sixth = await checkRateLimit("contact:1.2.3.4", { max: 5, prisma });
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks keys independently", async () => {
    // One IP hammering the endpoint must not lock out everyone else.
    const prisma = fakePrisma();
    for (let i = 0; i < 5; i += 1) {
      await checkRateLimit("contact:1.2.3.4", { max: 5, prisma });
    }
    const otherIp = await checkRateLimit("contact:9.9.9.9", { max: 5, prisma });
    expect(otherIp.allowed).toBe(true);
  });

  it("fails open if the database check throws", async () => {
    // A rate limiter that takes the endpoint down when the DB hiccups is
    // worse than no rate limiter.
    const prisma = {
      rateLimitHit: {
        count: async () => {
          throw new Error("connection refused");
        },
      },
    };
    const result = await checkRateLimit("contact:1.2.3.4", { prisma });
    expect(result.allowed).toBe(true);
  });
});

describe("clientIp", () => {
  const req = (headers) =>
    new Request("https://www.grvhq.com/api/contact", { method: "POST", headers });

  it("ignores a client-supplied X-Forwarded-For (throttle bypass)", () => {
    // Same caller, five different forged headers: must collapse to one key.
    const keys = new Set(
      ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4", "10.0.0.5"].map((forged) =>
        clientIp(
          req({ "x-forwarded-for": forged, "x-vercel-forwarded-for": "102.90.98.94" }),
        ),
      ),
    );
    expect(keys).toEqual(new Set(["102.90.98.94"]));
  });

  it("uses the edge-set x-vercel-forwarded-for", () => {
    expect(clientIp(req({ "x-vercel-forwarded-for": "102.90.98.94" }))).toBe("102.90.98.94");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "41.58.1.2" }))).toBe("41.58.1.2");
  });

  it("takes the first hop when the trusted header holds a chain", () => {
    expect(clientIp(req({ "x-vercel-forwarded-for": "102.90.98.94, 10.1.1.1" }))).toBe("102.90.98.94");
  });

  it("shares one bucket rather than minting new ones when no trusted header exists", () => {
    expect(clientIp(req({ "x-forwarded-for": "10.0.0.9" }))).toBe("unknown");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("checkRateLimit failure mode", () => {
  const brokenPrisma = {
    rateLimitHit: {
      count: async () => {
        throw new Error("database unavailable");
      },
      create: async () => {
        throw new Error("database unavailable");
      },
      deleteMany: async () => ({ count: 0 }),
    },
  };

  it("fails open by default so the storefront keeps working", async () => {
    const result = await checkRateLimit("k", { prisma: brokenPrisma });
    expect(result.allowed).toBe(true);
  });

  it("fails closed when the endpoint opts in (paid email sends)", async () => {
    const result = await checkRateLimit("k", {
      prisma: brokenPrisma,
      failClosed: true,
      windowMs: 60_000,
    });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(60);
  });
});
