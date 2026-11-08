import { describe, it, expect } from "vitest";
import { normalizeTagInput } from "../tagInput";

describe("admin tag input", () => {
  it("makes the Date Night tag safe to round-trip through filters", () => {
    expect(normalizeTagInput({ name: "Date night ", slug: "date night " }).data)
      .toEqual({ name: "Date night", slug: "date-night" });
  });
  it("preserves omitted fields for partial updates", () => {
    expect(normalizeTagInput({ filterTypeId: "occasion" }).data).toEqual({});
  });
  it("rejects empty, invalid and excessive tag values", () => {
    for (const body of [{ name: " " }, { slug: "!!!" }, { slug: 42 }, { slug: "x".repeat(121) }]) {
      expect(normalizeTagInput(body).error).toBeTruthy();
    }
  });
});
