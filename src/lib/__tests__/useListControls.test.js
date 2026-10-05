import { describe, expect, it } from "vitest";
import { byDate, byNumber, byText } from "../useListControls";

const sorted = (rows, compare) => [...rows].sort(compare).map((row) => row.v);

describe("list comparators", () => {
  it("sorts text case-insensitively and naturally, with blanks last in both directions", () => {
    const rows = [{ v: "b" }, { v: null }, { v: "A" }, { v: "a10" }, { v: "a2" }];
    expect(sorted(rows, byText((r) => r.v))).toEqual(["A", "a2", "a10", "b", null]);
    expect(sorted(rows, byText((r) => r.v, -1))).toEqual(["b", "a10", "a2", "A", null]);
  });

  it("sorts numbers with missing values last", () => {
    const rows = [{ v: 5 }, { v: null }, { v: 1 }, { v: 9 }];
    expect(sorted(rows, byNumber((r) => r.v))).toEqual([1, 5, 9, null]);
    expect(sorted(rows, byNumber((r) => r.v, -1))).toEqual([9, 5, 1, null]);
  });

  it("sorts dates and puts undated rows last", () => {
    const rows = [{ v: "2026-03-01" }, { v: null }, { v: "2026-01-01" }];
    expect(sorted(rows, byDate((r) => r.v))).toEqual(["2026-01-01", "2026-03-01", null]);
    expect(sorted(rows, byDate((r) => r.v, -1))).toEqual(["2026-03-01", "2026-01-01", null]);
  });
});
