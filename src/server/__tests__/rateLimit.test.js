import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rateLimit.js";

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
