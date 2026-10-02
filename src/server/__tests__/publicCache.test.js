import { describe, it, expect } from "vitest";
import { publicCacheControl } from "../publicCache.js";

const req = (path, { method = "GET", headers = {} } = {}) =>
  new Request(`https://grvhq.com${path}`, { method, headers });

describe("publicCacheControl", () => {
  it("caches anonymous public catalogue GETs", () => {
    for (const path of [
      "/api/content-sections?page=SHOP",
      "/api/products?category=men",
      "/api/products/filters?category=men",
      "/api/products/new-arrivals",
      "/api/categories",
      "/api/brands",
      "/api/brands/northline",
      "/api/filter-types",
      "/api/tags",
      "/api/journal",
    ]) {
      expect(publicCacheControl(req(path), 200), path).toContain("s-maxage");
    }
  });

  it("caches product detail for much less time than a listing (live stock)", () => {
    const detail = publicCacheControl(req("/api/products/prd-001"), 200);
    const listing = publicCacheControl(req("/api/products?category=men"), 200);
    expect(detail).toContain("s-maxage=20");
    expect(listing).toContain("s-maxage=60");
  });

  it("never caches personal, admin, checkout or webhook routes", () => {
    for (const path of [
      "/api/me",
      "/api/orders",
      "/api/orders/abc",
      "/api/wishlist",
      "/api/cart",
      "/api/waitlist",
      "/api/account/addresses",
      "/api/admin/products",
      "/api/admin/content-sections",
      "/api/checkout/verify",
      "/api/cases",
      "/api/webhooks/paystack",
    ]) {
      expect(publicCacheControl(req(path), 200), path).toBeNull();
    }
  });

  it("never caches a request carrying credentials, even on a public path", () => {
    expect(publicCacheControl(req("/api/products", { headers: { authorization: "Bearer x" } }), 200)).toBeNull();
    expect(publicCacheControl(req("/api/products", { headers: { cookie: "a=b" } }), 200)).toBeNull();
  });

  it("never caches errors or non-GET requests", () => {
    expect(publicCacheControl(req("/api/products"), 500)).toBeNull();
    expect(publicCacheControl(req("/api/products"), 404)).toBeNull();
    expect(publicCacheControl(req("/api/products", { method: "POST" }), 200)).toBeNull();
  });
});
