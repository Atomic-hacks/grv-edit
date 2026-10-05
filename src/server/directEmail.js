// Admin-composed email: a message from the info@ or support@ address to one
// customer, one typed address, or a group of customers.
//
// Consent rule. A message to ONE person (a customer picked by name, or a
// typed address) is a direct conversation and needs no opt-in. A message to
// a GROUP is only sent to customers who opted into marketing, with an
// unsubscribe link — unless the admin states it is a service message
// (account, order or policy news), in which case it goes to everyone in the
// group and carries no unsubscribe link. Having an account is not consent
// to be marketed to.
import { prisma as defaultPrisma } from "./prisma.js";
import { sendEmail as defaultSendEmail } from "./sendEmail.js";
import { FROM_INFO, FROM_SUPPORT } from "./emailSenders.js";
import { renderEmail, escapeHtml, siteUrl, MUTED, BORDER } from "./emailTemplates.js";
import { ensureToken } from "./campaigns.js";

export const SENDERS = {
  INFO: { label: "Info", from: FROM_INFO },
  SUPPORT: { label: "Support", from: FROM_SUPPORT },
};

export const AUDIENCES = ["ALL", "ACTIVE", "ORDERED", "ONE", "EMAIL"];
export const BULK_AUDIENCES = ["ALL", "ACTIVE", "ORDERED"];
export const ACTIVE_DAYS = 30;
export const MAX_RECIPIENTS = 500;

const PAID_STATUSES = ["PAID", "SHIPPED", "DELIVERED"];
const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const toRecipient = (user) => ({
  email: user.email,
  name: user.name || null,
  kind: "user",
  id: user.id,
  token: user.unsubscribeToken,
});

/**
 * Who an admin message would reach. Returns { recipients, skipped } where
 * `skipped` counts people in the group left out for not opting in, or
 * { error } for bad input.
 */
export const resolveDirectAudience = async (
  { audience, userId, email, serviceNotice = false },
  { prisma = defaultPrisma, now = new Date() } = {},
) => {
  const select = { id: true, email: true, name: true, unsubscribeToken: true, marketingOptIn: true };

  if (audience === "ONE") {
    const user = userId
      ? await prisma.user.findFirst({ where: { id: String(userId), active: true }, select })
      : null;
    return user ? { recipients: [toRecipient(user)], skipped: 0 } : { error: "Choose a customer to email." };
  }

  if (audience === "EMAIL") {
    const address = String(email || "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address) || address.length > 254) return { error: "Enter a valid email address." };
    const user = await prisma.user.findFirst({ where: { email: { equals: address, mode: "insensitive" } }, select });
    return {
      recipients: [{ email: address, name: user?.name || null, kind: "address", id: null, token: null }],
      skipped: 0,
    };
  }

  if (!BULK_AUDIENCES.includes(audience)) return { error: "Choose who to email." };

  const base = { role: "CUSTOMER", active: true };
  let where = base;
  if (audience === "ORDERED") {
    where = { ...base, orders: { some: { status: { in: PAID_STATUSES } } } };
  } else if (audience === "ACTIVE") {
    // Active = visited the site or placed an order in the last 30 days.
    const since = new Date(now.getTime() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);
    const visitors = await prisma.siteVisit.groupBy({
      by: ["userId"],
      where: { userId: { not: null }, createdAt: { gte: since } },
    });
    where = {
      ...base,
      OR: [
        { id: { in: visitors.map((visitor) => visitor.userId) } },
        { orders: { some: { createdAt: { gte: since } } } },
      ],
    };
  }

  const users = await prisma.user.findMany({ where, select });
  const reachable = serviceNotice ? users : users.filter((user) => user.marketingOptIn);
  return { recipients: reachable.map(toRecipient), skipped: users.length - reachable.length };
};

const firstName = (name) => (name ? String(name).trim().split(/\s+/)[0] : "") || "there";

const unsubscribeFooter = (url) => `
  <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${BORDER};font-size:12px;line-height:1.6;color:${MUTED};">
    You're receiving this because you opted into GRV updates.
    <a href="${escapeHtml(url)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.
  </p>`;

// `{name}` in the subject or body becomes the customer's first name.
export const personalize = (text, name) => String(text).replace(/\{name\}/gi, firstName(name));

export const directEmailHtml = ({ subject, body, unsubscribeUrl }) =>
  renderEmail({
    preheader: subject,
    bodyHtml: `
      <div style="margin:0;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(body)}</div>
      ${unsubscribeUrl ? unsubscribeFooter(unsubscribeUrl) : ""}
    `,
  });

/** Sends to every recipient, a few at a time. Never throws. */
export const sendDirectEmails = async (
  { recipients, sender, subject, body, withUnsubscribe },
  { prisma = defaultPrisma, sendEmail = defaultSendEmail, concurrency = 5 } = {},
) => {
  const from = SENDERS[sender].from;
  const queue = [...recipients];
  let sent = 0;
  let failed = 0;
  let firstError = null;

  const worker = async () => {
    for (let recipient = queue.shift(); recipient; recipient = queue.shift()) {
      try {
        const token = withUnsubscribe && recipient.kind === "user" ? await ensureToken(prisma, recipient) : null;
        const result = await sendEmail({
          to: recipient.email,
          subject: personalize(subject, recipient.name),
          html: directEmailHtml({
            subject: personalize(subject, recipient.name),
            body: personalize(body, recipient.name),
            unsubscribeUrl: token ? `${siteUrl()}/unsubscribe?token=${encodeURIComponent(token)}` : null,
          }),
          from,
        });
        if (result?.sent) sent += 1;
        else {
          failed += 1;
          firstError = firstError || result?.message || "Provider rejected the message";
        }
      } catch (error) {
        failed += 1;
        firstError = firstError || error?.message || "Send failed";
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, recipients.length) }, worker));
  return { sent, failed, firstError };
};
