import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyPaystackSignature, claimPendingCheckout, paymentMatchesCheckout } from "../paystack.js";

const SECRET = "sk_test_secret_key";
const sign = (body, secret = SECRET) =>
  createHmac("sha512", secret).update(body).digest("hex");

describe("verifyPaystackSignature", () => {
  const body = JSON.stringify({
    event: "charge.success",
    data: { reference: "ref_1" },
  });

  it("accepts a signature produced with the correct secret", () => {
    expect(verifyPaystackSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a signature produced with a different secret", () => {
    const forged = sign(body, "sk_test_attacker_key");
    expect(verifyPaystackSignature(body, forged, SECRET)).toBe(false);
  });

  it("rejects a signature for a different payload", () => {
    // The classic replay: a valid signature lifted from one webhook and
    // attached to a body that pays out a different order.
    const otherBody = JSON.stringify({
      event: "charge.success",
      data: { reference: "ref_attacker" },
    });
    expect(verifyPaystackSignature(otherBody, sign(body), SECRET)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyPaystackSignature(body, null, SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, "", SECRET)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    expect(verifyPaystackSignature(body, sign(body), undefined)).toBe(false);
    expect(verifyPaystackSignature(body, sign(body), "")).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // timingSafeEqual throws on length mismatch, so the length guard has to
    // come first — a truncated signature must be a clean false, not a 500.
    expect(() => verifyPaystackSignature(body, "abc123", SECRET)).not.toThrow();
    expect(verifyPaystackSignature(body, "abc123", SECRET)).toBe(false);
  });
});

// A stand-in for the one Prisma call the claim makes: deleting the
// PendingCheckout row. `exists` is the real state of the row; deleteMany
// only matches (and only ever matches once) while it's still there,
// exactly as Postgres would.
const fakePendingCheckoutStore = (exists = true) => {
  const state = { exists, deletes: 0 };
  return {
    state,
    pendingCheckout: {
      deleteMany: async ({ where }) => {
        state.deletes += 1;
        if (!state.exists || where.reference !== "ref_1") return { count: 0 };
        state.exists = false;
        return { count: 1 };
      },
    },
  };
};

describe("claimPendingCheckout", () => {
  it("claims an in-flight checkout once", async () => {
    const store = fakePendingCheckoutStore(true);
    await expect(claimPendingCheckout(store, "ref_1")).resolves.toBe(true);
    expect(store.state.exists).toBe(false);
  });

  it("refuses a second claim on the same reference", async () => {
    // The webhook and the customer's return-from-Paystack verification both
    // arrive for the same reference. Only one may proceed to create the Order.
    const store = fakePendingCheckoutStore(true);
    const first = await claimPendingCheckout(store, "ref_1");
    const second = await claimPendingCheckout(store, "ref_1");

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("refuses concurrent claims racing each other", async () => {
    const store = fakePendingCheckoutStore(true);
    const results = await Promise.all([
      claimPendingCheckout(store, "ref_1"),
      claimPendingCheckout(store, "ref_1"),
      claimPendingCheckout(store, "ref_1"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("refuses to claim a reference that was already claimed/never existed", async () => {
    const store = fakePendingCheckoutStore(false);
    await expect(claimPendingCheckout(store, "ref_1")).resolves.toBe(false);
  });
});

// Mirrors the sequence inside finalizeOrderFromReference: claim first, only
// then create the Order and touch stock. This is the invariant that stops a
// webhook retry from creating a duplicate order (or decrementing inventory
// twice) for one payment.
const finalizeLikeProduction = async (store, reference, items) => {
  const claimed = await claimPendingCheckout(store, reference);
  if (!claimed) return { created: false };
  for (const item of items) {
    store.state.stock -= item.quantity;
  }
  return { created: true };
};

describe("stock is only decremented behind a successful claim", () => {
  const items = [{ variantId: "v1", quantity: 2 }];

  it("decrements stock once for a first-time payment", async () => {
    const store = fakePendingCheckoutStore(true);
    store.state.stock = 10;

    await finalizeLikeProduction(store, "ref_1", items);

    expect(store.state.stock).toBe(8);
  });

  it("does not decrement stock again when the payment is processed twice", async () => {
    const store = fakePendingCheckoutStore(true);
    store.state.stock = 10;

    await finalizeLikeProduction(store, "ref_1", items); // webhook
    await finalizeLikeProduction(store, "ref_1", items); // client verify

    expect(store.state.stock).toBe(8);
  });

  it("leaves stock untouched when the reference was already claimed", async () => {
    const store = fakePendingCheckoutStore(false);
    store.state.stock = 10;

    const result = await finalizeLikeProduction(store, "ref_1", items);

    expect(result.created).toBe(false);
    expect(store.state.stock).toBe(10);
  });
});

describe("paymentMatchesCheckout", () => {
  const payload = { total: 38232 };
  const payment = {
    status: "success", reference: "ref", currency: "NGN",
    amount: 3891574, requested_amount: 3823200, fees: 68374,
  };

  it("accepts the reported payment with customer-paid processing fees", () => {
    expect(paymentMatchesCheckout(payment, "ref", payload)).toBe(true);
  });

  it("continues accepting an exact charge without fee metadata", () => {
    expect(paymentMatchesCheckout({ status: "success", reference: "ref", currency: "NGN", amount: 3823200 }, "ref", payload)).toBe(true);
  });

  it.each([
    { requested_amount: 3823100 }, { requested_amount: undefined },
    { requested_amount: "3823200" }, { amount: 3823199 },
    { amount: 3891575 }, { fees: undefined }, { fees: "68374" },
    { fees: -68374 }, { currency: "USD" }, { reference: "other" },
    { status: "failed" }, { amount: "3891574" },
  ])("rejects mismatched or unaccounted payments: %j", (override) => {
    expect(paymentMatchesCheckout({ ...payment, ...override }, "ref", payload)).toBe(false);
  });
});
