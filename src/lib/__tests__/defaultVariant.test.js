import { describe, expect, it } from "vitest";
import { getDefaultVariant, isRestock } from "../variantOptions.js";

describe("default product variant", () => {
  it("keeps a completely sold-out multi-option product actionable", () => {
    const variants = [{ id: "small", stock: 0 }, { id: "large", stock: 0 }];
    expect(getDefaultVariant(variants)).toBe(variants[0]);
  });
  it("prefers an available option and handles products without variants", () => {
    const available = { id: "large", stock: 1 };
    expect(getDefaultVariant([{ id: "small", stock: 0 }, available])).toBe(available);
    expect(getDefaultVariant([])).toBeNull();
  });
});

describe("restock transitions", () => {
  it("notifies when zero or oversold stock becomes available", () => {
    expect(isRestock(0, 3)).toBe(true);
    expect(isRestock(-2, 3)).toBe(true);
    expect(isRestock(-2, 0)).toBe(false);
    expect(isRestock(2, 3)).toBe(false);
    expect(isRestock(2, 0)).toBe(false);
  });
});
