import { describe, it, expect } from "vitest";
import {
  NO_OPTION_COLOR,
  NO_OPTION_SIZE,
  isPlaceholderColor,
  isPlaceholderSize,
  variantLabel,
} from "../variantOptions.js";

const variant = (color, size) => ({ color, size });

describe("colourless variants (sizes only)", () => {
  it("labels a sized, colourless variant by its size alone", () => {
    expect(variantLabel(variant(NO_OPTION_COLOR, "M"))).toBe("M");
    expect(variantLabel(variant(NO_OPTION_COLOR, "L"))).toBe("L");
  });

  it("hides the colour picker when every variant uses the placeholder", () => {
    const colours = [NO_OPTION_COLOR, NO_OPTION_COLOR, NO_OPTION_COLOR];
    expect(colours.every(isPlaceholderColor)).toBe(true);
  });

  it("keeps the size picker visible for a colourless product", () => {
    const sizes = ["S", "M", "L"];
    expect(sizes.every(isPlaceholderSize)).toBe(false);
  });

  it("matches the placeholder regardless of casing or padding", () => {
    for (const value of ["Default", "default", "  DEFAULT  "]) {
      expect(isPlaceholderColor(value), value).toBe(true);
    }
  });

  it("does not mistake a real colour for the placeholder", () => {
    for (const value of ["Navy", "Default Blue", "Off-White"]) {
      expect(isPlaceholderColor(value), value).toBe(false);
    }
  });
});

describe("the other variant shapes still read correctly", () => {
  it("shows colour and size when both are real", () => {
    expect(variantLabel(variant("Navy", "M"))).toBe("Navy / M");
  });

  it("shows One Size for a product with no options at all", () => {
    expect(variantLabel(variant(NO_OPTION_COLOR, NO_OPTION_SIZE))).toBe(
      NO_OPTION_SIZE,
    );
  });

  it("survives a missing or partial variant", () => {
    expect(variantLabel(undefined)).toBe("");
    expect(variantLabel({})).toBe("");
    expect(variantLabel(variant("Navy", undefined))).toBe("Navy");
  });
});
