import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rateLimit.js";

const fakePrisma = () => {
  const hits = [];
  const client = {
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
  let previous = Promise.resolve();
  client.$queryRaw = async () => [];
  client.$transaction = (work) => { const next = previous.then(() => work(client)); previous = next.catch(() => {}); return next; };
  return client;
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

  it("fails closed if the database check throws", async () => {
    // A failed admission check must not silently admit public writes.
    const prisma = {
      rateLimitHit: {
        count: async () => {
          throw new Error("connection refused");
        },
      },
    };
    const result = await checkRateLimit("contact:1.2.3.4", { prisma });
    expect(result.allowed).toBe(false);
  });
  it("admits only the configured number in a concurrent burst", async () => {
    const prisma = fakePrisma();
    const results = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit("same-key", { max: 5, prisma })));
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
  });
});
