import { randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "./prisma.js";
import { sendEmail as defaultSendEmail } from "./sendEmail.js";
import { campaignEmail } from "./campaignEmailTemplates.js";
import { siteUrl } from "./emailTemplates.js";

const unsubscribeUrl = (token) =>
  `${siteUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;

/**
 * Who is allowed to receive a promotional email.
 *
 * Having an account is not consent: only users who explicitly opted in are
 * included. Newsletter subscribers opted in by subscribing. Anyone who has
 * unsubscribed is excluded, and the two sources are de-duplicated by email
 * so a customer who is also on the newsletter is mailed once.
 */
export const resolveAudience = async (audience, { prisma = defaultPrisma } = {}) => {
  const recipients = new Map();

  if (audience === "CUSTOMERS" || audience === "ALL") {
    const users = await prisma.user.findMany({
      where: { marketingOptIn: true, active: true, role: "CUSTOMER" },
      select: { id: true, email: true, unsubscribeToken: true },
    });
    for (const user of users) {
      recipients.set(user.email.toLowerCase(), {
        email: user.email,
        kind: "user",
        id: user.id,
        token: user.unsubscribeToken,
      });
    }
  }

  if (audience === "NEWSLETTER" || audience === "ALL") {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { unsubscribedAt: null },
      select: { id: true, email: true, unsubscribeToken: true },
    });
    for (const subscriber of subscribers) {
      const key = subscriber.email.toLowerCase();
      if (recipients.has(key)) continue;
      recipients.set(key, {
        email: subscriber.email,
        kind: "subscriber",
        id: subscriber.id,
        token: subscriber.unsubscribeToken,
      });
    }
  }

  return [...recipients.values()];
};

// Tokens are minted the first time a recipient is mailed, so existing rows
// don't need a backfill and nobody gets an unsubscribe link that 404s.
const ensureToken = async (prisma, recipient) => {
  if (recipient.token) return recipient.token;
  const token = randomUUID();
  if (recipient.kind === "user") {
    await prisma.user.update({
      where: { id: recipient.id },
      data: { unsubscribeToken: token },
    });
  } else {
    await prisma.newsletterSubscriber.update({
      where: { id: recipient.id },
      data: { unsubscribeToken: token },
    });
  }
  return token;
};

export const countAudience = async (audience, options = {}) =>
  (await resolveAudience(audience, options)).length;

const loadFeaturedProducts = async (prisma, productIds) => {
  if (!productIds?.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      basePrice: true,
      imageUrl: true,
      brand: { select: { name: true } },
    },
  });
  // Preserve the order the admin chose rather than the database's.
  const byId = new Map(products.map((product) => [product.id, product]));
  return productIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((product) => ({ ...product, brandName: product.brand?.name || null }));
};

/**
 * Sends a campaign exactly once.
 *
 * The DRAFT/SCHEDULED -> SENDING transition is an atomic `updateMany` guard:
 * a double-clicked button, a refreshed page and the cron all race for it,
 * and only one wins. A campaign that ends in FAILED never reports itself as
 * sent — `sentAt` is only written when at least one message was accepted.
 */
export const sendCampaign = async (
  campaignId,
  { prisma = defaultPrisma, sendEmail = defaultSendEmail } = {},
) => {
  const claim = await prisma.campaign.updateMany({
    where: { id: campaignId, status: { in: ["DRAFT", "SCHEDULED"] } },
    data: { status: "SENDING", startedAt: new Date(), lastError: null },
  });
  if (claim.count === 0) {
    const current = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    return {
      sent: false,
      reason: current ? `already-${current.status.toLowerCase()}` : "not-found",
    };
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  try {
    const recipients = await resolveAudience(campaign.audience, { prisma });
    const products = await loadFeaturedProducts(
      prisma,
      campaign.featuredProductIds,
    );

    let sentCount = 0;
    let failedCount = 0;
    let firstError = null;

    for (const recipient of recipients) {
      try {
        const token = await ensureToken(prisma, recipient);
        const result = await sendEmail({
          to: recipient.email,
          subject: campaign.subject,
          html: campaignEmail({
            subject: campaign.subject,
            preheader: campaign.preheader,
            body: campaign.body,
            imageUrl: campaign.imageUrl,
            ctaLabel: campaign.ctaLabel,
            ctaUrl: campaign.ctaUrl,
            products,
            unsubscribeUrl: unsubscribeUrl(token),
          }),
        });
        if (result?.sent) sentCount += 1;
        else {
          failedCount += 1;
          firstError = firstError || result?.message || "Provider rejected";
        }
      } catch (error) {
        failedCount += 1;
        firstError = firstError || error?.message || "Send threw";
      }
    }

    // Nothing delivered is a failure, not a send — the admin needs to know
    // the difference.
    const everythingFailed = sentCount === 0 && recipients.length > 0;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: everythingFailed ? "FAILED" : "SENT",
        sentAt: everythingFailed ? null : new Date(),
        recipientCount: recipients.length,
        sentCount,
        failedCount,
        lastError: firstError,
      },
    });

    return { sent: !everythingFailed, sentCount, failedCount, recipients: recipients.length };
  } catch (error) {
    console.error("Campaign send failed", { campaignId, error });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "FAILED",
        lastError: error?.message || "Campaign send failed",
      },
    });
    return { sent: false, reason: "exception" };
  }
};

/** Cron pass: sends any scheduled campaign whose time has come. */
export const processDueCampaigns = async ({
  prisma = defaultPrisma,
  sendEmail = defaultSendEmail,
  now = new Date(),
} = {}) => {
  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    select: { id: true },
    orderBy: { scheduledFor: "asc" },
    take: 10,
  });

  const results = [];
  for (const campaign of due) {
    results.push({
      id: campaign.id,
      ...(await sendCampaign(campaign.id, { prisma, sendEmail })),
    });
  }
  return results;
};

/** Resolves an unsubscribe token to whoever it belongs to and opts them out. */
export const unsubscribeByToken = async (token, { prisma = defaultPrisma } = {}) => {
  if (!token) return { ok: false };

  const user = await prisma.user.findFirst({
    where: { unsubscribeToken: token },
    select: { id: true, email: true },
  });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { marketingOptIn: false },
    });
    return { ok: true, email: user.email };
  }

  const subscriber = await prisma.newsletterSubscriber.findFirst({
    where: { unsubscribeToken: token },
    select: { id: true, email: true },
  });
  if (subscriber) {
    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { unsubscribedAt: new Date() },
    });
    return { ok: true, email: subscriber.email };
  }

  return { ok: false };
};

export { unsubscribeUrl, loadFeaturedProducts };
