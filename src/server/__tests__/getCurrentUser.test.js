import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const findUnique = vi.fn();
vi.mock("../supabaseAdmin.js", () => ({ getSupabaseAdmin: () => ({ auth: { getUser } }) }));
vi.mock("../prisma.js", () => ({ prisma: { user: { findUnique } } }));

const { getCurrentUser, clearCurrentUserCache } = await import("../getCurrentUser.js");
const req = (token) => new Request("https://x.test", { headers: token ? { authorization: `Bearer ${token}` } : {} });

beforeEach(() => {
  clearCurrentUserCache();
  getUser.mockReset();
  findUnique.mockReset();
});

describe("getCurrentUser", () => {
  it("verifies a token once for a burst of requests but always reads the user row fresh", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    findUnique
      .mockResolvedValueOnce({ id: "u1", email: "a@x.com", role: "CUSTOMER", active: true, marketingOptIn: false })
      .mockResolvedValueOnce({ id: "u1", email: "a@x.com", role: "CUSTOMER", active: true, marketingOptIn: true });
    const first = await getCurrentUser(req("tok"));
    const second = await getCurrentUser(req("tok"));
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(first.marketingOptIn).toBe(false);
    expect(second.marketingOptIn).toBe(true); // a settings change shows up immediately
  });

  it("a disabled account is refused immediately, even with a remembered token", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    findUnique.mockResolvedValueOnce({ id: "u1", role: "ADMIN", active: true });
    expect(await getCurrentUser(req("tok"))).not.toBeNull();
    findUnique.mockResolvedValueOnce({ id: "u1", role: "ADMIN", active: false });
    expect(await getCurrentUser(req("tok"))).toBeNull();
  });

  it("never remembers a failed verification", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad" } });
    expect(await getCurrentUser(req("bad"))).toBeNull();
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    findUnique.mockResolvedValueOnce({ id: "u1", role: "CUSTOMER", active: true });
    expect(await getCurrentUser(req("bad"))).not.toBeNull();
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("returns null with no token", async () => {
    expect(await getCurrentUser(req())).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
});
