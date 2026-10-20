import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
const { prisma, auth } = vi.hoisted(() => ({ prisma: {}, auth: vi.fn() }));
vi.mock("../../server/prisma.js", () => ({ prisma }));
vi.mock("../../server/getCurrentUser.js", () => ({ getCurrentUser: auth }));
vi.mock("../../server/sendEmail.js", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));
vi.mock("../../server/orderEmails.js", () => ({
  queueOrderEmail: vi.fn(),
  queueBrandNotifications: vi.fn(),
  EMAIL_TYPE_FOR_STATUS: {},
  retryFailedOrderEmails: vi.fn(),
}));
vi.mock("../../server/sentry.js", () => ({
  Sentry: { captureException: vi.fn() },
}));
import { handleApiRequest } from "../routes.js";

let state;
const request = (path, method = "GET", body, headers = {}) =>
  handleApiRequest(
    new Request(`https://shop.test/api/${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
const payload = (reserved = false) => ({
  userId: "u1",
  total: 100,
  firstOrderDiscountPercent: null,
  firstOrderFreeShipping: false,
  inventoryReserved: reserved,
  items: [{ productId: "p1", variantId: "v1", quantity: 1 }],
});
const payment = (over = {}) => ({
  reference: "ref",
  status: "success",
  amount: 10000,
  currency: "NGN",
  ...over,
});
const webhook = (data) => {
  const body = { event: "charge.success", data };
  const signature = createHmac("sha512", "sk_test_local")
    .update(JSON.stringify(body))
    .digest("hex");
  return request("webhooks/paystack", "POST", body, {
    "x-paystack-signature": signature,
  });
};
beforeEach(() => {
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_local");
  vi.stubEnv("ADMIN_ALERT_EMAIL", "");
  auth.mockResolvedValue({
    id: "u1",
    email: "test@test.local",
    emailVerified: true,
    firstOrderPromoUsed: true,
  });
  state = {
    stock: 1,
    pending: { ref: { reference: "ref", userId: "u1", payload: payload() } },
    orders: [],
  };
  prisma.$queryRaw = vi.fn().mockResolvedValue([]);
  prisma.pendingCheckout = {
    findUnique: vi.fn(async ({ where }) =>
      structuredClone(state.pending[where.reference] || null),
    ),
    findFirst: vi.fn(async ({ where }) =>
      structuredClone(state.pending[where.reference] || null),
    ),
    create: vi.fn(async ({ data }) => {
      state.pending[data.reference] = structuredClone(data);
      return data;
    }),
    update: vi.fn(async ({ where, data }) => {
      state.pending[where.reference] = {
        ...state.pending[where.reference],
        ...structuredClone(data),
      };
      return state.pending[where.reference];
    }),
    deleteMany: vi.fn(async ({ where }) => {
      const exists = Boolean(state.pending[where.reference]);
      delete state.pending[where.reference];
      return { count: exists ? 1 : 0 };
    }),
  };
  prisma.variant = {
    updateMany: vi.fn(async ({ where, data }) => {
      if (where.stock && state.stock < where.stock.gte) return { count: 0 };
      state.stock += data.stock.increment ?? -data.stock.decrement;
      return { count: 1 };
    }),
    findUnique: vi.fn(async () => ({
      id: "v1",
      stock: state.stock,
      product: { name: "Shirt" },
    })),
  };
  prisma.order = {
    findUnique: vi.fn(
      async ({ where }) =>
        state.orders.find((o) =>
          where.id
            ? o.id === where.id
            : o.paystackReference === where.paystackReference,
        ) || null,
    ),
    findFirst: vi.fn(
      async ({ where }) =>
        state.orders.find(
          (o) =>
            o.paystackReference === where.paystackReference &&
            o.userId === where.userId,
        ) || null,
    ),
    update: vi.fn(async ({ where, data }) => {
      const order = state.orders.find((o) => o.id === where.id);
      Object.assign(order, data);
      return structuredClone(order);
    }),
    create: vi.fn(async ({ data }) => {
      const order = {
        id: "o1",
        ...data,
        items: data.items.create,
        user: { email: "test@test.local" },
      };
      state.orders.push(order);
      return order;
    }),
  };
  prisma.orderFulfillmentEvent = { create: vi.fn() };
  prisma.adminAuditLog = { create: vi.fn().mockResolvedValue({ id: "audit" }) };
  prisma.notification = { findMany: vi.fn().mockResolvedValue([]) };
  prisma.variant.findMany = vi.fn(async () => [
    {
      id: "v1",
      productId: "p1",
      stock: state.stock,
      product: { name: "Shirt" },
      color: "Blue",
      size: "M",
    },
  ]);
  prisma.variant.update = vi.fn(async ({ data }) => {
    state.stock += data.stock.increment;
    return { id: "v1", stock: state.stock };
  });
  prisma.wishlist = { findMany: vi.fn().mockResolvedValue([]) };
  prisma.firstOrderPromo = { findFirst: vi.fn().mockResolvedValue(null) };
  prisma.shippingFee = { findUnique: vi.fn().mockResolvedValue({ fee: 0 }) };
  prisma.product = {
    findMany: vi.fn(async () => [
      {
        id: "p1",
        name: "Shirt",
        basePrice: 100,
        variants: [{ id: "v1", stock: state.stock, size: "M", color: "Blue" }],
      },
    ]),
  };
  let previous = Promise.resolve();
  prisma.$transaction = (work) => {
    const next = previous.then(async () => {
      const before = structuredClone(state);
      try {
        return await work(prisma);
      } catch (error) {
        state = before;
        throw error;
      }
    });
    previous = next.catch(() => {});
    return next;
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ status: true, data: payment() })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("production checkout routes", () => {
  it("returns stock only once when two administrators cancel the same order", async () => {
    auth.mockResolvedValue({ id: "admin", role: "ADMIN" });
    state.stock = 0;
    state.orders.push({
      id: "o1",
      status: "PAID",
      items: payload().items,
      user: { email: "test@test.local" },
    });
    const results = await Promise.all([
      request("admin/orders/o1/status", "PUT", { status: "CANCELLED" }),
      request("admin/orders/o1/status", "PUT", { status: "CANCELLED" }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(state.stock).toBe(1);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledTimes(1);
  });
  it("rolls back cancellation and restocking if its required audit write fails", async () => {
    auth.mockResolvedValue({ id: "admin", role: "ADMIN" });
    state.stock = 0;
    state.orders.push({ id: "o1", status: "PAID", items: payload().items });
    prisma.adminAuditLog.create.mockRejectedValue(new Error("audit offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        (
          await request("admin/orders/o1/status", "PUT", {
            status: "CANCELLED",
          })
        ).status,
      ).toBe(500);
      expect(state.stock).toBe(0);
      expect(state.orders[0].status).toBe("PAID");
    } finally {
      log.mockRestore();
    }
  });
  it("keeps order lifecycle changes forbidden to fulfilment-only staff", async () => {
    auth.mockResolvedValue({ id: "staff", role: "FULFILMENT" });
    expect(
      (await request("admin/orders/o1/status", "PUT", { status: "CANCELLED" }))
        .status,
    ).toBe(403);
  });
  it("rejects signed mismatched payments without consuming the attempt or stock", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const mismatch of [{ amount: 1 }, { currency: "USD" }])
        expect((await webhook(payment(mismatch))).status).toBe(500);
      expect(state.stock).toBe(1);
      expect(state.orders).toHaveLength(0);
      expect(state.pending.ref).toBeDefined();
    } finally {
      log.mockRestore();
    }
  });
  it("processes racing webhook deliveries exactly once without overselling", async () => {
    const results = await Promise.all([webhook(payment()), webhook(payment())]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(state.orders).toHaveLength(1);
    expect(state.stock).toBe(0);
  });
  it("consumes a reserved payment without decrementing stock twice", async () => {
    state.stock = 0;
    state.pending.ref.payload = payload(true);
    expect((await webhook(payment())).status).toBe(200);
    expect(state.stock).toBe(0);
    expect(prisma.variant.updateMany).not.toHaveBeenCalled();
  });
  it("retains a legacy paid attempt on shortage and tells the customer not to pay again", async () => {
    state.stock = 0;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await request("checkout/verify?reference=ref");
      expect(result.status).toBe(409);
      expect((await result.json()).code).toBe("PAYMENT_REVIEW_REQUIRED");
      expect(state.pending.ref).toBeDefined();
      expect(state.orders).toHaveLength(0);
      expect(state.stock).toBe(0);
    } finally {
      log.mockRestore();
    }
  });
  it("reuses the same initialized attempt on a browser retry without reserving or charging twice", async () => {
    const body = {
      checkoutKey: "request-key-12345678",
      fullName: "Test",
      country: "Nigeria",
      phone: "+2348000000000",
      address: "Test",
      city: "Lagos",
      state: "Lagos",
      postalCode: "100001",
      items: payload().items,
    };
    fetch.mockResolvedValue(
      Response.json({
        status: true,
        data: { authorization_url: "https://checkout.paystack.com/test" },
      }),
    );
    const first = await request("checkout/initialize", "POST", body);
    expect(first.status).toBe(200);
    const second = await request("checkout/initialize", "POST", body);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state.stock).toBe(0);
  });
  it("keeps the reservation and recovery payload when provider initialization times out", async () => {
    fetch.mockRejectedValue(new Error("timeout"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await request("checkout/initialize", "POST", {
        fullName: "Test",
        country: "Nigeria",
        phone: "+2348000000000",
        address: "Test",
        city: "Lagos",
        state: "Lagos",
        postalCode: "100001",
        items: payload().items,
      });
      expect(result.status).toBe(502);
      const body = await result.json();
      expect(state.pending[body.reference].payload.inventoryReserved).toBe(
        true,
      );
      expect(state.stock).toBe(0);
    } finally {
      log.mockRestore();
    }
  });
  it("releases stock on a definite provider rejection and retains the payment record", async () => {
    fetch.mockResolvedValue(
      Response.json({ status: false, message: "rejected" }, { status: 400 }),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        (
          await request("checkout/initialize", "POST", {
            fullName: "Test",
            country: "Nigeria",
            phone: "+2348000000000",
            address: "Test",
            city: "Lagos",
            state: "Lagos",
            postalCode: "100001",
            items: payload().items,
          })
        ).status,
      ).toBe(502);
      expect(state.stock).toBe(1);
      expect(
        Object.values(state.pending).some(
          (entry) => entry.payload.paymentStatus === "initialization_rejected",
        ),
      ).toBe(true);
    } finally {
      log.mockRestore();
    }
  });
  it("reserves before calling the provider and preserves prior in-flight attempts", async () => {
    fetch.mockImplementation(async () => {
      expect(state.stock).toBe(0);
      return Response.json({
        status: true,
        data: { authorization_url: "https://checkout.paystack.com/test" },
      });
    });
    const result = await request("checkout/initialize", "POST", {
      fullName: "Test",
      country: "Nigeria",
      phone: "+2348000000000",
      address: "Test",
      city: "Lagos",
      state: "Lagos",
      postalCode: "100001",
      items: payload().items,
    });
    expect(result.status).toBe(200);
    expect(state.pending.ref).toBeDefined();
    expect(
      Object.values(state.pending).some((p) => p.payload.inventoryReserved),
    ).toBe(true);
  });
});
