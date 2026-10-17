import { describe, it, expect } from "vitest";
import { checkPaidAmount } from "../paystack.js";

// What the old code did: treat the existence of a charge.success event as
// proof of payment, never looking at the amount.
const legacyAcceptsAnything = () => true;

describe("checkPaidAmount", () => {
  it("accepts a charge that exactly matches the order total", () => {
    const result = checkPaidAmount({
      paidAmount: 7_050_000,
      paidCurrency: "NGN",
      expectedTotal: 70500,
    });
    expect(result).toMatchObject({ ok: true, reason: "exact" });
  });

  it("rejects underpayment — the core vulnerability", () => {
    const result = checkPaidAmount({
      paidAmount: 100, // ₦1 against a ₦70,500 order
      paidCurrency: "NGN",
      expectedTotal: 70500,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("underpaid");
    // The behaviour this replaces would have created a PAID order here.
    expect(legacyAcceptsAnything()).toBe(true);
  });

  it("rejects a charge that is short by one kobo", () => {
    expect(
      checkPaidAmount({
        paidAmount: 7_049_999,
        paidCurrency: "NGN",
        expectedTotal: 70500,
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-NGN charge of the same numeric amount", () => {
    const result = checkPaidAmount({
      paidAmount: 7_050_000,
      paidCurrency: "USD",
      expectedTotal: 70500,
    });
    expect(result).toMatchObject({ ok: false, reason: "currency-mismatch" });
  });

  it("accepts a correct amount sent as a numeric string", () => {
    // Must not refuse a real payment over a type surprise: the customer has
    // already been charged at this point.
    expect(
      checkPaidAmount({
        paidAmount: "7050000",
        paidCurrency: "NGN",
        expectedTotal: 70500,
      }),
    ).toMatchObject({ ok: true, reason: "exact" });
  });

  it("still rejects an underpaying numeric string", () => {
    expect(
      checkPaidAmount({
        paidAmount: "100",
        paidCurrency: "NGN",
        expectedTotal: 70500,
      }),
    ).toMatchObject({ ok: false, reason: "underpaid" });
  });

  it("rejects missing, non-integer or negative amounts", () => {
    for (const paidAmount of [undefined, null, "", "abc", 70.5, "70.5", -100, NaN]) {
      expect(
        checkPaidAmount({ paidAmount, paidCurrency: "NGN", expectedTotal: 70500 })
          .ok,
        String(paidAmount),
      ).toBe(false);
    }
  });

  it("allows overpayment but flags it for reconciliation", () => {
    const result = checkPaidAmount({
      paidAmount: 7_050_100,
      paidCurrency: "NGN",
      expectedTotal: 70500,
    });
    expect(result).toMatchObject({ ok: true, reason: "overpaid" });
  });

  it("handles kobo-precision totals without float drift", () => {
    expect(
      checkPaidAmount({
        paidAmount: 1_500_050,
        paidCurrency: "NGN",
        expectedTotal: 15000.5,
      }),
    ).toMatchObject({ ok: true, reason: "exact" });
  });

  it("rejects a corrupt expected total rather than defaulting to allow", () => {
    for (const expectedTotal of [undefined, NaN, -1, "abc"]) {
      expect(
        checkPaidAmount({
          paidAmount: 7_050_000,
          paidCurrency: "NGN",
          expectedTotal,
        }).ok,
        String(expectedTotal),
      ).toBe(false);
    }
  });

  it("accepts a zero-total order paid as zero (fully discounted)", () => {
    expect(
      checkPaidAmount({ paidAmount: 0, paidCurrency: "NGN", expectedTotal: 0 })
        .ok,
    ).toBe(true);
  });
});
