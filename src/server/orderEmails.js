import { prisma as defaultPrisma } from "./prisma.js";
import { sendEmail as defaultSendEmail } from "./sendEmail.js";
import { FROM_INFO, REPLY_TO_SUPPORT } from "./emailSenders.js";
import { runInBackground } from "./background.js";
import {
  orderCreatedEmail,
  orderPaidEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
  brandOrderEmail,
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
// queries rather than one per line. `brandId` is carried through so a brand
// notice can be narrowed to that brand's lines.
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
        brandId: true,
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
        brandId: product?.brandId || null,
        brandName: product?.brand?.name || null,
        image: variant?.images?.[0] || product?.imageUrl || null,
        variant: variant || null,
      };
    }),
  };
};

// Works out who an email goes to and what it says. Customer emails go to
// the customer; BRAND_ORDER goes to the brand's configured inbox and only
// contains that brand's lines. Returns null when there is legitimately
// nobody to send to.
const buildMessage = async (prisma, order, type, brandId) => {
  if (type === "BRAND_ORDER") {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true, contactEmail: true, orderNotificationsEnabled: true },
    });
    if (!brand?.orderNotificationsEnabled || !brand.contactEmail) return null;
    const brandOrder = {
      ...order,
      items: order.items.filter((item) => item.brandId === brand.id),
    };
    if (brandOrder.items.length === 0) return null;
    return {
      to: brand.contactEmail,
      subject: `New GRV order #${order.id} — ${brand.name}`,
      html: brandOrderEmail({ order: brandOrder, brand }),
    };
  }

  const template = TEMPLATES[type];
  if (!order.user?.email) return null;
  return {
    to: order.user.email,
    subject: template.subject(order),
    html: template.render(order),
  };
};

/**
 * Sends one order email, exactly once, ever — customer emails once per
 * (order, type), brand notices once per (order, brand).
 *
 * The OrderEmailEvent row is claimed before the provider is called: the
 * unique (orderId, type, brandId) constraint means a webhook retry, a client
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
  { brandId = "", prisma = defaultPrisma, sendEmail = defaultSendEmail } = {},
) => {
  if (!TEMPLATES[type] && type !== "BRAND_ORDER") {
    console.error("Unknown order email type", { orderId, type });
    return { sent: false, reason: "unknown-type" };
  }
  if (type === "BRAND_ORDER" && !brandId) {
    return { sent: false, reason: "missing-brand" };
  }

  try {
    // Claim first. If another process already created this row, only retry
    // when that earlier attempt actually failed.
    let event;
    try {
      event = await prisma.orderEmailEvent.create({
        data: { orderId, type, brandId },
        select: { id: true, sentAt: true, attempts: true },
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      event = await prisma.orderEmailEvent.findUnique({
        where: { orderId_type_brandId: { orderId, type, brandId } },
        select: { id: true, sentAt: true, attempts: true },
      });
      if (!event) return { sent: false, reason: "claim-lost" };
      if (event.sentAt) return { sent: false, reason: "already-sent" };
      if (event.attempts >= MAX_ATTEMPTS) {
        return { sent: false, reason: "max-attempts" };
      }
    }

    const order = await loadOrderForEmail(prisma, orderId);
    const message = order ? await buildMessage(prisma, order, type, brandId) : null;
    if (!message) {
      // Nothing to send to (no customer email, brand notifications since
      // switched off, ...). Park it at MAX_ATTEMPTS so the retry pass
      // doesn't keep picking it up.
      await prisma.orderEmailEvent.update({
        where: { id: event.id },
        data: { attempts: MAX_ATTEMPTS, lastError: "No recipient" },
      });
      return { sent: false, reason: "no-recipient" };
    }

    const result = await sendEmail({
      ...message,
      from: FROM_INFO,
      replyTo: REPLY_TO_SUPPORT,
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
    console.error("Order email failed", { orderId, type, brandId, message: result?.message });
    return { sent: false, reason: "provider-error" };
  } catch (error) {
    console.error("Order email threw", { orderId, type, brandId, error });
    return { sent: false, reason: "exception" };
  }
};

/**
 * Which brands are involved in an order and opted in to hear about it.
 * The order → brand link goes OrderItem.productId → Product.brandId; an
 * order spanning three brands notifies each of them separately, each with
 * only their own lines.
 */
export const getNotifiableBrandsForOrder = async (orderId, { prisma = defaultPrisma } = {}) => {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { productId: true },
  });
  const productIds = [...new Set(items.map((item) => item.productId))];
  if (productIds.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { brandId: true },
  });
  const brandIds = [...new Set(products.map((product) => product.brandId))];
  return prisma.brand.findMany({
    where: {
      id: { in: brandIds },
      orderNotificationsEnabled: true,
      contactEmail: { not: null },
    },
    select: { id: true, name: true, contactEmail: true },
  });
};

export const notifyBrandsForOrder = async (orderId, options = {}) => {
  const brands = await getNotifiableBrandsForOrder(orderId, options);
  const results = [];
  for (const brand of brands) {
    results.push(await sendOrderEmail(orderId, "BRAND_ORDER", { ...options, brandId: brand.id }));
  }
  return results;
};

// For call sites inside request handlers: the order has already been
// written, and email must not be able to hold up (or fail) that response —
// but it must still actually run to completion on Vercel, hence
// runInBackground rather than a bare `void`.
export const queueOrderEmail = (orderId, type) =>
  runInBackground(sendOrderEmail(orderId, type), `Order email ${type} for ${orderId}`);

export const queueBrandNotifications = (orderId) =>
  runInBackground(notifyBrandsForOrder(orderId), `Brand notifications for ${orderId}`);

/**
 * Cron pass: retries order emails (customer and brand) that were claimed but
 * never delivered. Without this a provider outage would silently swallow a
 * customer's order confirmation forever.
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
    select: { orderId: true, type: true, brandId: true },
  });

  let retried = 0;
  let recovered = 0;
  for (const event of pending) {
    retried += 1;
    const result = await sendOrderEmail(event.orderId, event.type, {
      brandId: event.brandId,
      prisma,
      sendEmail,
    });
    if (result.sent) recovered += 1;
  }
  return { retried, recovered };
};

export { MAX_ATTEMPTS, loadOrderForEmail };
