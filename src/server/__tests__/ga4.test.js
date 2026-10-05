import { describe, expect, it } from "vitest";
import { isGa4Configured, rowsOf } from "../ga4.js";

describe("ga4", () => {
  it("is off until all three env vars are set", () => {
    const saved = { ...process.env };
    delete process.env.GA4_PROPERTY_ID;
    expect(isGa4Configured()).toBe(false);
    Object.assign(process.env, { GA4_PROPERTY_ID: "1", GA4_CLIENT_EMAIL: "a@b", GA4_PRIVATE_KEY: "k" });
    expect(isGa4Configured()).toBe(true);
    process.env = saved;
  });

  it("flattens report rows into numbers", () => {
    const rows = rowsOf({ rows: [{ dimensionValues: [{ value: "Direct" }], metricValues: [{ value: "12" }, { value: "0.5" }] }] });
    expect(rows).toEqual([{ dims: ["Direct"], metrics: [12, 0.5] }]);
    expect(rowsOf({})).toEqual([]);
    // A totals report has metrics only — no dimensionValues at all.
    expect(rowsOf({ rows: [{ metricValues: [{ value: "7" }] }] })).toEqual([{ dims: [], metrics: [7] }]);
  });
});
