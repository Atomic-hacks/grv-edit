import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyPaystackSignature,
  claimOrderForPayment,
} from "../paystack.js";

const SECRET = "sk_test_secret_key";
const sign = (body, secret = SECRET) =>
  createHmac("sha512", secret).update(body).digest("hex");

describe("verifyPaystackSignature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });

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

// A stand-in for the one Prisma call the claim makes. `status` is the real
// state of the row; updateMany only matches while it is still PENDING,
// exactly as Postgres would.
const fakeOrderStore = (initialStatus = "PENDING") => {
  const state = { status: initialStatus, updates: 0 };
  return {
    state,
    order: {
      updateMany: async ({ where, data }) => {
        state.updates += 1;
        if (where.status && state.status !== where.status) return { count: 0 };
        state.status = data.status;
        return { count: 1 };
      },
    },
  };
};

describe("claimOrderForPayment", () => {
  it("claims a pending order once", async () => {
    const store = fakeOrderStore("PENDING");
    await expect(claimOrderForPayment(store, "order_1")).resolves.toBe(true);
    expect(store.state.status).toBe("PAID");
  });

  it("refuses a second claim on the same order", async () => {
    // The webhook and the customer's return-from-Paystack verification both
    // arrive for the same order. Only one may proceed to decrement stock.
    const store = fakeOrderStore("PENDING");
    const first = await claimOrderForPayment(store, "order_1");
    const second = await claimOrderForPayment(store, "order_1");

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(store.state.status).toBe("PAID");
  });

  it("refuses concurrent claims racing each other", async () => {
    const store = fakeOrderStore("PENDING");
    const results = await Promise.all([
      claimOrderForPayment(store, "order_1"),
      claimOrderForPayment(store, "order_1"),
      claimOrderForPayment(store, "order_1"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("refuses to claim an order that is already paid", async () => {
    const store = fakeOrderStore("PAID");
    await expect(claimOrderForPayment(store, "order_1")).resolves.toBe(false);
  });

  it("refuses to claim a cancelled order", async () => {
    const store = fakeOrderStore("CANCELLED");
    await expect(claimOrderForPayment(store, "order_1")).resolves.toBe(false);
    expect(store.state.status).toBe("CANCELLED");
  });
});

// Mirrors the sequence inside finalizePaidOrder: claim first, only then
// touch stock. This is the invariant that stops a webhook retry from
// decrementing inventory a second time for one payment.
const finalizeLikeProduction = async (store, orderId, items) => {
  const claimed = await claimOrderForPayment(store, orderId);
  if (!claimed) return { decremented: false };
  for (const item of items) {
    store.state.stock -= item.quantity;
  }
  return { decremented: true };
};

describe("stock is only decremented behind a successful claim", () => {
  const items = [{ variantId: "v1", quantity: 2 }];

  it("decrements stock once for a first-time payment", async () => {
    const store = fakeOrderStore("PENDING");
    store.state.stock = 10;

    await finalizeLikeProduction(store, "order_1", items);

    expect(store.state.stock).toBe(8);
  });

  it("does not decrement stock again when the payment is processed twice", async () => {
    const store = fakeOrderStore("PENDING");
    store.state.stock = 10;

    await finalizeLikeProduction(store, "order_1", items); // webhook
    await finalizeLikeProduction(store, "order_1", items); // client verify

    expect(store.state.stock).toBe(8);
  });

  it("leaves stock untouched when the order was never pending", async () => {
    const store = fakeOrderStore("CANCELLED");
    store.state.stock = 10;

    const result = await finalizeLikeProduction(store, "order_1", items);

    expect(result.decremented).toBe(false);
    expect(store.state.stock).toBe(10);
  });
});
