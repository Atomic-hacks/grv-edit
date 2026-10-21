import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAuthenticatedFetch,
  createAuthenticatedRequest,
} from "../apiClient.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authenticated API clients", () => {
  it("attaches the access token while preserving caller headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("template"));
    vi.stubGlobal("fetch", fetchMock);

    await createAuthenticatedFetch({ access_token: "admin-token" })(
      "/api/admin/template",
      { headers: { Accept: "text/csv" } },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/template",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
          Accept: "text/csv",
        }),
      }),
    );
  });

  it("continues to decode JSON for ordinary authenticated requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      createAuthenticatedRequest({ access_token: "token" })("/api/account"),
    ).resolves.toEqual({ ok: true });
  });
});
