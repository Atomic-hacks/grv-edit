import { prisma as defaultPrisma } from "./prisma.js";
import { sendEmail as defaultSendEmail } from "./sendEmail.js";
import {
  orderCreatedEmail,
  orderPaidEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
} from "./orderEmailTemplates.js";

const TEMPLATES = {
  ORDER_CREATED: { render: orderCreatedEmail, subject: (o) => `We've received your order #${o.id}` },
  ORDER_PAID: { render: orderPaidEmail, subject: (o) => `Payment confirmed — order #${o.id}` },
  ORDER_SHIPPED: { render: orderShippedEmail, subject: (o) => `Your order #${o.id} is on its way` },
  ORDER_DELIVERED: { render: orderDeliveredEmail, subject: (o) => `Your order #${o.id} has been delivered` },
  ORDER_CANCELLED: { render: orderCancelledEmail, subject: (o) => `Your order #${o.id} has been cancelled` },
};

// Which email each status change owes the customer. PENDING is deliberately
// absent: that email is sent at order creation, not on a status transition.
export const EMAIL_TYPE_FOR_STATUS = {
  PAID: "ORDER_PAID",
  SHIPPED: "ORDER_SHIPPED",
  DELIVERED: "ORDER_DELIVERED",
  CANCELLED: "ORDER_CANCELLED",
};

const MAX_ATTEMPTS = 4;

// OrderItem carries no relation to Product/Variant, so the display fields an
// email needs (name, brand, image, colour, size) are resolved here in two
// queries rather than one per line.
const loadOrderForEmail = async (prisma, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { id: "asc" } },
      user: { select: { email: true, name: true } },
    },
  });
  if (!order) return null;

  const productIds = [...new Set(order.items.map((item) => item.productId))];
  const variantIds = [...new Set(order.items.map((item) => item.variantId))];
  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        brand: { select: { name: true } },
      },
    }),
    prisma.variant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, color: true, size: true, images: true },
    }),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return {
    ...order,
    items: order.items.map((item) => {
      const product = productById.get(item.productId);
      const variant = variantById.get(item.variantId);
      return {
        ...item,
        productName: product?.name || "Item",
        brandName: product?.brand?.name || null,
        image: variant?.images?.[0] || product?.imageUrl || null,
        variant: variant || null,
      };
    }),
  };
};

/**
 * Sends one order email, exactly once, ever.
 *
 * The OrderEmailEvent row is claimed before the provider is called: the
 * unique (orderId, type) constraint means a webhook retry, a client
 * verification and an admin double-click all collapse into a single send.
 * A row whose `sentAt` is still null is a failed attempt and stays eligible
 * for retry until MAX_ATTEMPTS — which is what `retryFailedOrderEmails`
 * below picks up on the cron.
 *
 * Never throws. Order and payment state must not depend on an email
 * provider being reachable.
 */
export const sendOrderEmail = async (
  orderId,
  type,
  { prisma = defaultPrisma, sendEmail = defaultSendEmail } = {},
) => {
  const template = TEMPLATES[type];
  if (!template) {
    console.error("Unknown order email type", { orderId, type });
    return { sent: false, reason: "unknown-type" };
  }

  try {
    // Claim first. If another process already created this row, only retry
    // when that earlier attempt actually failed.
    let event;
    try {
      event = await prisma.orderEmailEvent.create({
        data: { orderId, type },
        select: { id: true, sentAt: true, attempts: true },
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      event = await prisma.orderEmailEvent.findUnique({
        where: { orderId_type: { orderId, type } },
        select: { id: true, sentAt: true, attempts: true },
      });
      if (!event) return { sent: false, reason: "claim-lost" };
      if (event.sentAt) return { sent: false, reason: "already-sent" };
      if (event.attempts >= MAX_ATTEMPTS) {
        return { sent: false, reason: "max-attempts" };
      }
    }

    const order = await loadOrderForEmail(prisma, orderId);
    if (!order?.user?.email) {
      await prisma.orderEmailEvent.update({
        where: { id: event.id },
        data: { attempts: { increment: 1 }, lastError: "No recipient email" },
      });
      return { sent: false, reason: "no-recipient" };
    }

    const result = await sendEmail({
      to: order.user.email,
      subject: template.subject(order),
      html: template.render(order),
    });

    if (result?.sent) {
      await prisma.orderEmailEvent.update({
        where: { id: event.id },
        data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
      return { sent: true };
    }

    await prisma.orderEmailEvent.update({
      where: { id: event.id },
      data: {
        attempts: { increment: 1 },
        lastError: result?.message || "Email provider rejected the message",
      },
    });
    console.error("Order email failed", { orderId, type, message: result?.message });
    return { sent: false, reason: "provider-error" };
  } catch (error) {
    console.error("Order email threw", { orderId, type, error });
    return { sent: false, reason: "exception" };
  }
};

// Fire-and-forget wrapper for call sites inside request handlers: the order
// has already been written, and the customer's email must not be able to
// hold up (or fail) that response.
export const queueOrderEmail = (orderId, type) => {
  void sendOrderEmail(orderId, type).catch((error) => {
    console.error("Order email dispatch failed", { orderId, type, error });
  });
};

/**
 * Cron pass: retries order emails that were claimed but never delivered.
 * Without this a provider outage would silently swallow a customer's order
 * confirmation forever.
 */
export const retryFailedOrderEmails = async ({
  prisma = defaultPrisma,
  sendEmail = defaultSendEmail,
  limit = 50,
} = {}) => {
  const pending = await prisma.orderEmailEvent.findMany({
    where: { sentAt: null, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { orderId: true, type: true },
  });

  let retried = 0;
  let recovered = 0;
  for (const event of pending) {
    retried += 1;
    const result = await sendOrderEmail(event.orderId, event.type, {
      prisma,
      sendEmail,
    });
    if (result.sent) recovered += 1;
  }
  return { retried, recovered };
};

export { MAX_ATTEMPTS, loadOrderForEmail };
