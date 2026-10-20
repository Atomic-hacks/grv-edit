import { beforeEach, describe, expect, it, vi } from "vitest";

const { userLookup, variant, entries } = vi.hoisted(() => ({
  userLookup: vi.fn(),
  variant: { findUnique: vi.fn() },
  entries: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("../../server/getCurrentUser.js", () => ({ getCurrentUser: userLookup }));
vi.mock("../../server/prisma.js", () => ({ prisma: { variant, waitlistEntry: entries } }));
vi.mock("../../server/rateLimit.js", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
import { handleWaitlistRequest } from "../handlers/waitlist.js";
import { checkRateLimit } from "../../server/rateLimit.js";

const call = (method, body, id) => handleWaitlistRequest(new Request("https://test.local/api/waitlist", {
  method,
  ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
}), ["api", "waitlist", ...(id ? [id] : [])]);

beforeEach(() => {
  vi.resetAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true });
  userLookup.mockResolvedValue({ id: "u1", emailVerified: true });
  variant.findUnique.mockResolvedValue({ id: "v1", stock: 0 });
  entries.upsert.mockResolvedValue({ id: "e1", variantId: "v1", status: "WAITING" });
});

describe("waitlist", () => {
  it("requires authentication and verified email for joining", async () => {
    userLookup.mockResolvedValueOnce(null);
    expect((await call("POST", { variantId: "v1" })).status).toBe(401);
    userLookup.mockResolvedValueOnce({ id: "u1", emailVerified: false });
    expect((await call("POST", { variantId: "v1" })).status).toBe(403);
    expect(entries.upsert).not.toHaveBeenCalled();
  });
  it("rejects malformed and missing inputs", async () => {
    for (const body of ["{", "null", {}, { variantId: " " }]) {
      expect((await call("POST", body)).status).toBe(400);
    }
  });
  it("rejects missing and already available variants", async () => {
    variant.findUnique.mockResolvedValueOnce(null);
    expect((await call("POST", { variantId: "missing" })).status).toBe(404);
    variant.findUnique.mockResolvedValueOnce({ id: "v1", stock: 2 });
    expect((await call("POST", { variantId: "v1" })).status).toBe(409);
    expect(entries.upsert).not.toHaveBeenCalled();
  });
  it("joins a sold-out variant and reactivates a previously notified entry", async () => {
    entries.findUnique.mockResolvedValue({ id: "e1", status: "NOTIFIED" });
    expect((await call("POST", { variantId: "v1" })).status).toBe(200);
    expect(entries.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_variantId: { userId: "u1", variantId: "v1" } },
      update: expect.objectContaining({ status: "WAITING", deliveryStatus: "NOT_QUEUED" }),
    }));
  });
  it("keeps an existing waiting subscription idempotent", async () => {
    entries.findUnique.mockResolvedValue({ id: "e1", status: "WAITING" });
    const response = await call("POST", { variantId: "v1" });
    expect((await response.json()).entry.id).toBe("e1");
    expect(entries.upsert).not.toHaveBeenCalled();
  });
  it("scopes listing and deletion to the authenticated customer", async () => {
    entries.findMany.mockResolvedValue([]);
    await call("GET");
    expect(entries.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    await call("DELETE", undefined, "someone-elses-entry");
    expect(entries.deleteMany).toHaveBeenCalledWith({ where: { id: "someone-elses-entry", userId: "u1" } });
  });
  it("recovers from a concurrent duplicate subscription", async () => {
    entries.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "winner", status: "WAITING" });
    entries.upsert.mockRejectedValueOnce({ code: "P2002" });
    expect((await (await call("POST", { variantId: "v1" })).json()).entry.id).toBe("winner");
  });
});
