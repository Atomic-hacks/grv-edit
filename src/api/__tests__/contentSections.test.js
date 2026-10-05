import { describe, it, expect } from "vitest";
import { isSafeUrl, sectionDataFrom, normalizeForLayout, validateSection } from "../handlers/contentSections.js";

describe("isSafeUrl", () => {
  it("allows site paths and http(s) URLs", () => {
    for (const url of ["/shop", "/men/footwear?x=1", "https://example.com/a", "http://example.com", "  /shop  "]) {
      expect(isSafeUrl(url), url).toBe(true);
    }
  });

  it("rejects anything that could run script or leave the site covertly", () => {
    for (const url of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//evil.com/x",
      "/\\evil.com",
      "vbscript:x",
      "file:///etc/passwd",
      "ftp://x.com",
      "shop",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(isSafeUrl(url), String(url)).toBe(false);
    }
  });
});

describe("sectionDataFrom", () => {
  it("rejects an unsafe link in any URL field", () => {
    for (const field of ["ctaUrl", "imageUrl", "videoUrl"]) {
      expect(sectionDataFrom({ [field]: "javascript:alert(1)" }).error, field).toBeTruthy();
    }
  });

  it("rejects an unsafe tile link or image", () => {
    const tile = { title: "A", url: "/a", imageUrl: "/a.jpg" };
    expect(sectionDataFrom({ items: [{ ...tile, url: "javascript:1" }] }).error).toBeTruthy();
    expect(sectionDataFrom({ items: [{ ...tile, imageUrl: "data:x" }] }).error).toBeTruthy();
    expect(sectionDataFrom({ items: [tile] }).error).toBeUndefined();
  });

  it("limits tiles and product counts", () => {
    const tile = { title: "A", url: "/a", imageUrl: "/a.jpg" };
    expect(sectionDataFrom({ items: Array(13).fill(tile) }).error).toBeTruthy();
    expect(sectionDataFrom({ productLimit: 0 }).error).toBeTruthy();
    expect(sectionDataFrom({ productLimit: 25 }).error).toBeTruthy();
    expect(sectionDataFrom({ productLimit: 12 }).data.productLimit).toBe(12);
  });

  it("only touches fields that were sent, so partial updates are safe", () => {
    expect(sectionDataFrom({ active: false }).data).toEqual({ active: false });
  });
});

describe("normalizeForLayout", () => {
  it("drops fields the layout doesn't use", () => {
    const out = normalizeForLayout({
      page: "SHOP",
      categoryId: "c1",
      layout: "BANNER",
      items: [{}],
      productSource: "BRAND",
      sourceBrandId: "b1",
      sourceCategoryId: "c2",
    });
    expect(out.categoryId).toBeNull();
    expect(out.items).toBeNull();
    expect(out.productSource).toBeNull();
    expect(out.sourceBrandId).toBeNull();
    expect(out.sourceCategoryId).toBeNull();
  });

  it("keeps only the product source that matches", () => {
    const out = normalizeForLayout({
      page: "SHOP",
      layout: "PRODUCTS",
      productSource: "CATEGORY",
      sourceCategoryId: "c2",
      sourceBrandId: "b1",
    });
    expect(out.sourceCategoryId).toBe("c2");
    expect(out.sourceBrandId).toBeNull();
  });
});

describe("validateSection", () => {
  const base = { page: "SHOP", layout: "BANNER", title: "T", mediaType: "IMAGE", imageUrl: "/a.jpg" };

  it("requires a title and a valid page and layout", async () => {
    expect(await validateSection({ ...base, title: "" })).toMatch(/title/i);
    expect(await validateSection({ ...base, page: "NOPE" })).toBeTruthy();
    expect(await validateSection({ ...base, layout: "NOPE" })).toBeTruthy();
  });

  it("needs the media that matches the chosen media type", async () => {
    expect(await validateSection({ ...base, imageUrl: null })).toMatch(/image/i);
    expect(await validateSection({ ...base, mediaType: "VIDEO", videoUrl: null })).toMatch(/video/i);
    expect(await validateSection({ ...base, mediaType: "VIDEO", videoUrl: "https://x.com/v.mp4" })).toBeNull();
  });

  it("requires a call-to-action to have both text and a link", async () => {
    expect(await validateSection({ ...base, ctaLabel: "Shop", ctaUrl: null })).toMatch(/both/i);
    expect(await validateSection({ ...base, ctaLabel: null, ctaUrl: "/shop" })).toMatch(/both/i);
    expect(await validateSection({ ...base, ctaLabel: "Shop", ctaUrl: "/shop" })).toBeNull();
  });

  it("needs a product source for product rails", async () => {
    expect(await validateSection({ page: "SHOP", layout: "PRODUCTS", title: "T" })).toMatch(/products/i);
    expect(await validateSection({ page: "SHOP", layout: "PRODUCTS", title: "T", productSource: "NEW_ARRIVALS" })).toBeNull();
  });
});
