import { describe, expect, it } from "vitest";
import { cleanPath, deviceFrom, referrerHostFrom } from "../visits.js";

describe("cleanPath", () => {
  it("drops query strings and keeps ordinary paths", () => {
    expect(cleanPath("/shop?brand=zara#x")).toBe("/shop");
    expect(cleanPath("/")).toBe("/");
  });
  it("refuses admin, api, token-bearing and protocol-relative paths", () => {
    for (const path of ["/admin/orders", "/api/x", "/reset-password", "/confirm-email", "//evil.com", "https://x.com", 5]) {
      expect(cleanPath(path)).toBeNull();
    }
  });
});

describe("referrerHostFrom", () => {
  it("keeps only the host and ignores our own site", () => {
    expect(referrerHostFrom("https://www.instagram.com/p/abc?x=1", "grv.com")).toBe("instagram.com");
    expect(referrerHostFrom("https://grv.com/shop", "grv.com")).toBeNull();
    expect(referrerHostFrom("", "grv.com")).toBeNull();
    expect(referrerHostFrom("not a url", "grv.com")).toBeNull();
  });
});

describe("deviceFrom", () => {
  it("classifies by user agent", () => {
    expect(deviceFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 17) Mobile")).toBe("mobile");
    expect(deviceFrom("Mozilla/5.0 (iPad; CPU OS 17)")).toBe("tablet");
    expect(deviceFrom("Mozilla/5.0 (Macintosh)")).toBe("desktop");
  });
});
