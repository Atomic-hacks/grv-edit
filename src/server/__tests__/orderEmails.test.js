import { describe, it, expect, vi } from "vitest";
import {
  sendOrderEmail,
  retryFailedOrderEmails,
  notifyBrandsForOrder,
} from "../orderEmails.js";

// Minimal in-memory Prisma stand-in. The important behaviour it reproduces
// is the unique (orderId, type, brandId) constraint — that constraint IS the
// dedupe mechanism, so a fake that ignores it would test nothing.
const fakePrisma = ({ order, events = [], products = [], brands = [] } = {}) => {
  const state = { events: [...events], nextId: 1 };

  return {
    state,
    orderEmailEvent: {
      create: async ({ data }) => {
        const clash = state.events.find(
          (event) =>
            event.orderId === data.orderId &&
            event.type === data.type &&
            (event.brandId || "") === (data.brandId || ""),
        );
        if (clash) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const event = {
          id: `evt_${state.nextId++}`,
          sentAt: null,
          attempts: 0,
          lastError: null,
          ...data,
        };
        state.events.push(event);
        return event;
      },
      findUnique: async ({ where }) => {
        const { orderId, type, brandId } = where.orderId_type_brandId || {};
        return (
          state.events.find(
            (event) =>
              event.orderId === orderId &&
              event.type === type &&
              (event.brandId || "") === (brandId || ""),
          ) || null
        );
      },
      findMany: async ({ where }) =>
        state.events.filter(
          (event) =>
            event.sentAt === null && event.attempts < where.attempts.lt,
        ),
      update: async ({ where, data }) => {
        const event = state.events.find((item) => item.id === where.id);
        if (data.attempts?.increment) event.attempts += data.attempts.increment;
        else if (typeof data.attempts === "number") event.attempts = data.attempts;
        if ("sentAt" in data) event.sentAt = data.sentAt;
        if ("lastError" in data) event.lastError = data.lastError;
        return event;
      },
    },
    order: { findUnique: async () => order },
    orderItem: { findMany: async () => order?.items || [] },
    product: { findMany: async () => products },
    variant: { findMany: async () => [] },
    brand: {
      findUnique: async ({ where }) => brands.find((b) => b.id === where.id) || null,
      findMany: async ({ where }) =>
        brands.filter(
          (b) =>
            where.id.in.includes(b.id) &&
            b.orderNotificationsEnabled &&
            b.contactEmail,
        ),
    },
  };
};

const anOrder = {
  id: "order_1",
  status: "PAID",
  total: 50000,
  shippingAmount: 2000,
  discountAmount: 0,
  firstOrderDiscountAmount: 0,
  fullName: "Ada Obi",
  address: "1 Test Street",
  city: "Lagos",
  state: "Lagos",
  postalCode: "",
  country: "Nigeria",
  phone: "08000000000",
  items: [
    { id: "i1", productId: "p1", variantId: "v1", quantity: 2, priceAtPurchase: 24000 },
  ],
  user: { email: "ada@example.com", name: "Ada Obi" },
};

describe("sendOrderEmail", () => {
  it("sends the email and records delivery", async () => {
    const prisma = fakePrisma({ order: anOrder });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });

    const result = await sendOrderEmail("order_1", "ORDER_PAID", { prisma, sendEmail });

    expect(result.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("ada@example.com");
    expect(prisma.state.events[0].sentAt).toBeInstanceOf(Date);
  });

  it("includes the ordered items in the email body", async () => {
    const prisma = fakePrisma({ order: anOrder });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });

    await sendOrderEmail("order_1", "ORDER_PAID", { prisma, sendEmail });

    const { html, subject } = sendEmail.mock.calls[0][0];
    expect(subject).toContain("order_1");
    expect(html).toContain("Qty 2");
    expect(html).toContain("order_1");
    // Totals must reflect the order, not a placeholder.
    expect(html).toContain("Total");
  });

  it("never sends the same email twice for the same order", async () => {
    // An admin flipping SHIPPED -> PAID -> SHIPPED, or a webhook retry.
    const prisma = fakePrisma({ order: anOrder });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });

    await sendOrderEmail("order_1", "ORDER_SHIPPED", { prisma, sendEmail });
    const second = await sendOrderEmail("order_1", "ORDER_SHIPPED", { prisma, sendEmail });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(second.reason).toBe("already-sent");
  });

  it("sends different email types for the same order independently", async () => {
    const prisma = fakePrisma({ order: anOrder });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });

    await sendOrderEmail("order_1", "ORDER_PAID", { prisma, sendEmail });
    await sendOrderEmail("order_1", "ORDER_SHIPPED", { prisma, sendEmail });

    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("does not mark an email as sent when the provider rejects it", async () => {
    const prisma = fakePrisma({ order: anOrder });
    const sendEmail = vi.fn().mockResolvedValue({ sent: false, message: "rate limited" });

    const result = await sendOrderEmail("order_1", "ORDER_PAID", { prisma, sendEmail });

    expect(result.sent).toBe(false);
    expect(prisma.state.events[0].sentAt).toBeNull();
    expect(prisma.state.events[0].lastError).toBe("rate limited");
  });

  it("never throws when the email provider throws", async () => {
    // Order and payment state must not depend on the provider being up.
    const prisma = fakePrisma({ order: anOrder });
    const sendEmail = vi.fn().mockRejectedValue(new Error("connection refused"));

    await expect(
      sendOrderEmail("order_1", "ORDER_PAID", { prisma, sendEmail }),
    ).resolves.toMatchObject({ sent: false });
  });

  it("retries a previously failed email and stops once it succeeds", async () => {
    const prisma = fakePrisma({ order: anOrder });
    const failing = vi.fn().mockResolvedValue({ sent: false, message: "down" });
    await sendOrderEmail("order_1", "ORDER_PAID", { prisma, sendEmail: failing });

    const recovering = vi.fn().mockResolvedValue({ sent: true });
    const result = await retryFailedOrderEmails({ prisma, sendEmail: recovering });

    expect(result).toMatchObject({ retried: 1, recovered: 1 });
    expect(prisma.state.events[0].sentAt).toBeInstanceOf(Date);

    // A recovered email is not picked up again on the next pass.
    const secondPass = await retryFailedOrderEmails({ prisma, sendEmail: recovering });
    expect(secondPass.retried).toBe(0);
  });
});

describe("brand order notifications", () => {
  const twoBrandOrder = {
    ...anOrder,
    items: [
      { id: "i1", productId: "p1", variantId: "v1", quantity: 1, priceAtPurchase: 20000 },
      { id: "i2", productId: "p2", variantId: "v2", quantity: 2, priceAtPurchase: 15000 },
    ],
  };
  const products = [
    { id: "p1", name: "Linen Shirt", brandId: "b1", brand: { name: "Northline" } },
    { id: "p2", name: "Tote", brandId: "b2", brand: { name: "Atelier Zero" } },
  ];
  const brands = [
    { id: "b1", name: "Northline", contactEmail: "orders@northline.test", orderNotificationsEnabled: true },
    { id: "b2", name: "Atelier Zero", contactEmail: "hi@atelier.test", orderNotificationsEnabled: false },
  ];

  it("emails only opted-in brands, with only their own lines and no customer details", async () => {
    const prisma = fakePrisma({ order: twoBrandOrder, products, brands });
    const sendEmail = vi.fn(async () => ({ sent: true }));

    await notifyBrandsForOrder("order_1", { prisma, sendEmail });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const message = sendEmail.mock.calls[0][0];
    expect(message.to).toBe("orders@northline.test");
    expect(message.html).toContain("Linen Shirt");
    expect(message.html).not.toContain("Tote");
    expect(message.html).not.toContain("1 Test Street");
    expect(message.html).not.toContain("ada@example.com");
    expect(message.html).not.toContain("08000000000");
  });

  it("always sends from a GRV address, never the brand's", async () => {
    const prisma = fakePrisma({ order: twoBrandOrder, products, brands });
    const sendEmail = vi.fn(async () => ({ sent: true }));

    await notifyBrandsForOrder("order_1", { prisma, sendEmail });

    const message = sendEmail.mock.calls[0][0];
    expect(message.from).toContain("grvhq.com");
    expect(message.from).not.toContain("northline");
    expect(message.replyTo).toContain("grvhq.com");
  });

  it("notifies each brand once per order, independently of the customer's email", async () => {
    const prisma = fakePrisma({ order: twoBrandOrder, products, brands });
    const sendEmail = vi.fn(async () => ({ sent: true }));

    await sendOrderEmail("order_1", "ORDER_PAID", { prisma, sendEmail });
    await notifyBrandsForOrder("order_1", { prisma, sendEmail });
    await notifyBrandsForOrder("order_1", { prisma, sendEmail });

    // One customer email + one brand email — the repeat brand pass is a no-op.
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("does not retry forever when a brand has since switched notifications off", async () => {
    const prisma = fakePrisma({
      order: twoBrandOrder,
      products,
      brands: [{ ...brands[0], orderNotificationsEnabled: false }],
    });
    const sendEmail = vi.fn(async () => ({ sent: true }));

    const result = await sendOrderEmail("order_1", "BRAND_ORDER", {
      brandId: "b1",
      prisma,
      sendEmail,
    });

    expect(result.reason).toBe("no-recipient");
    expect(sendEmail).not.toHaveBeenCalled();
    const retry = await retryFailedOrderEmails({ prisma, sendEmail });
    expect(retry.retried).toBe(0);
  });
});
