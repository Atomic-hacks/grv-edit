import { describe, it, expect } from "vitest";
import { safeReturnTo } from "../safeReturnTo.js";

describe("safeReturnTo", () => {
  it("keeps normal in-site paths, including query strings", () => {
    for (const path of ["/account", "/checkout", "/product/prd-001", "/men/footwear?brand=x&sort=price"]) {
      expect(safeReturnTo(path), path).toBe(path);
    }
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of [
      "//evil.com",
      "//evil.com/path",
      "/\\evil.com",
      "https://evil.com",
      "http://evil.com",
      "javascript:alert(1)",
      "data:text/html,x",
      "@evil.com",
      ".evil.com",
      "evil.com",
      "/path\\with\\backslash",
      "/ok\nLocation: evil",
      "",
      "   ",
      null,
      undefined,
      42,
      {},
    ]) {
      expect(safeReturnTo(bad), String(bad)).toBe("/account");
    }
  });

  it("uses the caller's fallback", () => {
    expect(safeReturnTo("//evil.com", "/welcome")).toBe("/welcome");
  });
});
