import {
  escapeHtml,
  siteUrl,
  renderEmail,
  ctaButton,
  INK,
  MUTED,
  BORDER,
} from "./emailTemplates.js";

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const money = (value) => nairaFormatter.format(Number(value || 0));

// One row per ordered item: thumbnail, brand, product name, the variant
// actually bought, quantity and line price. Laid out as a table because
// every email client still renders tables predictably and flexbox is not
// dependable here.
const itemRow = (item) => {
  const variantParts = [item.variant?.color, item.variant?.size].filter(Boolean);
  const thumbnail = item.image
    ? `<img src="${escapeHtml(item.image)}" width="56" alt="" style="display:block;width:56px;height:72px;object-fit:cover;border:1px solid ${BORDER};" />`
    : `<div style="width:56px;height:72px;background:#f4f4f4;border:1px solid ${BORDER};"></div>`;

  return `
    <tr>
      <td style="padding:12px 12px 12px 0;vertical-align:top;width:56px;">${thumbnail}</td>
      <td style="padding:12px 0;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${INK};">
        ${item.brandName ? `<div style="font-weight:700;">${escapeHtml(item.brandName)}</div>` : ""}
        <div style="${item.brandName ? `color:${MUTED};` : "font-weight:700;"}">${escapeHtml(item.productName)}</div>
        ${variantParts.length ? `<div style="color:${MUTED};font-size:12px;margin-top:2px;">${escapeHtml(variantParts.join(" / "))}</div>` : ""}
        <div style="color:${MUTED};font-size:12px;margin-top:2px;">Qty ${escapeHtml(String(item.quantity))}</div>
      </td>
      <td style="padding:12px 0 12px 12px;vertical-align:top;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${INK};white-space:nowrap;">
        ${escapeHtml(money(item.priceAtPurchase * item.quantity))}
      </td>
    </tr>`;
};

const itemsTable = (items) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};margin:20px 0;">
    ${items.map(itemRow).join("")}
  </table>`;

const totalsRow = (label, value, { strong = false } = {}) => `
  <tr>
    <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${strong ? INK : MUTED};${strong ? "font-weight:700;" : ""}">${escapeHtml(label)}</td>
    <td style="padding:4px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${INK};${strong ? "font-weight:700;" : ""}">${escapeHtml(value)}</td>
  </tr>`;

// Only rows that actually apply are rendered — a zero discount or a free
// shipping line that was never charged would just be noise.
const totalsTable = (order) => {
  const itemsSubtotal = order.items.reduce(
    (sum, item) => sum + item.priceAtPurchase * item.quantity,
    0,
  );
  const rows = [totalsRow("Subtotal", money(itemsSubtotal))];

  if (order.discountAmount > 0) {
    rows.push(totalsRow("Discount", `- ${money(order.discountAmount)}`));
  }
  if (order.firstOrderDiscountAmount > 0) {
    rows.push(
      totalsRow("First-order discount", `- ${money(order.firstOrderDiscountAmount)}`),
    );
  }
  rows.push(
    totalsRow(
      "Delivery",
      order.shippingAmount > 0 ? money(order.shippingAmount) : "Free",
    ),
  );
  rows.push(totalsRow("Total", money(order.total), { strong: true }));

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${rows.join("")}</table>`;
};

const addressBlock = (order) => {
  const lines = [
    order.fullName,
    order.address,
    [order.city, order.state].filter(Boolean).join(", "),
    [order.postalCode, order.country].filter(Boolean).join(" "),
    order.phone,
  ].filter((line) => line && String(line).trim());

  return `
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">Delivering to</p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:${INK};">
      ${lines.map((line) => escapeHtml(line)).join("<br />")}
    </p>`;
};

const statusLine = (status) => `
  <p style="margin:0 0 20px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">
    Order status &middot; <span style="color:${INK};font-weight:700;">${escapeHtml(status)}</span>
  </p>`;

const orderUrl = (orderId) =>
  `${siteUrl()}/account/orders/${encodeURIComponent(orderId)}`;

// Every order email is the same document with a different opening: heading,
// intro, status, items, totals, address, CTA. Keeping one builder means a
// change to the order layout lands in all four emails at once.
const orderEmail = ({ order, heading, intro, preheader, ctaLabel = "View your order" }) =>
  renderEmail({
    preheader,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 20px;color:${MUTED};">${intro}</p>
      ${statusLine(order.status)}
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">Order #${escapeHtml(order.id)}</p>
      ${itemsTable(order.items)}
      ${totalsTable(order)}
      ${addressBlock(order)}
      ${ctaButton(orderUrl(order.id), ctaLabel)}
    `,
  });

export const orderCreatedEmail = (order) =>
  orderEmail({
    order,
    preheader: `We've received order #${order.id}.`,
    heading: "We've received your order",
    intro: `Thanks ${escapeHtml(order.fullName.split(" ")[0] || "")}. We're holding these pieces while your payment is confirmed — we'll email you again the moment it goes through.`,
  });

export const orderPaidEmail = (order) =>
  orderEmail({
    order,
    preheader: `Payment confirmed for order #${order.id}.`,
    heading: "Payment confirmed",
    intro:
      "Your payment went through and your order is confirmed. We'll let you know as soon as it's on its way.",
  });

export const orderShippedEmail = (order) =>
  orderEmail({
    order,
    preheader: `Order #${order.id} is on its way.`,
    heading: "Your order is on its way",
    intro:
      "Your order has left us and is heading to the address below.",
    ctaLabel: "Track your order",
  });

export const orderDeliveredEmail = (order) =>
  orderEmail({
    order,
    preheader: `Order #${order.id} has been delivered.`,
    heading: "Your order has been delivered",
    intro:
      "Your order has been marked as delivered. If anything isn't right, reply to this email or get in touch and we'll sort it out.",
  });

export const orderCancelledEmail = (order) =>
  orderEmail({
    order,
    preheader: `Order #${order.id} has been cancelled.`,
    heading: "Your order has been cancelled",
    intro:
      "This order has been cancelled and the pieces have been returned to stock. If you were charged, the refund will follow to your original payment method.",
  });

// Customer-service reply. Quotes the original message so the customer has
// the context of what they asked without digging through their sent folder.
export const supportReplyEmail = ({ customerName, subject, originalMessage, replyBody }) =>
  renderEmail({
    preheader: `Re: ${subject}`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">Re: ${escapeHtml(subject)}</h1>
      <p style="margin:0 0 20px;color:${MUTED};">Hi ${escapeHtml(customerName.split(" ")[0] || "there")},</p>
      <div style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(replyBody)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:2px solid ${BORDER};margin:0 0 24px;">
        <tr>
          <td style="padding:0 0 0 14px;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">Your original message</p>
            <div style="font-size:13px;line-height:1.6;color:${MUTED};white-space:pre-wrap;">${escapeHtml(originalMessage)}</div>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:${MUTED};">Reply to this email if you need anything else.</p>
    `,
  });

export { money, orderUrl };
