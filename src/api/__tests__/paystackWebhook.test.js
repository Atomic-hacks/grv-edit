// End-to-end proof that an underpaid (but correctly signed) Paystack
// charge.success cannot create a PAID order. Drives the real route table in
// routes.js with the database and Supabase stubbed out.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "sk_test_webhook_secret";
process.env.PAYSTACK_SECRET_KEY = SECRET;

const state = { pending: [], orders: [], fulfillmentEvents: [] };

const tx = {
  pendingCheckout: {
    findUnique: async ({ where }) =>
      state.pending.find((row) => row.reference === where.reference) || null,
    deleteMany: async ({ where }) => {
      const before = state.pending.length;
      state.pending = state.pending.filter((r) => r.reference !== where.reference);
      return { count: before - state.pending.length };
    },
  },
  order: {
    create: async ({ data }) => {
      const order = { id: `ord_${state.orders.length + 1}`, ...data, items: [], user: { email: "a@b.com" } };
      state.orders.push(order);
      return order;
    },
    findUnique: async () => null,
    findFirst: async () => null,
  },
  orderFulfillmentEvent: { create: async ({ data }) => state.fulfillmentEvents.push(data) },
  discount: { update: async () => ({}) },
  user: { updateMany: async () => ({ count: 0 }) },
  variant: { findUnique: async () => null, update: async () => ({}) },
  wishlist: { findMany: async () => [] },
  notification: { create: async () => ({ id: "n1" }) },
};

vi.mock("../../server/prisma.js", () => ({
  prisma: {
    $transaction: async (fn) => fn(tx),
    order: { findUnique: async () => null, findFirst: async () => null },
    pendingCheckout: tx.pendingCheckout,
    // Surface touched by the post-order email/notification fan-out.
    orderItem: { findMany: async () => [] },
    brand: { findMany: async () => [] },
    notification: { findUnique: async () => null, findMany: async () => [] },
    user: { findUnique: async () => null },
  },
}));
vi.mock("../../server/orderEmails.js", () => ({
  queueOrderEmail: () => {},
  queueBrandNotifications: () => {},
  sendNotificationEmail: async () => ({ sent: true }),
}));
vi.mock("../../server/sendEmail.js", () => ({ sendEmail: async () => ({ sent: true }) }));
vi.mock("../../server/supabaseAdmin.js", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("../../server/background.js", () => ({ runInBackground: () => {} }));

const { handleApiRequest } = await import("../routes.js");

const webhook = (event) => {
  const body = JSON.stringify(event);
  return handleApiRequest(
    new Request("https://www.grvhq.com/api/webhooks/paystack", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-paystack-signature": createHmac("sha512", SECRET).update(body).digest("hex"),
      },
      body,
    }),
  );
};

const charge = (reference, amount, currency = "NGN") => ({
  event: "charge.success",
  data: { reference, amount, currency, status: "success" },
});

beforeEach(() => {
  state.pending = [
    {
      reference: "grv_test_ref",
      payload: {
        userId: "user-1", total: 70500, discountId: null, discountAmount: 0,
        firstOrderDiscountPercent: null, firstOrderDiscountAmount: 0,
        firstOrderFreeShipping: false, shippingFee: 0, shippingAmount: 0,
        fullName: "Ada", country: "NG", phone: "0800", address: "1 Rd",
        city: "Lagos", state: "Lagos", postalCode: "100001", items: [],
      },
    },
  ];
  state.orders = [];
});

describe("Paystack webhook amount enforcement", () => {
  it("does NOT create an order when the charge underpays the total", async () => {
    const response = await webhook(charge("grv_test_ref", 100)); // ₦1 vs ₦70,500
    expect(response.status).toBe(200); // ack so Paystack stops retrying
    expect(state.orders).toHaveLength(0);
  });

  it("leaves the pending checkout intact so it can be investigated", async () => {
    await webhook(charge("grv_test_ref", 100));
    expect(state.pending).toHaveLength(1);
  });

  it("does NOT create an order when the currency is wrong", async () => {
    await webhook(charge("grv_test_ref", 7_050_000, "USD"));
    expect(state.orders).toHaveLength(0);
  });

  it("DOES create the order when the correct amount is paid", async () => {
    await webhook(charge("grv_test_ref", 7_050_000));
    expect(state.orders).toHaveLength(1);
    expect(state.orders[0]).toMatchObject({ status: "PAID", total: 70500 });
  });

  it("still rejects a forged signature outright", async () => {
    const body = JSON.stringify(charge("grv_test_ref", 7_050_000));
    const response = await handleApiRequest(
      new Request("https://www.grvhq.com/api/webhooks/paystack", {
        method: "POST",
        headers: { "content-type": "application/json", "x-paystack-signature": "deadbeef" },
        body,
      }),
    );
    expect(response.status).toBe(400);
    expect(state.orders).toHaveLength(0);
  });
});
