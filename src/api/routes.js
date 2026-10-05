import { Sentry } from "../server/sentry.js";
import { prisma } from "../server/prisma.js";
import { getCurrentUser } from "../server/getCurrentUser.js";
import { requireAdmin } from "../server/requireAdmin.js";
import { getSupabaseAdmin } from "../server/supabaseAdmin.js";
import { sendEmail } from "../server/sendEmail.js";
import {
  FROM_INFO,
  FROM_NOREPLY,
  FROM_SUPPORT,
} from "../server/emailSenders.js";
import {
  queueOrderEmail,
  queueBrandNotifications,
  EMAIL_TYPE_FOR_STATUS,
} from "../server/orderEmails.js";
import { runInBackground } from "../server/background.js";
import { publicCacheControl } from "../server/publicCache.js";
import {
  isProductNew,
  NEW_PRODUCT_WINDOW_MS,
  productInclude,
  serializeProduct,
  getCategoryAndDescendantIds,
  loadCategoryTree,
  collectSubtreeIds,
} from "../server/catalog.js";
import {
  sendCampaign,
  countAudience,
  loadFeaturedProducts,
  unsubscribeByToken,
} from "../server/campaigns.js";
import { runReminderChecks } from "../server/runReminderChecks.js";
import {
  verificationCodeEmail,
  notificationEmail,
  adminOrderAlertEmail,
} from "../server/emailTemplates.js";
import { supportReplyEmail } from "../server/orderEmailTemplates.js";
import { checkRateLimit, clientIp } from "../server/rateLimit.js";
import {
  verifyPaystackSignature,
  claimPendingCheckout,
} from "../server/paystack.js";
import { formatPrice } from "../lib/productHelpers.js";
import { getRegionForState, NIGERIAN_REGIONS } from "../lib/nigeriaRegions.js";
import { v2 as cloudinary } from "cloudinary";
import { parse } from "csv-parse/sync";
import { randomInt, timingSafeEqual } from "node:crypto";
import { recordAdminAction } from "../server/auditLog.js";
import {
  handleCaseRequest,
  handleAdminCaseRequest,
  applyPaystackRefundEvent,
} from "./handlers/cases.js";
import { handleAdminFulfillmentRequest } from "./handlers/fulfillment.js";
import { getAdminAnalytics } from "./handlers/analytics.js";
import { getMessagingOptions, previewMessageAudience, sendAdminMessage } from "./handlers/messaging.js";
import { getAdminVisitors, getAdminGa4 } from "./handlers/visitors.js";
import { recordVisit } from "../server/visits.js";
import { handleAdminExportRequest } from "./handlers/exports.js";
import { handleAdminStaffRequest } from "./handlers/staff.js";
import { handleAdminProductBulkRequest } from "./handlers/productBulk.js";
import {
  handleAdminContentSectionRequest,
  listPublicContentSections,
  isSafeUrl,
} from "./handlers/contentSections.js";
import { getUploadSignature } from "./handlers/uploads.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const VERIFICATION_CODE_RESEND_COOLDOWN_MS = 45 * 1000;
const VERIFICATION_CODE_MAX_ATTEMPTS = 5;
const FIRST_ORDER_PROMO_ID = "first-order-promo";
const SHIPPING_FEE_REGIONS = [...NIGERIAN_REGIONS, "DEFAULT"];

const shippingFeeSelect = { id: true, region: true, fee: true };

const getShippingFeeForState = async (state) => {
  const region = getRegionForState(state) || "DEFAULT";
  const shippingFee = await prisma.shippingFee.findUnique({
    where: { region },
    select: shippingFeeSelect,
  });
  const fallback =
    shippingFee ||
    (region !== "DEFAULT"
      ? await prisma.shippingFee.findUnique({
          where: { region: "DEFAULT" },
          select: shippingFeeSelect,
        })
      : null);
  return { region, fee: fallback?.fee ?? 0 };
};

const findActiveDiscount = async (code) => {
  const discount = await prisma.discount.findUnique({ where: { code } });
  if (
    !discount ||
    !discount.active ||
    (discount.expiresAt && discount.expiresAt <= new Date()) ||
    (discount.maxUses !== null && discount.usedCount >= discount.maxUses)
  ) {
    return null;
  }
  return discount;
};

const getDiscountAmount = (discount, subtotal) =>
  Math.min(
    subtotal,
    discount.type === "PERCENTAGE"
      ? subtotal * (discount.value / 100)
      : discount.value,
  );

const firstOrderPromoSelect = {
  id: true,
  discountPercent: true,
  freeShipping: true,
  active: true,
  bannerMessage: true,
  updatedAt: true,
};

const getFirstOrderPromoConfig = () =>
  prisma.firstOrderPromo.findFirst({
    orderBy: { updatedAt: "desc" },
    select: firstOrderPromoSelect,
  });

const serializeFirstOrderPromo = (promo, user) => ({
  ...promo,
  eligible: Boolean(user && !user.firstOrderPromoUsed && promo?.active),
});

const sendVerificationCode = async (request) => {
  // Per-user cooldown below already stops one account from being spammed;
  // this catches the other shape of abuse — one IP hammering many
  // different (real) userIds to burn through the Resend quota.
  const limit = await checkRateLimit(`send-verification:${clientIp(request)}`, {
    max: 5,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return jsonResponse(
      { error: "Too many requests. Please wait a moment and try again." },
      429,
    );
  }

  let user = await getCurrentUser(request);
  if (!user) {
    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data, error } =
      await getSupabaseAdmin().auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const syncedUser = await prisma.user.upsert({
      where: { id: userId },
      update: { email: data.user.email },
      create: {
        id: userId,
        email: data.user.email,
        name: data.user.user_metadata?.name || null,
      },
    });
    if (!syncedUser.active) return jsonResponse({ error: "Unauthorized" }, 401);
    user = {
      id: syncedUser.id,
      email: syncedUser.email,
    };
  }

  const recentCode = await prisma.emailVerificationCode.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (
    recentCode &&
    Date.now() - recentCode.createdAt.getTime() <
      VERIFICATION_CODE_RESEND_COOLDOWN_MS
  ) {
    return jsonResponse(
      { error: "Please wait a moment before requesting another code" },
      429,
    );
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
  await prisma.$transaction(async (transaction) => {
    await transaction.emailVerificationCode.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    await transaction.emailVerificationCode.create({
      data: { userId: user.id, code, expiresAt },
    });
  });

  const sent = await sendEmail({
    to: user.email,
    subject: "Confirm your GRV email",
    html: verificationCodeEmail(code),
    from: FROM_NOREPLY,
  });
  if (!sent.sent) {
    const status = sent.statusCode === 429 ? 429 : 502;
    return jsonResponse(
      {
        error:
          status === 429
            ? "Email provider rate limit reached. Please wait a moment and try again."
            : "Could not send your verification email.",
      },
      status,
    );
  }
  return jsonResponse({ sent: true });
};

const verifyEmail = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json();
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return jsonResponse({ error: "Enter the 6-digit verification code" }, 400);
  }

  const now = new Date();
  const invalidResponse = () =>
    jsonResponse(
      { error: "That verification code is invalid or expired" },
      400,
    );

  // Look up the caller's one active (unused, unexpired) code regardless of
  // what they submitted, so a wrong guess still counts against the same
  // row's attempt limit instead of silently costing nothing.
  const activeCode = await prisma.emailVerificationCode.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, attempts: true },
  });
  if (!activeCode) return invalidResponse();
  if (activeCode.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
    await prisma.emailVerificationCode.update({
      where: { id: activeCode.id },
      data: { usedAt: now },
    });
    return jsonResponse(
      { error: "Too many attempts. Request a new verification code." },
      429,
    );
  }

  if (activeCode.code !== code) {
    await prisma.emailVerificationCode.update({
      where: { id: activeCode.id },
      data: { attempts: { increment: 1 } },
    });
    return invalidResponse();
  }

  await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.emailVerificationCode.updateMany({
      where: {
        id: activeCode.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      throw new Error("Verification code was already used");
    }
    await transaction.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  });

  return jsonResponse({ verified: true });
};

const notificationEmailContent = {
  WISHLIST_SALE: {
    subject: "It's on sale!",
    message: (productName) =>
      `${productName} just dropped in price. Take another look before it is gone.`,
  },
  WISHLIST_LOW_STOCK: {
    subject: "Almost sold out",
    message: (productName) =>
      `${productName} is almost sold out. Get yours while it is still available.`,
  },
  WAITLIST_RESTOCK: {
    subject: "Back in stock!",
    message: (productName) =>
      `${productName} is back in stock. Your wait is over.`,
  },
  BRAND_FEATURED_PRODUCT: {
    subject: "New from a brand you follow",
    message: (productName) =>
      `${productName} just launched — a new featured piece from a brand you follow.`,
  },
};

const sendNotificationEmail = async (
  transaction,
  notification,
  productName,
) => {
  const content = notificationEmailContent[notification.type];
  const user = await transaction.user.findUnique({
    where: { id: notification.userId },
    select: { email: true },
  });

  if (content && user?.email) {
    const productUrl = `${process.env.APP_URL || "http://localhost:5176"}/product/${encodeURIComponent(notification.productId)}`;
    const emailSent = await sendEmail({
      to: user.email,
      subject: content.subject,
      html: notificationEmail({
        message: content.message(productName),
        productUrl,
      }),
      from: FROM_INFO,
    });

    if (emailSent.sent) {
      await transaction.notification.update({
        where: { id: notification.id },
        data: { sent: true },
      });
      return true;
    }
  }

  return false;
};

const createNotificationAndSendEmail = async (
  transaction,
  { userId, productId, type, message },
  productName,
) => {
  const notification = await transaction.notification.create({
    data: { userId, productId, type, message, sent: false },
  });
  await sendNotificationEmail(transaction, notification, productName);
  return notification;
};

const processUnsentNotifications = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const notifications = await prisma.notification.findMany({
    where: { sent: false },
    select: {
      id: true,
      userId: true,
      productId: true,
      type: true,
      message: true,
    },
  });

  let succeeded = 0;
  let failed = 0;

  for (const notification of notifications) {
    try {
      const sent = await prisma.$transaction(async (transaction) => {
        const currentNotification = await transaction.notification.findUnique({
          where: { id: notification.id },
          select: {
            id: true,
            userId: true,
            productId: true,
            type: true,
            sent: true,
          },
        });
        if (!currentNotification || currentNotification.sent) return false;

        const product = await transaction.product.findUnique({
          where: { id: currentNotification.productId },
          select: { name: true },
        });
        if (!product) return false;

        return sendNotificationEmail(
          transaction,
          currentNotification,
          product.name,
        );
      });

      if (sent) succeeded += 1;
      else failed += 1;
    } catch (error) {
      console.error("Notification processing failed", {
        notificationId: notification.id,
        error,
      });
      failed += 1;
    }
  }

  return jsonResponse({
    found: notifications.length,
    succeeded,
    failed,
  });
};

const createContactSubmission = async (request) => {
  // The only fully open, unauthenticated write in the API — a basic per-IP
  // throttle so it can't be used to flood the admin's message list.
  const limit = await checkRateLimit(`contact:${clientIp(request)}`, {
    max: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonResponse(
      { error: "Too many messages sent. Please try again in a few minutes." },
      429,
    );
  }

  const body = await request.json();
  const fields = ["name", "email", "subject", "message"];
  const missingFields = fields.filter(
    (field) => typeof body[field] !== "string" || !body[field].trim(),
  );
  if (missingFields.length) {
    return jsonResponse(
      { error: `${missingFields.join(", ")} are required` },
      400,
    );
  }

  const submission = await prisma.contactSubmission.create({
    data: Object.fromEntries(
      fields.map((field) => [field, body[field].trim()]),
    ),
  });
  return jsonResponse({ success: true, submission }, 201);
};

const subscribeToNewsletter = async (request) => {
  const limit = await checkRateLimit(`newsletter:${clientIp(request)}`, {
    max: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonResponse(
      { error: "Too many attempts. Please try again in a few minutes." },
      429,
    );
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  try {
    await prisma.newsletterSubscriber.create({ data: { email } });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
  }

  return jsonResponse({ success: true });
};

// Search and status filtering run in the database, not in the browser: a
// filter that only narrows the rows already downloaded stops being useful
// the moment there is more than one page of messages.
const listAdminContactSubmissions = async (request, url) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const query = (url?.searchParams.get("q") || "").trim();
  const status = url?.searchParams.get("status") || "";

  const where = {};
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { subject: { contains: query, mode: "insensitive" } },
      { message: { contains: query, mode: "insensitive" } },
    ];
  }
  if (status === "unread") where.read = false;
  if (status === "unanswered") where.repliedAt = null;
  if (status === "replied") where.repliedAt = { not: null };

  const submissions = await prisma.contactSubmission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return jsonResponse(submissions);
};

/**
 * Replies to a customer message by email.
 *
 * The recipient comes from the stored submission, never from the request
 * body — an admin cannot be tricked into mailing an arbitrary address, and
 * nobody has to copy and paste anything. `repliedAt` is only written after
 * the provider accepts the message, so the dashboard never shows "replied"
 * for an email that never left.
 */
const replyToAdminContactSubmission = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const replyBody = typeof body.reply === "string" ? body.reply.trim() : "";
  if (!replyBody) {
    return jsonResponse({ error: "A reply message is required" }, 400);
  }

  const submission = await prisma.contactSubmission.findUnique({
    where: { id },
  });
  if (!submission) {
    return jsonResponse({ error: "Contact submission not found" }, 404);
  }

  const result = await sendEmail({
    to: submission.email,
    subject: `Re: ${submission.subject}`,
    html: supportReplyEmail({
      customerName: submission.name,
      subject: submission.subject,
      originalMessage: submission.message,
      replyBody,
    }),
    from: FROM_SUPPORT,
  });

  if (!result?.sent) {
    console.error("Support reply failed", {
      submissionId: id,
      message: result?.message,
    });
    return jsonResponse(
      {
        error:
          result?.message ||
          "The reply could not be sent. Nothing was delivered to the customer.",
      },
      502,
    );
  }

  const updated = await prisma.contactSubmission.update({
    where: { id },
    data: {
      replyBody,
      repliedAt: new Date(),
      repliedBy: guard.user?.email || null,
      read: true,
    },
  });
  return jsonResponse(updated);
};

const markAdminContactSubmissionRead = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const result = await prisma.contactSubmission.updateMany({
    where: { id },
    data: { read: true },
  });
  if (result.count === 0) {
    return jsonResponse({ error: "Contact submission not found" }, 404);
  }

  const submission = await prisma.contactSubmission.findUnique({
    where: { id },
  });
  return jsonResponse(submission);
};

// --- Promotional campaigns ---------------------------------------------
// Deliberately separate from the order emails above: different consent
// rules, a different template, and a send path that can never be triggered
// by a customer action.

const CAMPAIGN_AUDIENCES = ["CUSTOMERS", "NEWSLETTER", "ALL"];

const campaignInputFrom = (body) => {
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const subject = text(body.subject);
  const content = text(body.body);
  if (!subject) return { error: "A subject is required" };
  if (!content) return { error: "Email content is required" };

  const audience = text(body.audience) || "CUSTOMERS";
  if (!CAMPAIGN_AUDIENCES.includes(audience)) {
    return {
      error: `audience must be one of ${CAMPAIGN_AUDIENCES.join(", ")}`,
    };
  }

  let scheduledFor = null;
  if (body.scheduledFor) {
    const parsed = new Date(body.scheduledFor);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "scheduledFor must be a valid date" };
    }
    scheduledFor = parsed;
  }

  return {
    data: {
      subject,
      body: content,
      preheader: text(body.preheader) || null,
      imageUrl: text(body.imageUrl) || null,
      ctaLabel: text(body.ctaLabel) || null,
      ctaUrl: text(body.ctaUrl) || null,
      featuredProductIds: Array.isArray(body.featuredProductIds)
        ? body.featuredProductIds
            .filter((id) => typeof id === "string")
            .slice(0, 3)
        : [],
      audience,
      scheduledFor,
    },
  };
};

const listAdminCampaigns = async (request, url) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const query = (url?.searchParams.get("q") || "").trim();
  const status = url?.searchParams.get("status") || "";
  const where = {};
  if (query) where.subject = { contains: query, mode: "insensitive" };
  if (status) where.status = status;

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return jsonResponse(campaigns);
};

// The detail view needs to state exactly how many inboxes a send would
// reach, counted live rather than from a stale column.
const getAdminCampaign = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return jsonResponse({ error: "Campaign not found" }, 404);

  const audienceSize = await countAudience(campaign.audience);
  const featuredProducts = await loadFeaturedProducts(
    prisma,
    campaign.featuredProductIds,
  );
  return jsonResponse({ ...campaign, audienceSize, featuredProducts });
};

const createAdminCampaign = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const input = campaignInputFrom(await request.json());
  if (input.error) return jsonResponse({ error: input.error }, 400);

  const campaign = await prisma.campaign.create({
    data: {
      ...input.data,
      status: input.data.scheduledFor ? "SCHEDULED" : "DRAFT",
    },
  });
  return jsonResponse(campaign, 201);
};

const updateAdminCampaign = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) return jsonResponse({ error: "Campaign not found" }, 404);
  // A campaign that has gone out is a record of what was sent, not a draft.
  if (
    !["DRAFT", "SCHEDULED", "CANCELLED", "FAILED"].includes(existing.status)
  ) {
    return jsonResponse(
      {
        error: `A campaign that is ${existing.status} can no longer be edited`,
      },
      409,
    );
  }

  const input = campaignInputFrom(await request.json());
  if (input.error) return jsonResponse({ error: input.error }, 400);

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...input.data,
      status: input.data.scheduledFor ? "SCHEDULED" : "DRAFT",
      lastError: null,
    },
  });
  return jsonResponse(campaign);
};

const cancelAdminCampaign = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const result = await prisma.campaign.updateMany({
    where: { id, status: { in: ["DRAFT", "SCHEDULED"] } },
    data: { status: "CANCELLED" },
  });
  if (result.count === 0) {
    return jsonResponse(
      { error: "Only a draft or scheduled campaign can be cancelled" },
      409,
    );
  }
  return jsonResponse(await prisma.campaign.findUnique({ where: { id } }));
};

const sendAdminCampaignNow = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const result = await sendCampaign(id);
  if (!result.sent) {
    return jsonResponse(
      {
        error:
          result.reason === "not-found"
            ? "Campaign not found"
            : result.reason?.startsWith("already-")
              ? `This campaign is already ${result.reason.replace("already-", "")}`
              : "The campaign could not be sent. Nothing was delivered.",
        reason: result.reason,
      },
      result.reason === "not-found" ? 404 : 409,
    );
  }
  return jsonResponse({
    ...(await prisma.campaign.findUnique({ where: { id } })),
    result,
  });
};

// Lets the composer state how many inboxes a send would reach before the
// campaign exists, without creating throwaway records to find out.
const getAdminCampaignAudienceSize = async (request, url) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const audience = url.searchParams.get("audience") || "CUSTOMERS";
  if (!CAMPAIGN_AUDIENCES.includes(audience)) {
    return jsonResponse({ error: "Unknown audience" }, 400);
  }
  return jsonResponse({ audience, size: await countAudience(audience) });
};

const handleAdminCampaignRequest = async (request, segments, url) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  const action = segments[4];

  if (request.method === "GET" && id === "audience") {
    return getAdminCampaignAudienceSize(request, url);
  }
  if (request.method === "GET" && !id) return listAdminCampaigns(request, url);
  if (request.method === "GET" && id) return getAdminCampaign(request, id);
  if (request.method === "POST" && !id) return createAdminCampaign(request);
  if (request.method === "POST" && id && action === "send") {
    return sendAdminCampaignNow(request, id);
  }
  if (request.method === "POST" && id && action === "cancel") {
    return cancelAdminCampaign(request, id);
  }
  if (request.method === "PUT" && id) return updateAdminCampaign(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

// Public, token-authenticated, and deliberately not behind a login: an
// unsubscribe link that demands a password is not an unsubscribe link.
const handleUnsubscribe = async (request, url) => {
  const token = url.searchParams.get("token");
  const result = await unsubscribeByToken(token);
  if (!result.ok) {
    return jsonResponse({ error: "This unsubscribe link is not valid" }, 404);
  }
  return jsonResponse({ success: true, email: result.email });
};

const initializeCloudinary = () => {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config(process.env.CLOUDINARY_URL);
    return true;
  }

  const cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };

  if (Object.values(cloudinaryConfig).every((value) => value)) {
    cloudinary.config(cloudinaryConfig);
    return true;
  }

  return false;
};

// Configures the shared Cloudinary client once at startup; the upload
// signer (handlers/uploads.js) and case evidence uploads read from it.
initializeCloudinary();

const DEFAULT_PAGE_SIZE = 48;
const MAX_PAGE_SIZE = 100;

const serializeCategory = (category) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  parentId: category.parentId,
  showInNav: category.showInNav,
  navOrder: category.navOrder,
  description: category.description,
  productCount: category._count?.products,
});

// Filters are multi-value: every key accepts repeated params
// (?size=S&size=M) or a comma list (?size=S,M). Values within one filter
// are OR'd, separate filters are AND'd — the behaviour shoppers expect
// from a faceted catalogue.
const filterValues = (params, key) =>
  params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

const buildProductsWhere = async (url) => {
  const params = url.searchParams;
  const where = { archived: params.get("archived") === "true" };
  // Each entry here is AND'd together. Anything needing case-insensitive
  // matching or a relation lookup goes here rather than on `where`
  // directly, since Prisma's `in` has no insensitive mode.
  const and = [];

  // A category filter matches the category itself and, if it's a
  // top-level one, everything nested under it — browsing "Accessories"
  // picks up a product tagged only with "Accessories > Bags" without the
  // product needing a separate link to the parent.
  const categorySlugs = filterValues(params, "category");
  if (categorySlugs.length) {
    const idLists = await Promise.all(
      categorySlugs.map((slug) => getCategoryAndDescendantIds(slug)),
    );
    const ids = [...new Set(idLists.flat())];
    and.push({ categories: { some: { categoryId: { in: ids } } } });
  }

  // The contextual subcategory filter: narrows *within* the category being
  // browsed (Footwear → Sneakers), so it's AND'd with `category` above
  // rather than merged into it. Each picked subcategory includes its own
  // descendants; several picks are OR'd with each other.
  const subcategorySlugs = filterValues(params, "subcategory");
  if (subcategorySlugs.length) {
    const { all, childrenOf } = await loadCategoryTree();
    const ids = new Set();
    for (const slug of subcategorySlugs) {
      const match = all.find((category) => category.slug === slug);
      if (match) collectSubtreeIds(childrenOf, match.id).forEach((id) => ids.add(id));
    }
    // An unknown slug should match nothing, not silently drop the filter.
    and.push({ categories: { some: { categoryId: { in: [...ids] } } } });
  }

  const brands = filterValues(params, "brand");
  if (brands.length) where.brandId = { in: brands };

  // Style tags share the same shape as every other admin-managed tag —
  // matched by slug, same as `tag` below — kept as its own param because
  // the storefront's filter drawer treats it as its own facet.
  const styleTags = filterValues(params, "style");
  if (styleTags.length) {
    and.push({
      OR: styleTags.map((value) => ({
        tags: {
          some: { tag: { slug: { equals: value, mode: "insensitive" } } },
        },
      })),
    });
  }

  const tags = filterValues(params, "tag");
  if (tags.length) {
    and.push({
      OR: tags.map((value) => ({
        tags: {
          some: { tag: { slug: { equals: value, mode: "insensitive" } } },
        },
      })),
    });
  }

  // Shop By's multi-select: "Casual" (Style) + "Weekend" (Occasion)
  // narrows to products carrying both, not either — a separate,
  // AND-across-values param from `tag` above (which OR's), since the two
  // pages want opposite combining behavior for the same underlying facet.
  const tagsAll = filterValues(params, "tagAll");
  for (const value of tagsAll) {
    and.push({
      tags: { some: { tag: { slug: { equals: value, mode: "insensitive" } } } },
    });
  }

  const sizes = filterValues(params, "size");
  if (sizes.length) {
    and.push({
      OR: sizes.map((value) => ({
        variants: { some: { size: { equals: value, mode: "insensitive" } } },
      })),
    });
  }

  const colors = filterValues(params, "color");
  if (colors.length) {
    and.push({
      OR: colors.map((value) => ({
        variants: { some: { color: { equals: value, mode: "insensitive" } } },
      })),
    });
  }

  if (params.get("inStock") === "true") {
    and.push({ variants: { some: { stock: { gt: 0 } } } });
  }

  // Price bounds run against basePrice. Note this ignores discountPercent,
  // so a discounted product is filtered on its pre-discount price.
  const price = {};
  const minPrice = Number(params.get("minPrice"));
  const maxPrice = Number(params.get("maxPrice"));
  if (params.get("minPrice") && Number.isFinite(minPrice)) price.gte = minPrice;
  if (params.get("maxPrice") && Number.isFinite(maxPrice)) price.lte = maxPrice;
  if (Object.keys(price).length) where.basePrice = price;

  if (params.get("featured") === "true") where.featured = true;

  const query = params.get("q");
  if (query) {
    and.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { brand: { name: { contains: query, mode: "insensitive" } } },
        { description: { contains: query, mode: "insensitive" } },
        {
          categories: {
            some: {
              category: { name: { contains: query, mode: "insensitive" } },
            },
          },
        },
        {
          tags: {
            some: { tag: { name: { contains: query, mode: "insensitive" } } },
          },
        },
        {
          variants: {
            some: {
              OR: [
                { sku: { contains: query, mode: "insensitive" } },
                { color: { contains: query, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
};

// Sort options offered to shoppers. Every entry ends with a stable `id`
// tiebreak so pagination can't drop or repeat a product between pages.
const PRODUCT_SORT_ORDERS = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  "price-asc": [{ basePrice: "asc" }, { id: "asc" }],
  "price-desc": [{ basePrice: "desc" }, { id: "asc" }],
  "name-asc": [{ name: "asc" }, { id: "asc" }],
};

export const PRODUCT_SORT_KEYS = Object.keys(PRODUCT_SORT_ORDERS);

const getProductOrderBy = (url) =>
  PRODUCT_SORT_ORDERS[url.searchParams.get("sort")] || [{ id: "asc" }];

const listProducts = async (url) => {
  const where = await buildProductsWhere(url);
  const page = Math.max(1, parseInt(url.searchParams.get("page"), 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      parseInt(url.searchParams.get("pageSize"), 10) || DEFAULT_PAGE_SIZE,
    ),
  );

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: getProductOrderBy(url),
    }),
    prisma.product.count({ where }),
  ]);

  return jsonResponse({
    items: products.map(serializeProduct),
    total,
    page,
    pageSize,
  });
};

// Filters are deliberately three: Brand, Subcategory, Price. Every option
// is derived from the live catalogue, never a hardcoded list.
//
// Each facet's counts respect every *other* active filter but not its own
// — otherwise ticking one brand would collapse the brand list to just that
// brand and the shopper could never add a second.
//
// Subcategories are contextual: they're the direct children of the
// category being browsed (Footwear → Sneakers, Boots, ...), and only the
// ones that actually contain products here. Browsing Footwear can never
// offer "Knitwear". Each child counts its whole subtree, so a product
// filed under Tops > Shirts > Oxford still counts towards "Shirts".
const urlWithout = (url, ...keys) => {
  const copy = new URL(url);
  for (const key of keys) copy.searchParams.delete(key);
  return copy;
};

const listProductFilters = async (url) => {
  const [baseWhere, whereWithoutBrand, whereWithoutSubcategory, whereWithoutPrice] =
    await Promise.all([
      buildProductsWhere(url),
      buildProductsWhere(urlWithout(url, "brand")),
      buildProductsWhere(urlWithout(url, "subcategory")),
      buildProductsWhere(urlWithout(url, "minPrice", "maxPrice")),
    ]);

  const contextSlug = filterValues(url.searchParams, "category")[0];
  const tree = contextSlug ? await loadCategoryTree() : null;
  const contextCategory = tree?.all.find((category) => category.slug === contextSlug);
  const children = contextCategory
    ? [...(tree.childrenOf.get(contextCategory.id) || [])].sort(
        (a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0) || a.name.localeCompare(b.name),
      )
    : [];

  const [brandRows, subcategoryRows, priceBounds, total] = await Promise.all([
    prisma.product.groupBy({
      by: ["brandId"],
      where: whereWithoutBrand,
      _count: { _all: true },
    }),
    children.length
      ? prisma.product.findMany({
          where: whereWithoutSubcategory,
          select: { categories: { select: { categoryId: true } } },
        })
      : [],
    prisma.product.aggregate({
      where: whereWithoutPrice,
      _min: { basePrice: true },
      _max: { basePrice: true },
    }),
    prisma.product.count({ where: baseWhere }),
  ]);

  const brandNames = await prisma.brand.findMany({
    where: { id: { in: brandRows.map((row) => row.brandId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(brandNames.map((brand) => [brand.id, brand.name]));
  const brands = brandRows
    .map((row) => ({
      value: row.brandId,
      label: nameById.get(row.brandId) || "Unknown brand",
      count: row._count._all,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const subcategories = children
    .map((child) => {
      const subtree = new Set(collectSubtreeIds(tree.childrenOf, child.id));
      const count = subcategoryRows.filter((product) =>
        product.categories.some(({ categoryId }) => subtree.has(categoryId)),
      ).length;
      return { value: child.slug, label: child.name, count };
    })
    .filter((option) => option.count > 0);

  return jsonResponse({
    total,
    brands,
    subcategories,
    price: {
      min: priceBounds._min.basePrice ?? 0,
      max: priceBounds._max.basePrice ?? 0,
    },
    sorts: PRODUCT_SORT_KEYS,
  });
};

const listNewArrivals = async () => {
  const products = await prisma.product.findMany({
    where: {
      archived: false,
      createdAt: { gte: new Date(Date.now() - NEW_PRODUCT_WINDOW_MS) },
    },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return jsonResponse({
    items: products.map(serializeProduct),
    total: products.length,
  });
};

const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!product) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse(serializeProduct(product));
};

// The full tree, flat with parentId — consumers (nav bar, browse pages,
// breadcrumbs, the admin screen) each derive whatever shape of the tree
// they need from this rather than the API pre-shaping it several ways.
const listCategories = async () => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ parentId: "asc" }, { navOrder: "asc" }, { name: "asc" }],
  });
  return jsonResponse(categories.map(serializeCategory));
};

const listBrands = async () => {
  const brands = await prisma.brand.findMany({
    select: { id: true, name: true, slug: true, logo: true, description: true },
    orderBy: { id: "asc" },
  });
  return jsonResponse(brands);
};




const listTags = async () => {
  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      filterTypeId: true,
      filterType: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { name: "asc" },
  });
  return jsonResponse(tags);
};

const listFilterTypes = async () => {
  const filterTypes = await prisma.filterType.findMany({
    select: { id: true, name: true, slug: true, imageUrl: true },
    orderBy: { name: "asc" },
  });
  return jsonResponse(filterTypes);
};


const listAdminBrands = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const brands = await prisma.brand.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
  return jsonResponse(brands);
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Brand contact details only ever pick a *recipient* for brand-specific
// notices — there is deliberately no sender/provider field to configure
// (see src/server/emailSenders.js).
const brandInputFrom = (body, { partial = false } = {}) => {
  const data = {};
  for (const field of ["name", "slug", "logo", "description"]) {
    if (body[field] !== undefined) {
      const value = typeof body[field] === "string" ? body[field].trim() : body[field];
      data[field] = value === "" && field !== "name" && field !== "slug" ? null : value;
    }
  }
  if (body.contactEmail !== undefined) {
    const email = String(body.contactEmail || "").trim().toLowerCase();
    if (email && !EMAIL_PATTERN.test(email)) {
      return { error: "contactEmail must be a valid email address" };
    }
    data.contactEmail = email || null;
  }
  if (body.orderNotificationsEnabled !== undefined) {
    data.orderNotificationsEnabled = Boolean(body.orderNotificationsEnabled);
  }
  if (!partial && (!data.name || !data.slug)) {
    return { error: "name and slug are required" };
  }
  return { data };
};

const createAdminBrand = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const input = brandInputFrom(await request.json());
  if (input.error) return jsonResponse({ error: input.error }, 400);
  if (input.data.orderNotificationsEnabled && !input.data.contactEmail) {
    return jsonResponse(
      { error: "Add a contact email before turning on order notifications" },
      400,
    );
  }

  try {
    const brand = await prisma.brand.create({
      data: { id: crypto.randomUUID(), ...input.data },
      include: { _count: { select: { products: true } } },
    });
    return jsonResponse(brand, 201);
  } catch (error) {
    if (error?.code === "P2002") {
      return jsonResponse({ error: "A brand with this slug already exists" }, 409);
    }
    throw error;
  }
};

const updateAdminBrand = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const input = brandInputFrom(await request.json(), { partial: true });
  if (input.error) return jsonResponse({ error: input.error }, 400);
  if (Object.keys(input.data).length === 0) {
    return jsonResponse({ error: "At least one brand field is required" }, 400);
  }

  const existing = await prisma.brand.findUnique({
    where: { id },
    select: { contactEmail: true, orderNotificationsEnabled: true },
  });
  if (!existing) return jsonResponse({ error: "Brand not found" }, 404);
  const merged = { ...existing, ...input.data };
  if (merged.orderNotificationsEnabled && !merged.contactEmail) {
    return jsonResponse(
      { error: "Add a contact email before turning on order notifications" },
      400,
    );
  }

  try {
    const brand = await prisma.brand.update({
      where: { id },
      data: input.data,
      include: { _count: { select: { products: true } } },
    });
    return jsonResponse(brand);
  } catch (error) {
    if (error?.code === "P2002") {
      return jsonResponse({ error: "A brand with this slug already exists" }, 409);
    }
    throw error;
  }
};

const deleteAdminBrand = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const productCount = await prisma.product.count({ where: { brandId: id } });
  if (productCount > 0) {
    return jsonResponse(
      { error: "Brand has products and cannot be deleted", productCount },
      409,
    );
  }

  await prisma.$transaction([
    // Same orphan risk as deleteAdminProduct — Wishlist.brandId is
    // nullable/SET NULL, so this must be cleaned up explicitly rather
    // than left for the database to null out silently.
    prisma.wishlist.deleteMany({ where: { brandId: id } }),
    prisma.brand.delete({ where: { id } }),
  ]);
  return jsonResponse({ deleted: true, id });
};

const handleAdminBrandRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminBrands(request);
  if (request.method === "POST" && !id) return createAdminBrand(request);
  if (request.method === "PUT" && id) return updateAdminBrand(request, id);
  if (request.method === "DELETE" && id) return deleteAdminBrand(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// One admin CRUD for the entire tree — major categories and their
// subcategories are the same model, so creating, editing, deleting and
// reordering either happens through these four handlers.
const listAdminCategories = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ parentId: "asc" }, { navOrder: "asc" }, { name: "asc" }],
  });
  return jsonResponse(categories.map(serializeCategory));
};

// Slugs are unique across the whole tree, so a second "Footwear" under Men
// can't simply be "footwear". Fall back to a readable parent-prefixed slug
// ("men-footwear") rather than mashed-together text, then a number.
const uniqueCategorySlug = async (name, parentId) => {
  const base = slugify(name);
  const parent = parentId
    ? await prisma.category.findUnique({ where: { id: parentId }, select: { slug: true } })
    : null;
  const candidates = [base, parent && `${parent.slug}-${base}`].filter(Boolean);
  for (const candidate of candidates) {
    if (!(await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  for (let n = 2; ; n += 1) {
    const candidate = `${candidates[candidates.length - 1]}-${n}`;
    if (!(await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
};

const categoryInputFrom = async (body, { partial = false } = {}) => {
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.slug !== undefined) data.slug = slugify(String(body.slug));
  else if (body.name !== undefined && !partial) data.slug = slugify(body.name);
  if (body.description !== undefined)
    data.description = body.description || null;
  if (body.showInNav !== undefined) data.showInNav = Boolean(body.showInNav);
  if (body.navOrder !== undefined) data.navOrder = Number(body.navOrder) || 0;

  if (!partial && !data.name) return { error: "name is required" };

  // parentId is validated, not just trusted: it must point at an existing
  // category. The tree can nest arbitrarily deep (Men > Accessories >
  // Jewelry), so any category — major or already-nested — is a valid
  // parent; the only thing that can't happen is a cycle, which is checked
  // separately in updateAdminCategory since it needs the category's own id.
  if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
    if (body.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: body.parentId },
        select: { id: true },
      });
      if (!parent) return { error: "parentId was not found" };
      data.parentId = parent.id;
    } else {
      data.parentId = null;
    }
  }

  return { data };
};

const createAdminCategory = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const input = await categoryInputFrom(body);
  if (input.error) return jsonResponse({ error: input.error }, 400);
  if (!body.slug) input.data.slug = await uniqueCategorySlug(input.data.name, input.data.parentId);
  if (!input.data.slug) return jsonResponse({ error: "name must contain letters or numbers" }, 400);

  try {
    const category = await prisma.category.create({ data: input.data });
    return jsonResponse(serializeCategory(category), 201);
  } catch (error) {
    if (error?.code === "P2002") {
      return jsonResponse(
        { error: "A category with this slug already exists" },
        409,
      );
    }
    throw error;
  }
};

const updateAdminCategory = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const input = await categoryInputFrom(body, { partial: true });
  if (input.error) return jsonResponse({ error: input.error }, 400);
  if (Object.keys(input.data).length === 0) {
    return jsonResponse({ error: "At least one field is required" }, 400);
  }
  // A category can't become its own descendant's child — that would create
  // a cycle. `getCategoryAndDescendantIds` includes the category itself,
  // so this also catches the simpler "parent of itself" case.
  if (input.data.parentId) {
    const invalidParentIds = await getCategoryAndDescendantIds(id);
    if (invalidParentIds.includes(input.data.parentId)) {
      return jsonResponse(
        {
          error:
            "A category cannot be moved under itself or one of its own subcategories",
        },
        400,
      );
    }
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: input.data,
    });
    return jsonResponse(serializeCategory(category));
  } catch (error) {
    if (error?.code === "P2025")
      return jsonResponse({ error: "Category not found" }, 404);
    if (error?.code === "P2002") {
      return jsonResponse(
        { error: "A category with this slug already exists" },
        409,
      );
    }
    throw error;
  }
};

const deleteAdminCategory = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!category) return jsonResponse({ error: "Category not found" }, 404);

  // Deleting cascades to the whole subtree at the DB level (onDelete:
  // Cascade on parentId), so the product check has to cover every
  // descendant at any depth, not just direct children.
  const subtreeIds = await getCategoryAndDescendantIds(id);
  const totalProducts = await prisma.productCategory.count({
    where: { categoryId: { in: subtreeIds } },
  });
  if (totalProducts > 0) {
    return jsonResponse(
      {
        error: `${totalProducts} product${totalProducts === 1 ? " is" : "s are"} still tagged with this category or its subcategories. Reassign them first.`,
      },
      409,
    );
  }

  await prisma.category.delete({ where: { id } });
  return jsonResponse({ success: true });
};

const handleAdminCategoryRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminCategories(request);
  if (request.method === "POST" && !id) return createAdminCategory(request);
  if (request.method === "PUT" && id) return updateAdminCategory(request, id);
  if (request.method === "DELETE" && id)
    return deleteAdminCategory(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const filterTypeSelect = {
  id: true,
  name: true,
  slug: true,
  imageUrl: true,
  _count: { select: { tags: true } },
};

// undefined = field not sent; null = cleared; otherwise a validated URL.
const optionalSafeUrl = (value) => {
  if (value === undefined) return { value: undefined };
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { value: null };
  if (!isSafeUrl(text)) {
    return { error: 'Image must be a site path starting with "/" or an http(s) URL' };
  }
  return { value: text };
};

const listAdminFilterTypes = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const filterTypes = await prisma.filterType.findMany({
    select: filterTypeSelect,
    orderBy: { name: "asc" },
  });
  return jsonResponse(filterTypes);
};

const createAdminFilterType = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  if (!body.name || !body.slug) {
    return jsonResponse({ error: "name and slug are required" }, 400);
  }

  const imageUrl = optionalSafeUrl(body.imageUrl);
  if (imageUrl.error) return jsonResponse({ error: imageUrl.error }, 400);
  const filterType = await prisma.filterType.create({
    data: { name: body.name, slug: body.slug, imageUrl: imageUrl.value ?? null },
    select: filterTypeSelect,
  });
  return jsonResponse(filterType, 201);
};

const updateAdminFilterType = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const data = Object.fromEntries(
    ["name", "slug"]
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
  const imageUrl = optionalSafeUrl(body.imageUrl);
  if (imageUrl.error) return jsonResponse({ error: imageUrl.error }, 400);
  if (imageUrl.value !== undefined) data.imageUrl = imageUrl.value;
  if (Object.keys(data).length === 0) {
    return jsonResponse(
      { error: "At least one of name, slug or image is required" },
      400,
    );
  }

  const filterType = await prisma.filterType.update({
    where: { id },
    data,
    select: filterTypeSelect,
  });
  return jsonResponse(filterType);
};

const deleteAdminFilterType = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const tagCount = await prisma.tag.count({ where: { filterTypeId: id } });
  if (tagCount > 0) {
    return jsonResponse(
      {
        error: "Filter type has tags and cannot be deleted",
        tagCount,
      },
      409,
    );
  }

  await prisma.filterType.delete({ where: { id } });
  return jsonResponse({ deleted: true, id });
};

const handleAdminFilterTypeRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminFilterTypes(request);
  if (request.method === "POST" && !id) return createAdminFilterType(request);
  if (request.method === "PUT" && id) return updateAdminFilterType(request, id);
  if (request.method === "DELETE" && id) {
    return deleteAdminFilterType(request, id);
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const listAdminTags = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      filterTypeId: true,
      filterType: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { name: "asc" },
  });
  return jsonResponse(tags);
};

const createAdminTag = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  if (!body.name || !body.slug || !body.filterTypeId) {
    return jsonResponse(
      { error: "name, slug, and filterTypeId are required" },
      400,
    );
  }
  const filterType = await prisma.filterType.findUnique({
    where: { id: body.filterTypeId },
    select: { id: true },
  });
  if (!filterType) {
    return jsonResponse({ error: "filterTypeId was not found" }, 400);
  }

  const tag = await prisma.tag.create({
    data: {
      name: body.name,
      slug: body.slug,
      filterTypeId: body.filterTypeId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      filterTypeId: true,
      filterType: { select: { id: true, name: true, slug: true } },
    },
  });
  return jsonResponse(tag, 201);
};

const updateAdminTag = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const data = Object.fromEntries(
    ["name", "slug", "filterTypeId"]
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
  if (Object.keys(data).length === 0) {
    return jsonResponse(
      { error: "At least one of name, slug, or filterTypeId is required" },
      400,
    );
  }
  if (data.filterTypeId) {
    const filterType = await prisma.filterType.findUnique({
      where: { id: data.filterTypeId },
      select: { id: true },
    });
    if (!filterType) {
      return jsonResponse({ error: "filterTypeId was not found" }, 400);
    }
  }

  const tag = await prisma.tag.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      filterTypeId: true,
      filterType: { select: { id: true, name: true, slug: true } },
    },
  });
  return jsonResponse(tag);
};

const deleteAdminTag = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  await prisma.$transaction([
    prisma.productTag.deleteMany({ where: { tagId: id } }),
    prisma.tag.delete({ where: { id } }),
  ]);
  return jsonResponse({ deleted: true, id });
};

const handleAdminTagRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminTags(request);
  if (request.method === "POST" && !id) return createAdminTag(request);
  if (request.method === "PUT" && id) return updateAdminTag(request, id);
  if (request.method === "DELETE" && id) return deleteAdminTag(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const discountSelect = {
  id: true,
  code: true,
  type: true,
  value: true,
  active: true,
  expiresAt: true,
  maxUses: true,
  usedCount: true,
};

const validateDiscountData = (body) => {
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const type = body.type;
  const value = Number(body.value);
  const maxUses =
    body.maxUses === "" || body.maxUses == null ? null : Number(body.maxUses);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (!code || !["PERCENTAGE", "FIXED"].includes(type)) {
    return { error: "code and a valid type are required" };
  }
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    (type === "PERCENTAGE" && value > 100)
  ) {
    return {
      error: "value must be positive and percentages cannot exceed 100",
    };
  }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    return { error: "maxUses must be a positive integer" };
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return { error: "expiresAt must be a valid date" };
  }
  return { data: { code, type, value, maxUses, expiresAt } };
};

const listAdminDiscounts = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const discounts = await prisma.discount.findMany({
    select: discountSelect,
    orderBy: { code: "asc" },
  });
  return jsonResponse(discounts);
};

const createAdminDiscount = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const validated = validateDiscountData(await request.json());
  if (validated.error) return jsonResponse({ error: validated.error }, 400);
  const discount = await prisma.discount.create({
    data: validated.data,
    select: discountSelect,
  });
  return jsonResponse(discount, 201);
};

const updateAdminDiscount = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const validated = validateDiscountData(await request.json());
  if (validated.error) return jsonResponse({ error: validated.error }, 400);
  const discount = await prisma.discount.update({
    where: { id },
    data: validated.data,
    select: discountSelect,
  });
  return jsonResponse(discount);
};

const deleteAdminDiscount = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  await prisma.discount.delete({ where: { id } });
  return jsonResponse({ deleted: true, id });
};

const handleAdminDiscountRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminDiscounts(request);
  if (request.method === "POST" && !id) return createAdminDiscount(request);
  if (request.method === "PUT" && id) return updateAdminDiscount(request, id);
  if (request.method === "DELETE" && id)
    return deleteAdminDiscount(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const journalPostFields = [
  "title",
  "slug",
  "excerpt",
  "content",
  "coverImage",
  "published",
];

const listAdminJournalPosts = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const posts = await prisma.journalPost.findMany({
    orderBy: { createdAt: "desc" },
  });
  return jsonResponse(posts);
};

const createAdminJournalPost = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const requiredFields = ["title", "slug", "excerpt", "content"];
  if (
    requiredFields.some(
      (field) => typeof body[field] !== "string" || !body[field].trim(),
    )
  ) {
    return jsonResponse(
      { error: "title, slug, excerpt, and content are required" },
      400,
    );
  }
  if (body.published !== undefined && typeof body.published !== "boolean") {
    return jsonResponse({ error: "published must be a boolean" }, 400);
  }

  const published = body.published === true;
  const post = await prisma.journalPost.create({
    data: {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt,
      content: body.content,
      coverImage: body.coverImage ?? null,
      published,
      publishedAt: published ? new Date() : null,
    },
  });
  return jsonResponse(post, 201);
};

const getAdminJournalPost = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const post = await prisma.journalPost.findUnique({ where: { id } });
  if (!post) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse(post);
};

const updateAdminJournalPost = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const data = Object.fromEntries(
    journalPostFields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
  if (Object.keys(data).length === 0) {
    return jsonResponse(
      { error: "At least one journal field is required" },
      400,
    );
  }
  if (data.published !== undefined && typeof data.published !== "boolean") {
    return jsonResponse({ error: "published must be a boolean" }, 400);
  }

  const currentPost = await prisma.journalPost.findUnique({ where: { id } });
  if (!currentPost) return jsonResponse({ error: "Not found" }, 404);

  if (data.published === true && !currentPost.published) {
    data.publishedAt = new Date();
  }

  const post = await prisma.journalPost.update({ where: { id }, data });
  return jsonResponse(post);
};

const deleteAdminJournalPost = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const result = await prisma.journalPost.deleteMany({ where: { id } });
  if (result.count === 0) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ deleted: true, id });
};

const handleAdminJournalRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminJournalPosts(request);
  if (request.method === "GET" && id) return getAdminJournalPost(request, id);
  if (request.method === "POST" && !id) return createAdminJournalPost(request);
  if (request.method === "PUT" && id)
    return updateAdminJournalPost(request, id);
  if (request.method === "DELETE" && id) {
    return deleteAdminJournalPost(request, id);
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const listPublishedJournalPosts = async () => {
  const posts = await prisma.journalPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  });
  return jsonResponse(posts);
};

const getPublishedJournalPost = async (slug) => {
  const post = await prisma.journalPost.findFirst({
    where: { slug, published: true },
  });
  if (!post) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse(post);
};

const customerOrderSelect = {
  id: true,
  status: true,
  total: true,
  shippingFee: true,
  fullName: true,
  country: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  postalCode: true,
  paystackReference: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      productId: true,
      variantId: true,
      quantity: true,
      priceAtPurchase: true,
    },
  },
};

const adminOrderItemSelect = {
  id: true,
  productId: true,
  variantId: true,
  quantity: true,
  priceAtPurchase: true,
};

const enrichAdminOrderItems = async (items) => {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const variantIds = [...new Set(items.map((item) => item.variantId))];
  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        basePrice: true,
        imageUrl: true,
        brand: { select: { name: true } },
      },
    }),
    prisma.variant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, color: true, size: true, sku: true, images: true },
    }),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return items.map((item) => {
    const product = productById.get(item.productId);
    const variant = variantById.get(item.variantId);
    return {
      ...item,
      productName: product?.name || "Unavailable product",
      brandName: product?.brand?.name || null,
      image: variant?.images?.[0] || product?.imageUrl || null,
      product: product || null,
      variant: variant || null,
    };
  });
};

const adminOrderSelect = {
  id: true,
  status: true,
  total: true,
  shippingFee: true,
  paystackReference: true,
  fullName: true,
  country: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  postalCode: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  items: { orderBy: { id: "asc" }, select: adminOrderItemSelect },
  fulfillmentStatus: true,
  courierName: true,
  trackingNumber: true,
  trackingUrl: true,
  shippingDate: true,
  estimatedDeliveryDate: true,
  deliveryNotes: true,
  fulfillmentEvents: { orderBy: { createdAt: "asc" } },
};

const serializeAdminOrder = async (order) => ({
  id: order.id,
  status: order.status,
  total: order.total,
  shippingFee: order.shippingFee,
  paystackReference: order.paystackReference,
  customer: order.user,
  shippingAddress: {
    fullName: order.fullName,
    country: order.country,
    phone: order.phone,
    address: order.address,
    city: order.city,
    state: order.state,
    region: getRegionForState(order.state),
    postalCode: order.postalCode,
  },
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  items: await enrichAdminOrderItems(order.items),
  fulfillment: {
    status: order.fulfillmentStatus,
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    shippingDate: order.shippingDate,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    deliveryNotes: order.deliveryNotes,
    events: order.fulfillmentEvents || [],
  },
});

const listAdminOrders = async (request, url) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const status = url.searchParams.get("status");
  const validStatuses = [
    "PENDING",
    "PAID",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "FAILED",
  ];
  if (status && !validStatuses.includes(status)) {
    return jsonResponse({ error: "Invalid order status filter" }, 400);
  }

  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    select: adminOrderSelect,
  });
  const enrichedOrders = await Promise.all(orders.map(serializeAdminOrder));
  return jsonResponse(
    enrichedOrders.map((order) => ({
      id: order.id,
      customer: order.customer,
      status: order.status,
      total: order.total,
      state: order.shippingAddress.state,
      region: order.shippingAddress.region,
      itemCount: order.items.reduce((count, item) => count + item.quantity, 0),
      firstImage: order.items[0]?.image || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })),
  );
};

const getAdminOrder = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const order = await prisma.order.findUnique({
    where: { id },
    select: adminOrderSelect,
  });
  if (!order) return jsonResponse({ error: "Order not found" }, 404);
  return jsonResponse(await serializeAdminOrder(order));
};

// Order status changes made through the admin "mark shipped/delivered/
// cancelled" buttons also advance the separate fulfilment timeline, so a
// customer never sees "Placed" on a delivered order just because nobody
// touched the fulfilment screen. Admins can still fill in richer fulfilment
// detail (courier, tracking) separately via the fulfilment endpoint.
const FULFILLMENT_STATUS_FOR_ORDER_STATUS = {
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

// Core order-status transition: validates, restocks on cancellation, and
// returns either an { error, status } pair or { order, restockedVariants }.
// Shared by the single-order and bulk-status endpoints below.
const applyOrderStatusChange = async (id, status) => {
  const restockedVariants = [];

  const result = await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        items: { select: adminOrderItemSelect },
      },
    });
    if (!order) return { error: "Order not found", status: 404 };

    if (status === "CANCELLED" && !["PAID", "SHIPPED"].includes(order.status)) {
      return {
        error: `Only PAID or SHIPPED orders can be cancelled; this order is ${order.status}`,
        status: 409,
      };
    }

    if (status === "CANCELLED") {
      const quantitiesByVariant = new Map();
      for (const item of order.items) {
        quantitiesByVariant.set(
          item.variantId,
          (quantitiesByVariant.get(item.variantId) || 0) + item.quantity,
        );
      }

      const variantIds = [...quantitiesByVariant.keys()];
      const variants = await transaction.variant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          stock: true,
          color: true,
          size: true,
          productId: true,
          product: { select: { name: true } },
        },
      });
      if (variants.length !== variantIds.length) {
        return {
          error: "Cannot cancel an order with a missing product variant",
          status: 409,
        };
      }

      for (const variant of variants) {
        const quantity = quantitiesByVariant.get(variant.id);
        const stockAfter = variant.stock + quantity;
        await transaction.variant.update({
          where: { id: variant.id },
          data: { stock: { increment: quantity } },
        });

        if (variant.stock === 0 && stockAfter > 0) {
          restockedVariants.push({
            variantId: variant.id,
            productId: variant.productId,
            productName: variant.product.name,
            color: variant.color,
            size: variant.size,
          });
        }
      }
    }

    const updatedOrder = await transaction.order.update({
      where: { id },
      data: {
        status,
        fulfillmentStatus:
          FULFILLMENT_STATUS_FOR_ORDER_STATUS[status] ?? undefined,
      },
      select: adminOrderSelect,
    });
    if (FULFILLMENT_STATUS_FOR_ORDER_STATUS[status]) {
      await transaction.orderFulfillmentEvent.create({
        data: {
          orderId: id,
          status: FULFILLMENT_STATUS_FOR_ORDER_STATUS[status],
        },
      });
    }
    return { order: updatedOrder, restockedVariants };
  });

  return result;
};

// The status change is committed by the time this runs, so the customer is
// owed the matching email. sendOrderEmail dedupes on (order, type), which is
// what stops an admin flipping a status back and forth from sending the
// same notification twice.
const dispatchOrderStatusSideEffects = (id, status, restockedVariants) => {
  const emailType = EMAIL_TYPE_FOR_STATUS[status];
  if (emailType) queueOrderEmail(id, emailType);

  if (status === "CANCELLED" && restockedVariants?.length > 0) {
    runInBackground(
      processRestockNotificationsBestEffort(restockedVariants),
      `Restock notification batch for order ${id}`,
    );
  }
};

const updateAdminOrderStatus = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const allowedStatuses = ["SHIPPED", "DELIVERED", "CANCELLED"];
  if (
    typeof body.status !== "string" ||
    !allowedStatuses.includes(body.status) ||
    Object.keys(body).some((key) => key !== "status")
  ) {
    return jsonResponse(
      { error: "status must be SHIPPED, DELIVERED, or CANCELLED" },
      400,
    );
  }

  const result = await applyOrderStatusChange(id, body.status);
  if (result.error) return jsonResponse({ error: result.error }, result.status);

  dispatchOrderStatusSideEffects(id, body.status, result.restockedVariants);
  await recordAdminAction({
    actorId: guard.user.id,
    action: "order.status_changed",
    entityType: "Order",
    entityId: id,
    newState: { status: body.status },
  });
  return jsonResponse(await serializeAdminOrder(result.order));
};

// Bulk order status updates reuse exactly the same per-order validation and
// stock/email side effects as the single-order endpoint above — a bulk
// action is just this, looped, with per-order failures reported rather than
// aborting the whole batch.
const bulkUpdateAdminOrderStatus = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => typeof id === "string")
    : [];
  const allowedStatuses = ["SHIPPED", "DELIVERED", "CANCELLED"];
  if (!ids.length)
    return jsonResponse({ error: "ids must be a non-empty array" }, 400);
  if (!allowedStatuses.includes(body.status)) {
    return jsonResponse(
      { error: "status must be SHIPPED, DELIVERED, or CANCELLED" },
      400,
    );
  }

  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    const result = await applyOrderStatusChange(id, body.status);
    if (result.error) {
      failed.push({ id, error: result.error });
      continue;
    }
    dispatchOrderStatusSideEffects(id, body.status, result.restockedVariants);
    succeeded.push(id);
  }

  await recordAdminAction({
    actorId: guard.user.id,
    action: "order.bulk_status_changed",
    entityType: "Order",
    entityId: succeeded.join(","),
    newState: { status: body.status, count: succeeded.length },
  });
  return jsonResponse({ updated: succeeded.length, failed });
};

const handleAdminOrderRequest = async (request, segments, url) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "PUT" && id === "bulk-status") {
    return bulkUpdateAdminOrderStatus(request);
  }
  if (request.method === "PUT" && id === "bulk-fulfillment") {
    return handleAdminFulfillmentRequest(request, segments);
  }
  if (request.method === "GET" && !id) return listAdminOrders(request, url);
  if (request.method === "GET" && id) return getAdminOrder(request, id);
  if (request.method === "PUT" && id && segments[4] === "status") {
    return updateAdminOrderStatus(request, id);
  }
  if (id && segments[4] === "fulfillment") {
    return handleAdminFulfillmentRequest(request, segments);
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const listAdminCustomers = async (request, url) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const query = (url?.searchParams.get("q") || "").trim();
  const where = { role: "CUSTOMER" };
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  const [customers, orderTotals] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
        emailVerified: true,
        marketingOptIn: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { user: { role: "CUSTOMER" } },
      _sum: { total: true },
    }),
  ]);

  const totalsByCustomer = new Map(
    orderTotals.map((entry) => [entry.userId, entry._sum.total || 0]),
  );
  return jsonResponse(
    customers.map(({ _count, ...customer }) => ({
      ...customer,
      orderCount: _count.orders,
      totalSpent: totalsByCustomer.get(customer.id) || 0,
    })),
  );
};

const getAdminCustomer = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const customer = await prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: customerOrderSelect,
      },
    },
  });
  if (!customer) return jsonResponse({ error: "Customer not found" }, 404);
  return jsonResponse(customer);
};

const updateAdminCustomer = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  if (
    typeof body.active !== "boolean" ||
    Object.keys(body).some((key) => key !== "active")
  ) {
    return jsonResponse({ error: "Only active (boolean) can be updated" }, 400);
  }

  const customer = await prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: { id: true },
  });
  if (!customer) return jsonResponse({ error: "Customer not found" }, 404);

  const updatedCustomer = await prisma.user.update({
    where: { id: customer.id },
    data: { active: body.active },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
    },
  });
  return jsonResponse(updatedCustomer);
};

const handleAdminCustomerRequest = async (request, segments, url) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminCustomers(request, url);
  if (request.method === "GET" && id) return getAdminCustomer(request, id);
  if (request.method === "PUT" && id) return updateAdminCustomer(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const adminProductInclude = {
  brand: { select: { id: true, name: true } },
  categories: {
    include: {
      category: {
        select: { id: true, name: true, slug: true, parentId: true },
      },
    },
  },
  variants: true,
  tags: {
    include: {
      tag: {
        include: {
          filterType: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
};

// One row is one color/size variant, not one product — rows sharing the
// same productKey become variants of a single product. Product-level
// fields (name, description, price, ...) only need to be filled in on the
// first row for a given productKey; later rows for it can leave them
// blank (inherited) or repeat them exactly (validated, to catch typos —
// a mismatch is treated as an error rather than silently ignored).
const BULK_PRODUCT_CSV_COLUMNS = [
  "productKey",
  "name",
  "description",
  "price",
  "discountPercent",
  "featured",
  "brandSlug",
  // Comma-separated category/subcategory slugs, e.g. "women,accessories,bags" —
  // any mix of major categories and subcategories, exactly what the product
  // form's checklist would tick.
  "categorySlugs",
  "imageUrl",
  "tagSlugs",
  "color",
  "size",
  "stock",
  // Optional — auto-generated from name/color/size when left blank.
  "sku",
  // Optional, comma-separated — photos for this specific color. Leaving it
  // blank is fine: the storefront already falls back to the product's
  // main imageUrl wherever a variant has none of its own.
  "variantImageUrls",
];

const BULK_PRODUCT_LEVEL_FIELDS = [
  "name",
  "description",
  "price",
  "discountPercent",
  "featured",
  "brandSlug",
  "categorySlugs",
  "imageUrl",
  "tagSlugs",
];

const csvCell = (value) => {
  const cell = String(value ?? "");
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
};

const parseBulkBoolean = (value) =>
  ["true", "1", "yes", "y"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );

const getAdminProductBulkUploadTemplate = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return new Response(JSON.stringify(guard.body), {
      status: guard.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Two rows sharing a productKey — this is the shape a "same shirt, two
  // colors" upload takes: the second row leaves every product-level column
  // blank and only fills in what's different (color, size, stock).
  const exampleRows = [
    [
      "SHIRT-001",
      "Classic Tee",
      "A sample product for bulk upload",
      "49.99",
      "",
      "",
      "northline",
      "men,tops",
      "https://example.com/classic-tee-black.jpg",
      "casual,weekend",
      "Black",
      "M",
      "10",
      "",
      "",
    ],
    [
      "SHIRT-001",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "White",
      "M",
      "8",
      "",
      "https://example.com/classic-tee-white.jpg",
    ],
  ];
  const csv = [BULK_PRODUCT_CSV_COLUMNS, ...exampleRows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  return new Response(`${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="product-bulk-upload-template.csv"',
    },
  });
};

const bulkProductImport = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file.text !== "function") {
    return jsonResponse({ error: "A CSV file field is required" }, 400);
  }

  let rows;
  try {
    rows = parse(await file.text(), {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    return jsonResponse(
      { error: `Could not parse CSV: ${error.message}` },
      400,
    );
  }

  if (rows.length === 0) {
    return jsonResponse({ error: "The CSV file is empty" }, 400);
  }
  if (
    rows[0].length !== BULK_PRODUCT_CSV_COLUMNS.length ||
    rows[0].some((column, index) => column !== BULK_PRODUCT_CSV_COLUMNS[index])
  ) {
    return jsonResponse(
      {
        error: `CSV header must be: ${BULK_PRODUCT_CSV_COLUMNS.join(",")}`,
      },
      400,
    );
  }

  const summary = {
    totalRows: rows.length - 1,
    productsCreated: 0,
    variantsCreated: 0,
    failed: [],
    warnings: [],
  };

  // --- Pass 1: parse + group by productKey, preserving first-seen order ---
  const groups = new Map(); // productKey -> entries[]
  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    if (row.length !== BULK_PRODUCT_CSV_COLUMNS.length) {
      summary.failed.push({
        row: rowNumber,
        error: `Expected ${BULK_PRODUCT_CSV_COLUMNS.length} columns, received ${row.length}`,
      });
      return;
    }
    const values = Object.fromEntries(
      BULK_PRODUCT_CSV_COLUMNS.map((field, fieldIndex) => [
        field,
        typeof row[fieldIndex] === "string" ? row[fieldIndex].trim() : "",
      ]),
    );
    if (!values.productKey) {
      summary.failed.push({ row: rowNumber, error: "productKey is required" });
      return;
    }
    if (!groups.has(values.productKey)) groups.set(values.productKey, []);
    groups.get(values.productKey).push({ rowNumber, values });
  });

  const [brands, categories, tags] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, slug: true } }),
    prisma.category.findMany({ select: { id: true, slug: true } }),
    prisma.tag.findMany({ select: { id: true, slug: true } }),
  ]);
  const brandsBySlug = new Map(brands.map((brand) => [brand.slug, brand]));
  const categoriesBySlug = new Map(
    categories.map((category) => [category.slug, category]),
  );
  const tagsBySlug = new Map(tags.map((tag) => [tag.slug, tag]));

  // --- Pass 2: validate each group into a creation plan ---
  const failGroup = (entries, error) => {
    for (const entry of entries)
      summary.failed.push({ row: entry.rowNumber, error });
  };

  const plans = [];
  for (const [productKey, entries] of groups) {
    const primary = entries[0].values;

    const missing = [
      "name",
      "description",
      "price",
      "brandSlug",
      "categorySlugs",
    ].filter((field) => !primary[field]);
    if (missing.length) {
      failGroup(
        entries,
        `productKey "${productKey}": ${missing.join(", ")} required on its first row`,
      );
      continue;
    }

    const price = Number(primary.price);
    if (!Number.isFinite(price)) {
      failGroup(entries, `productKey "${productKey}": price must be a number`);
      continue;
    }

    let discountPercent = null;
    if (primary.discountPercent) {
      discountPercent = Number(primary.discountPercent);
      if (
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        failGroup(
          entries,
          `productKey "${productKey}": discountPercent must be between 0 and 100`,
        );
        continue;
      }
    }

    const brand = brandsBySlug.get(primary.brandSlug);
    if (!brand) {
      failGroup(
        entries,
        `productKey "${productKey}": brandSlug "${primary.brandSlug}" was not found`,
      );
      continue;
    }

    const categorySlugs = [
      ...new Set(
        primary.categorySlugs
          .split(",")
          .map((slug) => slug.trim())
          .filter(Boolean),
      ),
    ];
    const categoryIds = [];
    const missingCategorySlug = categorySlugs.find(
      (slug) => !categoriesBySlug.has(slug),
    );
    if (missingCategorySlug) {
      failGroup(
        entries,
        `productKey "${productKey}": categorySlugs "${missingCategorySlug}" was not found`,
      );
      continue;
    }
    for (const slug of categorySlugs)
      categoryIds.push(categoriesBySlug.get(slug).id);
    if (categoryIds.length === 0) {
      failGroup(
        entries,
        `productKey "${productKey}": categorySlugs must include at least one category`,
      );
      continue;
    }

    const tagSlugs = primary.tagSlugs
      ? [
          ...new Set(
            primary.tagSlugs
              .split(",")
              .map((slug) => slug.trim())
              .filter(Boolean),
          ),
        ]
      : [];
    const tagIds = [];
    for (const slug of tagSlugs) {
      const tag = tagsBySlug.get(slug);
      if (tag) tagIds.push(tag.id);
      else
        summary.warnings.push({
          row: entries[0].rowNumber,
          warning: `Tag slug "${slug}" was not found and was skipped`,
        });
    }

    // Later rows may repeat a product-level field — it must match, not diverge.
    const mismatch = entries
      .slice(1)
      .find((entry) =>
        BULK_PRODUCT_LEVEL_FIELDS.some(
          (field) =>
            entry.values[field] && entry.values[field] !== primary[field],
        ),
      );
    if (mismatch) {
      const field = BULK_PRODUCT_LEVEL_FIELDS.find(
        (candidate) =>
          mismatch.values[candidate] &&
          mismatch.values[candidate] !== primary[candidate],
      );
      failGroup(
        entries,
        `productKey "${productKey}": ${field} on row ${mismatch.rowNumber} differs from the first row — leave it blank to inherit, or make it match`,
      );
      continue;
    }

    // Variant rows — every row in the group contributes one.
    const seenComboKeys = new Set();
    const variantPlans = [];
    const variantError = entries
      .map((entry) => {
        const v = entry.values;
        if (!v.color || !v.size || !v.stock) {
          return {
            row: entry.rowNumber,
            error: "color, size and stock are required on every row",
          };
        }
        const stock = Number(v.stock);
        if (!Number.isInteger(stock) || stock < 0) {
          return {
            row: entry.rowNumber,
            error: "stock must be a non-negative integer",
          };
        }
        const comboKey = `${v.color.toLowerCase()}|${v.size.toLowerCase()}`;
        if (seenComboKeys.has(comboKey)) {
          return {
            row: entry.rowNumber,
            error: `duplicate color+size ("${v.color}" / "${v.size}") for productKey "${productKey}"`,
          };
        }
        seenComboKeys.add(comboKey);
        variantPlans.push({
          rowNumber: entry.rowNumber,
          color: v.color,
          size: v.size,
          stock,
          explicitSku: v.sku || null,
          images: v.variantImageUrls
            ? v.variantImageUrls
                .split(",")
                .map((url) => url.trim())
                .filter(Boolean)
            : [],
        });
        return null;
      })
      .find(Boolean);
    if (variantError) {
      failGroup(entries, variantError.error);
      continue;
    }

    plans.push({
      productKey,
      rowNumbers: entries.map((entry) => entry.rowNumber),
      name: primary.name,
      description: primary.description,
      price,
      discountPercent,
      featured: parseBulkBoolean(primary.featured),
      brandId: brand.id,
      categoryIds,
      imageUrl: primary.imageUrl || null,
      tagIds,
      variantPlans,
    });
  }

  // --- Pass 3: resolve SKUs across the whole batch (globally unique) ---
  const explicitSkus = plans.flatMap((plan) =>
    plan.variantPlans
      .filter((vp) => vp.explicitSku)
      .map((vp) => vp.explicitSku),
  );
  const existingSkuRows = explicitSkus.length
    ? await prisma.variant.findMany({
        where: { sku: { in: explicitSkus } },
        select: { sku: true },
      })
    : [];
  const existingSkuSet = new Set(existingSkuRows.map((variant) => variant.sku));
  const claimedSkus = new Set();

  for (const plan of plans) {
    for (const vp of plan.variantPlans) {
      if (vp.explicitSku) {
        if (
          existingSkuSet.has(vp.explicitSku) ||
          claimedSkus.has(vp.explicitSku)
        ) {
          summary.failed.push({
            row: vp.rowNumber,
            error: `sku "${vp.explicitSku}" is already in use`,
          });
          plan.failed = true;
          continue;
        }
        vp.sku = vp.explicitSku;
      } else {
        const base =
          `${slugify(plan.name)}-${slugify(vp.color)}-${slugify(vp.size)}`
            .toUpperCase()
            .slice(0, 60);
        let candidate = base;
        let suffix = 2;
        while (existingSkuSet.has(candidate) || claimedSkus.has(candidate)) {
          candidate = `${base}-${suffix}`;
          suffix += 1;
        }
        vp.sku = candidate;
      }
      claimedSkus.add(vp.sku);
    }
  }

  // --- Pass 4: create — one transaction per product, so a problem with one
  // color/size in a group doesn't leave that product half-created. ---
  for (const plan of plans) {
    if (plan.failed) continue; // a variant in this group already recorded its own failure above
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.product.create({
          data: {
            id: crypto.randomUUID(),
            name: plan.name,
            description: plan.description,
            basePrice: plan.price,
            discountPercent: plan.discountPercent,
            featured: plan.featured,
            imageUrl: plan.imageUrl,
            brandId: plan.brandId,
            categories: {
              create: plan.categoryIds.map((categoryId) => ({ categoryId })),
            },
            tags: { create: plan.tagIds.map((tagId) => ({ tagId })) },
            variants: {
              create: plan.variantPlans.map((vp) => ({
                id: crypto.randomUUID(),
                color: vp.color,
                size: vp.size,
                sku: vp.sku,
                stock: vp.stock,
                images: vp.images,
              })),
            },
          },
        });
      });
      summary.productsCreated += 1;
      summary.variantsCreated += plan.variantPlans.length;
    } catch (error) {
      const reason =
        error?.code === "P2002"
          ? "a generated SKU collided unexpectedly — try again"
          : "could not create product";
      for (const rowNumber of plan.rowNumbers)
        summary.failed.push({ row: rowNumber, error: reason });
    }
  }

  return jsonResponse(summary);
};

const serializeAdminProduct = (product) => {
  const categories = product.categories.map(({ category }) => category);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    basePrice: product.basePrice,
    discountPercent: product.discountPercent,
    imageUrl: product.imageUrl,
    modelImages: product.modelImages,
    isNew: isProductNew(product.createdAt),
    featured: product.featured,
    archived: product.archived,
    brandId: product.brandId,
    brandName: product.brand?.name,
    categories,
    categoryIds: categories.map((category) => category.id),
    variants: product.variants,
    tags: product.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      filterTypeId: tag.filterTypeId,
      filterType: tag.filterType,
    })),
  };
};

// categoryIds is returned separately from `data`: it's a join-table
// relation, not a scalar column, so create/update wire it through Prisma's
// nested-write / replace syntax themselves rather than spreading it into a
// plain `data` object.
const getAdminProductInput = async (body, { partial = false } = {}) => {
  const fields = [
    "name",
    "description",
    "basePrice",
    "discountPercent",
    "imageUrl",
    "modelImages",
    "featured",
    "archived",
    "brandId",
  ];
  const data = Object.fromEntries(
    fields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );

  if (!partial) {
    const required = ["name", "description", "basePrice", "brandId"];
    const missing = required.filter(
      (field) =>
        body[field] === undefined || body[field] === null || body[field] === "",
    );
    if (missing.length) {
      return {
        error: `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`,
      };
    }
    if (!Array.isArray(body.categoryIds) || body.categoryIds.length === 0) {
      return { error: "categoryIds must include at least one category" };
    }
  }

  if (data.basePrice !== undefined) {
    data.basePrice = Number(data.basePrice);
    if (!Number.isFinite(data.basePrice))
      return { error: "basePrice must be a number" };
  }
  if (data.discountPercent !== undefined && data.discountPercent !== null) {
    data.discountPercent = Number(data.discountPercent);
    if (
      !Number.isFinite(data.discountPercent) ||
      data.discountPercent < 0 ||
      data.discountPercent > 100
    ) {
      return { error: "discountPercent must be between 0 and 100" };
    }
  }
  if (data.featured !== undefined && typeof data.featured !== "boolean") {
    return { error: "featured must be a boolean" };
  }
  if (data.archived !== undefined && typeof data.archived !== "boolean") {
    return { error: "archived must be a boolean" };
  }
  if (
    data.modelImages !== undefined &&
    (!Array.isArray(data.modelImages) ||
      data.modelImages.some((url) => typeof url !== "string"))
  ) {
    return { error: "modelImages must be an array of URLs" };
  }

  let categoryIds;
  if (body.categoryIds !== undefined) {
    if (
      !Array.isArray(body.categoryIds) ||
      body.categoryIds.some((id) => typeof id !== "string")
    ) {
      return { error: "categoryIds must be an array of category IDs" };
    }
    categoryIds = [...new Set(body.categoryIds)];
    if (categoryIds.length > 0) {
      const count = await prisma.category.count({
        where: { id: { in: categoryIds } },
      });
      if (count !== categoryIds.length) {
        return { error: "One or more categoryIds were not found" };
      }
    } else if (!partial) {
      return { error: "categoryIds must include at least one category" };
    }
  }

  return { data, categoryIds };
};

const listAdminProducts = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const products = await prisma.product.findMany({
    include: adminProductInclude,
    orderBy: { id: "asc" },
  });
  return jsonResponse(products.map(serializeAdminProduct));
};

const getAdminProduct = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const product = await prisma.product.findUnique({
    where: { id },
    include: adminProductInclude,
  });
  if (!product) return jsonResponse({ error: "Product not found" }, 404);
  return jsonResponse(serializeAdminProduct(product));
};

const createAdminProduct = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const input = await getAdminProductInput(body);
  if (input.error) return jsonResponse({ error: input.error }, 400);

  const product = await prisma.product.create({
    data: {
      id: body.id || crypto.randomUUID(),
      ...input.data,
      categories: {
        create: input.categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
    include: adminProductInclude,
  });
  if (product.featured) {
    await notifyBrandFollowersOnFeaturedProduct(prisma, {
      brandId: product.brandId,
      productId: product.id,
      productName: product.name,
    });
  }
  return jsonResponse(serializeAdminProduct(product), 201);
};

const updateAdminProduct = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const input = await getAdminProductInput(body, { partial: true });
  if (input.error) return jsonResponse({ error: input.error }, 400);
  if (Object.keys(input.data).length === 0) {
    return jsonResponse(
      { error: "At least one product field is required" },
      400,
    );
  }

  const existingProduct = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      basePrice: true,
      featured: true,
      variants: { select: { stock: true } },
    },
  });
  if (!existingProduct)
    return jsonResponse({ error: "Product not found" }, 404);
  if (input.data.archived === true) {
    const hasVariants = existingProduct.variants.length > 0;
    const isSoldOut = existingProduct.variants.every(
      (variant) => variant.stock === 0,
    );
    if (!hasVariants || !isSoldOut) {
      return jsonResponse(
        {
          error:
            "A product can only be archived when it has variants and every variant is sold out.",
        },
        409,
      );
    }
  }

  const product = await prisma.$transaction(async (transaction) => {
    if (input.categoryIds !== undefined) {
      await transaction.productCategory.deleteMany({
        where: { productId: id },
      });
      await transaction.productCategory.createMany({
        data: input.categoryIds.map((categoryId) => ({
          productId: id,
          categoryId,
        })),
      });
    }

    const updatedProduct = await transaction.product.update({
      where: { id },
      data: input.data,
      include: adminProductInclude,
    });

    if (
      input.data.basePrice !== undefined &&
      input.data.basePrice < existingProduct.basePrice
    ) {
      const wishlists = await transaction.wishlist.findMany({
        where: { productId: id },
        select: { userId: true },
      });

      if (wishlists.length > 0) {
        for (const { userId } of wishlists) {
          await createNotificationAndSendEmail(
            transaction,
            {
              userId,
              productId: id,
              type: "WISHLIST_SALE",
              message: `${updatedProduct.name} just went on sale!`,
            },
            updatedProduct.name,
          );
        }
      }
    }

    if (input.data.featured === true && !existingProduct.featured) {
      await notifyBrandFollowersOnFeaturedProduct(transaction, {
        brandId: updatedProduct.brandId,
        productId: id,
        productName: updatedProduct.name,
      });
    }

    return updatedProduct;
  });
  return jsonResponse(serializeAdminProduct(product));
};

const deleteAdminProduct = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  // OrderItem keeps productId as a plain string, not a real foreign key
  // (it has to survive the product being deleted, for exactly this
  // reason) — so the database will never stop this delete on its own.
  // Once a product has been ordered, deleting it would permanently erase
  // that line's name/image from a real customer's order history and
  // receipts. Archive it instead.
  const orderItemCount = await prisma.orderItem.count({
    where: { productId: id },
  });
  if (orderItemCount > 0) {
    return jsonResponse(
      {
        error: `${orderItemCount} past order${orderItemCount === 1 ? "" : "s"} reference this product. Archive it instead of deleting so order history stays intact.`,
      },
      409,
    );
  }

  await prisma.$transaction([
    prisma.productTag.deleteMany({ where: { productId: id } }),
    // Wishlist.productId is nullable and ON DELETE SET NULL at the DB
    // level (it's shared with the brand-follow feature) — without this,
    // deleting a favorited product leaves a ghost Wishlist row with
    // neither productId nor brandId set, invisible in the UI forever.
    prisma.wishlist.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  return jsonResponse({ deleted: true, id });
};

const replaceAdminProductTags = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  if (
    !Array.isArray(body.tagIds) ||
    body.tagIds.some((tagId) => typeof tagId !== "string")
  ) {
    return jsonResponse({ error: "tagIds must be an array of tag IDs" }, 400);
  }
  const tagIds = [...new Set(body.tagIds)];
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!product) return jsonResponse({ error: "Product not found" }, 404);
  const tagCount = await prisma.tag.count({ where: { id: { in: tagIds } } });
  if (tagCount !== tagIds.length) {
    return jsonResponse({ error: "One or more tag IDs were not found" }, 400);
  }

  await prisma.$transaction([
    prisma.productTag.deleteMany({ where: { productId: id } }),
    prisma.productTag.createMany({
      data: tagIds.map((tagId) => ({ productId: id, tagId })),
    }),
  ]);
  const updatedProduct = await prisma.product.findUnique({
    where: { id },
    include: adminProductInclude,
  });
  return jsonResponse(serializeAdminProduct(updatedProduct));
};

const parseVariantInput = (body, { partial = false } = {}) => {
  const fields = ["color", "size", "sku", "stock"];
  const data = Object.fromEntries(
    fields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
  if (!partial) {
    const missing = fields.filter(
      (field) =>
        body[field] === undefined || body[field] === null || body[field] === "",
    );
    if (missing.length) {
      return { error: `${missing.join(", ")} required` };
    }
  }
  if (data.stock !== undefined) {
    data.stock = Number(data.stock);
    if (!Number.isInteger(data.stock) || data.stock < 0) {
      return { error: "stock must be a non-negative integer" };
    }
  }
  return { data };
};

const notifyWaitlistEntriesOnRestock = async (
  transaction,
  { variantId, productId, productName, color, size, stockBefore, stockAfter },
) => {
  if (stockBefore !== 0 || stockAfter <= 0) return 0;

  const waitingEntries = await transaction.waitlistEntry.findMany({
    where: { variantId, status: "WAITING" },
    select: { id: true, userId: true },
  });

  if (waitingEntries.length === 0) return 0;

  for (const { userId } of waitingEntries) {
    await createNotificationAndSendEmail(
      transaction,
      {
        userId,
        productId,
        type: "WAITLIST_RESTOCK",
        message: `${productName} (${color}, ${size}) is back in stock!`,
      },
      productName,
    );
  }
  await transaction.waitlistEntry.updateMany({
    where: { id: { in: waitingEntries.map(({ id }) => id) } },
    data: { status: "NOTIFIED" },
  });
  return waitingEntries.length;
};

// "Follow" a brand (the same heart/save action as favoriting a product,
// just on a Brand instead) and get emailed the moment that brand launches
// a featured product — this is what turns a follow into something more
// than a bookmark.
const notifyBrandFollowersOnFeaturedProduct = async (
  transaction,
  { brandId, productId, productName },
) => {
  const followers = await transaction.wishlist.findMany({
    where: { brandId },
    select: { userId: true },
  });
  if (followers.length === 0) return 0;

  for (const { userId } of followers) {
    await createNotificationAndSendEmail(
      transaction,
      {
        userId,
        productId,
        type: "BRAND_FEATURED_PRODUCT",
        message: `${productName} just launched from a brand you follow.`,
      },
      productName,
    );
  }
  return followers.length;
};

const listAdminProductVariants = async (request, productId) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return jsonResponse({ error: "Product not found" }, 404);

  const variants = await prisma.variant.findMany({
    where: { productId },
    orderBy: { id: "asc" },
  });
  return jsonResponse(variants);
};

const createAdminProductVariant = async (request, productId) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return jsonResponse({ error: "Product not found" }, 404);

  const input = parseVariantInput(await request.json());
  if (input.error) return jsonResponse({ error: input.error }, 400);
  const variant = await prisma.variant.create({
    data: { id: crypto.randomUUID(), images: [], productId, ...input.data },
  });
  return jsonResponse(variant, 201);
};

const updateAdminVariant = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const input = parseVariantInput(await request.json(), { partial: true });
  if (input.error) return jsonResponse({ error: input.error }, 400);
  if (Object.keys(input.data).length === 0) {
    return jsonResponse(
      { error: "At least one of color, size, sku, or stock is required" },
      400,
    );
  }

  const variant = await prisma.$transaction(async (transaction) => {
    const existingVariant = await transaction.variant.findUnique({
      where: { id },
      select: {
        id: true,
        stock: true,
        color: true,
        size: true,
        productId: true,
        product: { select: { name: true } },
      },
    });
    if (!existingVariant) return null;

    const updatedVariant = await transaction.variant.update({
      where: { id },
      data: input.data,
    });

    const restocked =
      input.data.stock !== undefined &&
      existingVariant.stock === 0 &&
      input.data.stock > 0;
    if (restocked) {
      await notifyWaitlistEntriesOnRestock(transaction, {
        variantId: id,
        productId: existingVariant.productId,
        productName: existingVariant.product.name,
        color: existingVariant.color,
        size: existingVariant.size,
        stockBefore: existingVariant.stock,
        stockAfter: input.data.stock,
      });
    }

    return updatedVariant;
  });
  if (!variant) return jsonResponse({ error: "Variant not found" }, 404);
  return jsonResponse(variant);
};

const deleteAdminVariant = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const variant = await prisma.variant.findUnique({
    where: { id },
    select: { id: true, productId: true },
  });
  if (!variant) return jsonResponse({ error: "Variant not found" }, 404);

  const variantCount = await prisma.variant.count({
    where: { productId: variant.productId },
  });
  if (variantCount <= 1) {
    return jsonResponse(
      { error: "Cannot delete the product's only variant" },
      409,
    );
  }

  // WaitlistEntry.variantId is ON DELETE RESTRICT and there is no admin
  // screen to clear these by hand — without this, a variant with anyone
  // waiting on it becomes permanently undeletable. Once the variant is
  // gone there is nothing left to notify those entries about, so they're
  // cleared along with it rather than left to block the delete forever.
  await prisma.$transaction([
    prisma.waitlistEntry.deleteMany({ where: { variantId: id } }),
    prisma.variant.delete({ where: { id } }),
  ]);
  return jsonResponse({ deleted: true, id });
};

const addAdminVariantImage = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const { url } = await request.json();
  if (typeof url !== "string" || !url.trim()) {
    return jsonResponse({ error: "url must be a non-empty string" }, 400);
  }

  const variant = await prisma.variant.update({
    where: { id },
    data: { images: { push: url } },
  });
  return jsonResponse(variant);
};

const handleAdminVariantRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "POST" && id && segments[4] === "images") {
    return addAdminVariantImage(request, id);
  }
  if (request.method === "PUT" && id) return updateAdminVariant(request, id);
  if (request.method === "DELETE" && id) return deleteAdminVariant(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const handleAdminProductRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (id === "bulk" && segments[4]) {
    return handleAdminProductBulkRequest(request, segments);
  }
  if (
    request.method === "POST" &&
    id === "bulk-upload" &&
    segments[4] === undefined
  ) {
    return bulkProductImport(request);
  }
  if (
    request.method === "GET" &&
    id === "bulk-upload" &&
    segments[4] === "template"
  ) {
    return getAdminProductBulkUploadTemplate(request);
  }
  if (id && segments[4] === "variants") {
    if (request.method === "GET") return listAdminProductVariants(request, id);
    if (request.method === "POST")
      return createAdminProductVariant(request, id);
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (request.method === "PUT" && id && segments[4] === "tags") {
    return replaceAdminProductTags(request, id);
  }
  if (request.method === "GET" && !id) return listAdminProducts(request);
  if (request.method === "GET" && id) return getAdminProduct(request, id);
  if (request.method === "POST" && !id) return createAdminProduct(request);
  if (request.method === "PUT" && id) return updateAdminProduct(request, id);
  if (request.method === "DELETE" && id) return deleteAdminProduct(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const getBrandBySlug = async (idOrSlug) => {
  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, name: true, slug: true, logo: true, description: true },
  });
  if (!brand) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse(brand);
};

const initializeCheckout = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  // Orders are tied to a reachable inbox: every confirmation, shipping and
  // delivery email below depends on it, and an unverified address means a
  // paying customer silently hears nothing. `code` lets the checkout page
  // offer the fix inline instead of dead-ending on an error string.
  if (!user.emailVerified) {
    return jsonResponse(
      {
        error:
          "Please verify your email address before placing an order. We send order updates there.",
        code: "EMAIL_NOT_VERIFIED",
      },
      403,
    );
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return jsonResponse({ error: "Payment processing is not configured" }, 500);
  }

  const body = await request.json();
  const requiredFields = [
    "fullName",
    "country",
    "phone",
    "address",
    "city",
    "state",
    "postalCode",
  ];
  const missingFields = requiredFields.filter(
    (field) => typeof body[field] !== "string" || !body[field].trim(),
  );
  if (missingFields.length) {
    return jsonResponse(
      {
        error: `${missingFields.join(", ")} ${missingFields.length === 1 ? "is" : "are"} required`,
      },
      400,
    );
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse({ error: "Checkout items cannot be empty" }, 400);
  }

  const lineItems = items.map((item) => ({
    productId: item?.productId,
    variantId: item?.variantId,
    quantity: item?.quantity,
  }));
  const invalidLine = lineItems.find(
    ({ productId, variantId, quantity }) =>
      typeof productId !== "string" ||
      typeof variantId !== "string" ||
      !Number.isInteger(quantity) ||
      quantity <= 0,
  );
  if (invalidLine) {
    return jsonResponse({ error: "Goody Bag contains an invalid item" }, 400);
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: [...new Set(lineItems.map((item) => item.productId))] },
    },
    select: {
      id: true,
      name: true,
      basePrice: true,
      discountPercent: true,
      variants: { select: { id: true, size: true, color: true, stock: true } },
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  const insufficientItems = [];
  const orderItems = [];
  let total = 0;

  for (const lineItem of lineItems) {
    const product = productById.get(lineItem.productId);
    const variant = product?.variants.find(
      (candidate) => candidate.id === lineItem.variantId,
    );
    if (!product || !variant) {
      insufficientItems.push({
        productId: lineItem.productId,
        variantId: lineItem.variantId,
        reason: "Product or variant is no longer available",
      });
      continue;
    }
    if (variant.stock < lineItem.quantity) {
      insufficientItems.push({
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        size: variant.size,
        color: variant.color,
        requested: lineItem.quantity,
        available: variant.stock,
      });
      continue;
    }

    const itemPrice =
      product.basePrice * (1 - (product.discountPercent ?? 0) / 100);
    total += itemPrice * lineItem.quantity;
    orderItems.push({
      productId: product.id,
      variantId: variant.id,
      quantity: lineItem.quantity,
      priceAtPurchase: itemPrice,
    });
  }

  if (insufficientItems.length) {
    return jsonResponse(
      {
        error: "Some items do not have enough stock",
        items: insufficientItems,
      },
      409,
    );
  }

  const firstOrderPromo = await getFirstOrderPromoConfig();
  const firstOrderEligible = Boolean(
    firstOrderPromo?.active && !user.firstOrderPromoUsed,
  );
  const firstOrderDiscountPercent = firstOrderEligible
    ? firstOrderPromo.discountPercent
    : null;
  const firstOrderDiscountAmount = firstOrderEligible
    ? total * (firstOrderPromo.discountPercent / 100)
    : 0;
  const subtotalAfterFirstOrderDiscount = total - firstOrderDiscountAmount;
  let discount = null;
  let discountAmount = 0;
  const discountCode =
    typeof body.discountCode === "string"
      ? body.discountCode.trim().toUpperCase()
      : "";
  if (discountCode) {
    discount = await findActiveDiscount(discountCode);
    if (!discount) {
      return jsonResponse(
        { error: "This promo code is invalid or unavailable" },
        400,
      );
    }
    discountAmount = getDiscountAmount(
      discount,
      subtotalAfterFirstOrderDiscount,
    );
  }
  const firstOrderFreeShipping = Boolean(
    firstOrderEligible && firstOrderPromo.freeShipping,
  );
  const { fee: regionalShippingFee } = await getShippingFeeForState(body.state);
  const shippingFee = firstOrderFreeShipping ? 0 : regionalShippingFee;
  const orderTotal = Math.max(
    0,
    subtotalAfterFirstOrderDiscount - discountAmount + shippingFee,
  );

  // Nothing is written to the Order table yet — only once Paystack confirms
  // payment (in finalizeOrderFromReference) does a real Order get created.
  // Until then, this checkout attempt's only trace is this row, keyed by
  // the reference we're about to hand Paystack.
  const checkoutPayload = {
    userId: user.id,
    total: orderTotal,
    discountId: discount?.id ?? null,
    discountAmount,
    firstOrderDiscountPercent,
    firstOrderDiscountAmount,
    firstOrderFreeShipping,
    shippingFee,
    shippingAmount: shippingFee,
    fullName: body.fullName.trim(),
    country: body.country.trim(),
    phone: body.phone.trim(),
    address: body.address.trim(),
    city: body.city.trim(),
    state: body.state.trim(),
    postalCode: body.postalCode.trim(),
    items: orderItems,
  };
  const reference = `grv_${crypto.randomUUID()}`;

  // Only the newest attempt for this customer matters — clear out any
  // earlier checkout attempts they abandoned or that failed, rather than
  // letting them pile up.
  await prisma.pendingCheckout.deleteMany({ where: { userId: user.id } });
  await prisma.pendingCheckout.create({
    data: { reference, userId: user.id, payload: checkoutPayload },
  });

  try {
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference,
          amount: Math.round(orderTotal * 100),
          currency: "NGN",
          email: user.email,
          callback_url: `${new URL(request.url).origin}/checkout/complete`,
          // Explicit rather than left to account defaults: Paystack's test
          // mode shows every channel regardless of what a live account is
          // actually provisioned for, so this doesn't turn a channel on by
          // itself — bank_transfer specifically still requires Paystack to
          // activate it for the account — but it means nothing here needs
          // to change once they do.
          channels: ["card", "bank", "bank_transfer", "ussd", "qr"],
        }),
      },
    );
    const paystackBody = await paystackResponse.json().catch(() => null);
    if (!paystackResponse.ok || !paystackBody?.status || !paystackBody.data) {
      console.error("Paystack rejected checkout initialization", {
        status: paystackResponse.status,
        message: paystackBody?.message,
        gatewayResponse: paystackBody?.data?.gateway_response,
        amount: Math.round(orderTotal * 100),
        hasEmail: Boolean(user.email),
      });
      await prisma.pendingCheckout
        .delete({ where: { reference } })
        .catch(() => {});
      return jsonResponse(
        {
          error:
            paystackBody?.message ||
            paystackBody?.data?.gateway_response ||
            "Unable to initialize payment",
        },
        502,
      );
    }

    return jsonResponse({
      authorization_url: paystackBody.data.authorization_url,
      reference,
    });
  } catch (error) {
    await prisma.pendingCheckout
      .delete({ where: { reference } })
      .catch(() => {});
    console.error("Paystack checkout initialization failed", error);
    return jsonResponse({ error: "Unable to initialize payment" }, 502);
  }
};

const LOW_STOCK_THRESHOLD = 3;

const sendAdminOrderAlert = async (order) => {
  try {
    if (!process.env.ADMIN_ALERT_EMAIL) {
      console.warn("Admin order alert skipped: ADMIN_ALERT_EMAIL is missing");
      return;
    }

    const itemCount = order.items.reduce(
      (count, item) => count + item.quantity,
      0,
    );
    const emailSent = await sendEmail({
      to: process.env.ADMIN_ALERT_EMAIL,
      subject: `New order #${order.id}`,
      html: adminOrderAlertEmail({
        orderId: order.id,
        fullName: order.fullName,
        email: order.user.email,
        total: formatPrice(order.total),
        itemCount,
      }),
      from: FROM_INFO,
    });

    if (!emailSent.sent) console.error("Admin order alert failed", order.id);
  } catch (error) {
    console.error("Admin order alert failed", { orderId: order.id, error });
  }
};

const processOrderPaidNotificationsBestEffort = async (notifications) => {
  for (const pending of notifications) {
    try {
      await prisma.$transaction(async (transaction) => {
        const notification = await transaction.notification.findUnique({
          where: { id: pending.notificationId },
          select: {
            id: true,
            userId: true,
            productId: true,
            type: true,
            sent: true,
          },
        });
        if (!notification || notification.sent) return;

        await sendNotificationEmail(
          transaction,
          notification,
          pending.productName,
        );
      });
    } catch (error) {
      console.error("Order notification processing failed", {
        notificationId: pending.notificationId,
        error,
      });
    }
  }
};

const processRestockNotificationsBestEffort = async (restockedVariants) => {
  const simulatedFailure =
    process.env.SIMULATE_RESTOCK_NOTIFICATION_FAILURE === "1";

  for (const variant of restockedVariants) {
    try {
      if (simulatedFailure) {
        throw new Error("Simulated restock notification failure");
      }

      const waitingEntries = await prisma.waitlistEntry.findMany({
        where: { variantId: variant.variantId, status: "WAITING" },
        select: { id: true, userId: true },
      });

      if (waitingEntries.length === 0) continue;

      await prisma.$transaction(async (transaction) => {
        for (const { userId } of waitingEntries) {
          await createNotificationAndSendEmail(
            transaction,
            {
              userId,
              productId: variant.productId,
              type: "WAITLIST_RESTOCK",
              message: `${variant.productName} (${variant.color}, ${variant.size}) is back in stock!`,
            },
            variant.productName,
          );
        }
        await transaction.waitlistEntry.updateMany({
          where: {
            id: { in: waitingEntries.map(({ id }) => id) },
            status: "WAITING",
          },
          data: { status: "NOTIFIED" },
        });
      });
    } catch (error) {
      console.error("Restock notification processing failed", {
        variantId: variant.variantId,
        error,
      });
    }
  }
};

// Creates the real Order the instant Paystack confirms payment — the only
// moment an Order ever comes into existence. Called from both the webhook
// and the customer's return-from-Paystack verification; whichever gets
// there first wins the claim (see claimPendingCheckout), the other finds
// nothing left to claim and falls through to look up the Order that
// resulted, so both call sites can safely call this for the same
// reference without creating (or decrementing stock) twice.
const finalizeOrderFromReference = async (reference) => {
  const existingOrder = await prisma.order.findUnique({
    where: { paystackReference: reference },
    include: { items: true, user: { select: { email: true } } },
  });
  if (existingOrder) return { order: existingOrder, created: false };

  const notificationsToProcess = [];
  let createdOrder = null;

  await prisma.$transaction(async (transaction) => {
    // Read the payload before claiming — claimPendingCheckout deletes the
    // row, so it has to happen after we've captured what's in it.
    const pending = await transaction.pendingCheckout.findUnique({
      where: { reference },
    });
    if (!pending) return;

    const claimed = await claimPendingCheckout(transaction, reference);
    // Lost a race with a concurrent call that claimed it first — there's
    // nothing here to create; the caller re-checks for the resulting Order.
    if (!claimed) return;

    const payload = pending.payload;
    createdOrder = await transaction.order.create({
      data: {
        userId: payload.userId,
        total: payload.total,
        discountId: payload.discountId,
        discountAmount: payload.discountAmount,
        firstOrderDiscountPercent: payload.firstOrderDiscountPercent,
        firstOrderDiscountAmount: payload.firstOrderDiscountAmount,
        firstOrderFreeShipping: payload.firstOrderFreeShipping,
        shippingFee: payload.shippingFee,
        shippingAmount: payload.shippingAmount,
        status: "PAID",
        fulfillmentStatus: "PAYMENT_CONFIRMED",
        paystackReference: reference,
        fullName: payload.fullName,
        country: payload.country,
        phone: payload.phone,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        postalCode: payload.postalCode,
        items: { create: payload.items },
      },
      include: { items: true, user: { select: { email: true } } },
    });

    await transaction.orderFulfillmentEvent.create({
      data: { orderId: createdOrder.id, status: "PAYMENT_CONFIRMED" },
    });

    if (payload.discountId) {
      await transaction.discount.update({
        where: { id: payload.discountId },
        data: { usedCount: { increment: 1 } },
      });
    }

    if (
      payload.firstOrderDiscountPercent !== null ||
      payload.firstOrderFreeShipping
    ) {
      await transaction.user.updateMany({
        where: { id: payload.userId, firstOrderPromoUsed: false },
        data: { firstOrderPromoUsed: true },
      });
    }

    for (const item of createdOrder.items) {
      const variant = await transaction.variant.findUnique({
        where: { id: item.variantId },
        select: { id: true, stock: true, product: { select: { name: true } } },
      });
      if (!variant) {
        console.error(
          "Serious warning: paid order references a missing variant",
          { orderId: createdOrder.id, variantId: item.variantId },
        );
        continue;
      }
      if (variant.stock < item.quantity) {
        console.error(
          "Serious warning: stock race caused paid order to go below zero",
          {
            orderId: createdOrder.id,
            variantId: item.variantId,
            stock: variant.stock,
            quantity: item.quantity,
          },
        );
      }
      const stockBefore = variant.stock;
      const stockAfter = stockBefore - item.quantity;
      await transaction.variant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });

      if (
        stockBefore > LOW_STOCK_THRESHOLD &&
        stockAfter <= LOW_STOCK_THRESHOLD
      ) {
        const wishlists = await transaction.wishlist.findMany({
          where: { productId: item.productId },
          select: { userId: true },
        });
        for (const { userId } of wishlists) {
          const notification = await transaction.notification.create({
            data: {
              userId,
              productId: item.productId,
              type: "WISHLIST_LOW_STOCK",
              message: `${variant.product.name} is almost sold out!`,
            },
            select: { id: true },
          });
          notificationsToProcess.push({
            notificationId: notification.id,
            productName: variant.product.name,
          });
        }
      }
    }
  });

  if (!createdOrder) {
    // Someone else's transaction is (or already has) creating this order —
    // give it a moment to land, then hand back whatever exists.
    for (let attempt = 0; attempt < 5 && !createdOrder; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      createdOrder = await prisma.order.findUnique({
        where: { paystackReference: reference },
        include: { items: true, user: { select: { email: true } } },
      });
    }
    return { order: createdOrder, created: false };
  }

  // Off the response path so order completion never waits on an email
  // provider — but kept alive with waitUntil so it actually finishes on
  // Vercel instead of being frozen mid-send.
  queueOrderEmail(createdOrder.id, "ORDER_PAID");
  queueBrandNotifications(createdOrder.id);
  runInBackground(sendAdminOrderAlert(createdOrder), `Admin order alert for ${createdOrder.id}`);
  runInBackground(
    processOrderPaidNotificationsBestEffort(notificationsToProcess),
    `Order notification batch for ${createdOrder.id}`,
  );

  return { order: createdOrder, created: true };
};

// Terminal Paystack transaction states — nothing was charged, so it's safe
// to tell the customer to try again. Anything else (ongoing, queued,
// pay-offline, or a transient failure just reaching Paystack at all) is
// reported as PENDING instead: we simply don't know yet, and saying
// "failed" when the payment might still land a few seconds later (via the
// webhook) risks a customer retrying and paying twice.
const PAYSTACK_TERMINAL_FAILURE_STATUSES = new Set([
  "failed",
  "abandoned",
  "reversed",
]);

const verifyCheckout = async (request, url) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return jsonResponse({ error: "Payment processing is not configured" }, 500);
  }

  const reference = url.searchParams.get("reference");
  if (!reference) {
    return jsonResponse({ error: "Payment reference is required" }, 400);
  }

  // An Order only ever exists once payment is confirmed — if one's already
  // here, this is a repeat check (page refresh, a second poll) and there's
  // nothing left to do.
  const existingOrder = await prisma.order.findFirst({
    where: { paystackReference: reference, userId: user.id },
    select: { id: true, status: true },
  });
  if (existingOrder) {
    return jsonResponse({
      orderId: existingOrder.id,
      status: existingOrder.status,
    });
  }

  const pending = await prisma.pendingCheckout.findFirst({
    where: { reference, userId: user.id },
    select: { reference: true },
  });
  if (!pending) {
    // Could genuinely be unknown, or a concurrent webhook call just barely
    // beat us to claiming it — check once more before giving up.
    const justCreated = await prisma.order.findFirst({
      where: { paystackReference: reference, userId: user.id },
      select: { id: true, status: true },
    });
    if (justCreated) {
      return jsonResponse({
        orderId: justCreated.id,
        status: justCreated.status,
      });
    }
    return jsonResponse({ error: "Checkout session not found" }, 404);
  }

  let paystackBody;
  try {
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      },
    );
    paystackBody = await paystackResponse.json().catch(() => null);
    if (!paystackResponse.ok || !paystackBody?.status || !paystackBody.data) {
      // Paystack itself errored or hasn't settled the transaction yet — not
      // proof of failure, just not resolved. Keep the checkout session
      // alive and let the frontend poll again.
      return jsonResponse({ status: "PENDING" });
    }
  } catch (error) {
    console.error("Paystack verify request failed", { reference, error });
    return jsonResponse({ status: "PENDING" });
  }

  if (paystackBody.data.status === "success") {
    const { order } = await finalizeOrderFromReference(reference);
    if (!order) return jsonResponse({ status: "PENDING" });
    return jsonResponse({ orderId: order.id, status: order.status });
  }

  if (PAYSTACK_TERMINAL_FAILURE_STATUSES.has(paystackBody.data.status)) {
    await prisma.pendingCheckout.deleteMany({ where: { reference } });
    return jsonResponse({ status: "FAILED" });
  }

  return jsonResponse({ status: "PENDING" });
};

const orderItemInclude = {
  orderBy: { id: "asc" },
  select: {
    id: true,
    productId: true,
    variantId: true,
    quantity: true,
    priceAtPurchase: true,
  },
};

const enrichOrderItems = async (orders) => {
  const productIds = [
    ...new Set(
      orders.flatMap((order) => order.items.map((item) => item.productId)),
    ),
  ];
  const variantIds = [
    ...new Set(
      orders.flatMap((order) => order.items.map((item) => item.variantId)),
    ),
  ];
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

  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => {
      const product = productById.get(item.productId);
      const variant = variantById.get(item.variantId);
      return {
        ...item,
        productName: product?.name || "Unavailable product",
        brandName: product?.brand?.name || null,
        image: variant?.images?.[0] || product?.imageUrl || null,
        variant: variant || null,
      };
    }),
  }));
};

const listOrders = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      total: true,
      state: true,
      createdAt: true,
      items: orderItemInclude,
    },
  });
  const enrichedOrders = await enrichOrderItems(orders);
  return jsonResponse(
    enrichedOrders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      state: order.state,
      region: getRegionForState(order.state),
      createdAt: order.createdAt,
      itemCount: order.items.reduce((count, item) => count + item.quantity, 0),
      firstImage: order.items[0]?.image || null,
    })),
  );
};

const getOrder = async (request, id) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      status: true,
      total: true,
      fullName: true,
      country: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      postalCode: true,
      createdAt: true,
      items: orderItemInclude,
      fulfillmentStatus: true,
      courierName: true,
      trackingNumber: true,
      trackingUrl: true,
      shippingDate: true,
      estimatedDeliveryDate: true,
      deliveryNotes: true,
      fulfillmentEvents: {
        orderBy: { createdAt: "asc" },
        select: { status: true, createdAt: true },
      },
    },
  });
  if (!order) return jsonResponse({ error: "Order not found" }, 404);

  const {
    fulfillmentStatus,
    courierName,
    trackingNumber,
    trackingUrl,
    shippingDate,
    estimatedDeliveryDate,
    deliveryNotes,
    fulfillmentEvents,
    ...rest
  } = order;
  const [enrichedOrder] = await enrichOrderItems([rest]);
  return jsonResponse({
    ...enrichedOrder,
    region: getRegionForState(enrichedOrder.state),
    fulfillment: {
      status: fulfillmentStatus,
      courierName,
      trackingNumber,
      trackingUrl,
      shippingDate,
      estimatedDeliveryDate,
      deliveryNotes,
      events: fulfillmentEvents,
    },
  });
};

const savedAddressSelect = {
  id: true,
  label: true,
  fullName: true,
  country: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  postalCode: true,
  isDefault: true,
  createdAt: true,
};

const getAccountUser = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return null;
  return user;
};

const updateAccountProfile = async (request) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json();
  const allowedFields = ["name", "marketingOptIn"];
  const providedFields = Object.keys(body);
  if (
    providedFields.length === 0 ||
    providedFields.some((key) => !allowedFields.includes(key)) ||
    (Object.prototype.hasOwnProperty.call(body, "name") &&
      body.name !== null &&
      typeof body.name !== "string") ||
    (Object.prototype.hasOwnProperty.call(body, "marketingOptIn") &&
      typeof body.marketingOptIn !== "boolean")
  ) {
    return jsonResponse(
      { error: "Only name and marketingOptIn can be updated" },
      400,
    );
  }

  const data = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    data.name = body.name?.trim() || null;
  }
  // Consent is recorded with a timestamp: "they ticked a box at some point"
  // is not an audit trail.
  if (Object.prototype.hasOwnProperty.call(body, "marketingOptIn")) {
    data.marketingOptIn = body.marketingOptIn;
    data.marketingOptInAt = body.marketingOptIn ? new Date() : null;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      marketingOptIn: true,
    },
  });
  return jsonResponse({ user: updatedUser });
};

const markFirstOrderBannerSeen = async (request) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { hasSeenFirstOrderBanner: true },
    select: {
      id: true,
      hasSeenFirstOrderBanner: true,
      firstOrderPromoUsed: true,
    },
  });
  return jsonResponse({ user: updatedUser });
};

const getFirstOrderPromoForUser = async (request) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
  const promo = await getFirstOrderPromoConfig();
  if (!promo)
    return jsonResponse({ error: "First-order promo is not configured" }, 404);
  return jsonResponse(serializeFirstOrderPromo(promo, user));
};

const getCheckoutShippingFee = async (request, url) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const { region, fee } = await getShippingFeeForState(
    url.searchParams.get("state"),
  );
  const promo = await getFirstOrderPromoConfig();
  const freeShipping = Boolean(
    promo?.active && promo.freeShipping && !user.firstOrderPromoUsed,
  );
  return jsonResponse({
    region,
    fee,
    chargedFee: freeShipping ? 0 : fee,
    freeShipping,
  });
};

const previewCheckoutDiscount = async (request) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json();
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const subtotal = Number(body.subtotal);
  if (!code) return jsonResponse({ error: "Enter a promo code" }, 400);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return jsonResponse({ error: "Invalid checkout subtotal" }, 400);
  }

  const discount = await findActiveDiscount(code);
  if (!discount) {
    return jsonResponse(
      { error: "This promo code is invalid or unavailable" },
      400,
    );
  }
  const firstOrderPromo = await getFirstOrderPromoConfig();
  const firstOrderEligible = Boolean(
    firstOrderPromo?.active && !user.firstOrderPromoUsed,
  );
  const firstOrderDiscount = firstOrderEligible
    ? subtotal * (firstOrderPromo.discountPercent / 100)
    : 0;
  const discountAmount = getDiscountAmount(
    discount,
    Math.max(0, subtotal - firstOrderDiscount),
  );
  return jsonResponse({
    code: discount.code,
    type: discount.type,
    value: discount.value,
    discountAmount,
  });
};

const getAdminFirstOrderPromo = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const promo = await getFirstOrderPromoConfig();
  if (!promo)
    return jsonResponse({ error: "First-order promo is not configured" }, 404);
  return jsonResponse(promo);
};

const updateAdminFirstOrderPromo = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const data = {};
  if (body.discountPercent !== undefined) {
    data.discountPercent = Number(body.discountPercent);
    if (
      !Number.isFinite(data.discountPercent) ||
      data.discountPercent < 0 ||
      data.discountPercent > 100
    ) {
      return jsonResponse(
        { error: "discountPercent must be between 0 and 100" },
        400,
      );
    }
  }
  if (body.freeShipping !== undefined) {
    if (typeof body.freeShipping !== "boolean") {
      return jsonResponse({ error: "freeShipping must be a boolean" }, 400);
    }
    data.freeShipping = body.freeShipping;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return jsonResponse({ error: "active must be a boolean" }, 400);
    }
    data.active = body.active;
  }
  if (body.bannerMessage !== undefined) {
    if (typeof body.bannerMessage !== "string" || !body.bannerMessage.trim()) {
      return jsonResponse(
        { error: "bannerMessage must be a non-empty string" },
        400,
      );
    }
    data.bannerMessage = body.bannerMessage.trim();
  }
  if (Object.keys(data).length === 0) {
    return jsonResponse({ error: "At least one promo field is required" }, 400);
  }

  const existing = await getFirstOrderPromoConfig();
  const promo = existing
    ? await prisma.firstOrderPromo.update({
        where: { id: existing.id },
        data,
        select: firstOrderPromoSelect,
      })
    : await prisma.firstOrderPromo.create({
        data: {
          id: FIRST_ORDER_PROMO_ID,
          discountPercent: data.discountPercent ?? 10,
          freeShipping: data.freeShipping ?? true,
          active: data.active ?? true,
          bannerMessage:
            data.bannerMessage ||
            "Welcome to GRV. Enjoy 10% off and free shipping on your first order.",
        },
        select: firstOrderPromoSelect,
      });
  return jsonResponse(promo);
};

const listAdminShippingFees = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const fees = await prisma.shippingFee.findMany({
    where: { region: { in: SHIPPING_FEE_REGIONS } },
    orderBy: { id: "asc" },
    select: shippingFeeSelect,
  });
  return jsonResponse(
    SHIPPING_FEE_REGIONS.map(
      (region) =>
        fees.find((fee) => fee.region === region) || { region, fee: 0 },
    ),
  );
};

const updateAdminShippingFee = async (request, region) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  if (!SHIPPING_FEE_REGIONS.includes(region)) {
    return jsonResponse({ error: "Unknown shipping region" }, 404);
  }

  const body = await request.json();
  const fee = Number(body.fee);
  if (!Number.isFinite(fee) || fee < 0) {
    return jsonResponse({ error: "fee must be a non-negative number" }, 400);
  }
  const shippingFee = await prisma.shippingFee.upsert({
    where: { region },
    create: { region, fee },
    update: { fee },
    select: shippingFeeSelect,
  });
  return jsonResponse(shippingFee);
};

const changeAccountPassword = async (request) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json();
  if (
    typeof body.newPassword !== "string" ||
    !body.newPassword ||
    Object.keys(body).some((key) => key !== "newPassword")
  ) {
    return jsonResponse({ error: "newPassword is required" }, 400);
  }
  // The signup form enforces this client-side (minLength=8); this endpoint
  // didn't, so a too-short password only failed with Supabase's generic
  // error after a round trip. Same rule, checked before we make the call.
  if (body.newPassword.length < 8) {
    return jsonResponse(
      { error: "Password must be at least 8 characters." },
      400,
    );
  }

  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(
    user.id,
    { password: body.newPassword },
  );
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ updated: true });
};

const listAccountAddresses = async (request) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const addresses = await prisma.savedAddress.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: savedAddressSelect,
  });
  return jsonResponse(addresses);
};

const getSavedAddressData = (body, { partial = false } = {}) => {
  const fields = [
    "label",
    "fullName",
    "country",
    "phone",
    "address",
    "city",
    "state",
    "postalCode",
  ];
  const data = Object.fromEntries(
    fields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
  if (body.isDefault !== undefined) data.isDefault = body.isDefault;

  const requiredFields = fields.filter(
    (field) => typeof data[field] !== "string" || !data[field].trim(),
  );
  if (!partial && requiredFields.length) {
    return { error: `${requiredFields.join(", ")} are required` };
  }
  if (
    Object.entries(data).some(
      ([field, value]) =>
        (fields.includes(field) &&
          (typeof value !== "string" || !value.trim())) ||
        (field === "isDefault" && typeof value !== "boolean"),
    )
  ) {
    return { error: "Address fields are invalid" };
  }
  return { data };
};

const createAccountAddress = async (request) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json();
  const result = getSavedAddressData(body);
  if (result.error) return jsonResponse({ error: result.error }, 400);

  const address = await prisma.$transaction(async (transaction) => {
    if (result.data.isDefault) {
      await transaction.savedAddress.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return transaction.savedAddress.create({
      data: { ...result.data, userId: user.id },
      select: savedAddressSelect,
    });
  });
  return jsonResponse(address, 201);
};

const updateAccountAddress = async (request, id) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const result = getSavedAddressData(await request.json(), { partial: true });
  if (result.error || Object.keys(result.data).length === 0) {
    return jsonResponse(
      { error: result.error || "At least one address field is required" },
      400,
    );
  }

  const existingAddress = await prisma.savedAddress.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existingAddress)
    return jsonResponse({ error: "Address not found" }, 404);

  const address = await prisma.$transaction(async (transaction) => {
    if (result.data.isDefault) {
      await transaction.savedAddress.updateMany({
        where: { userId: user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    return transaction.savedAddress.update({
      where: { id: existingAddress.id },
      data: result.data,
      select: savedAddressSelect,
    });
  });
  return jsonResponse(address);
};

const deleteAccountAddress = async (request, id) => {
  const user = await getAccountUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const result = await prisma.savedAddress.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0)
    return jsonResponse({ error: "Address not found" }, 404);
  return jsonResponse({ deleted: true, id });
};

const handleAccountRequest = async (request, segments) => {
  if (segments[2] === "profile" && request.method === "PUT") {
    return updateAccountProfile(request);
  }
  if (segments[2] === "change-password" && request.method === "POST") {
    return changeAccountPassword(request);
  }
  if (segments[2] === "addresses") {
    const id = segments[3] ? decodeURIComponent(segments[3]) : null;
    if (request.method === "GET" && !id) return listAccountAddresses(request);
    if (request.method === "POST" && !id) return createAccountAddress(request);
    if (request.method === "PUT" && id)
      return updateAccountAddress(request, id);
    if (request.method === "DELETE" && id) {
      return deleteAccountAddress(request, id);
    }
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const wishlistProductSelect = {
  id: true,
  name: true,
  imageUrl: true,
  basePrice: true,
  discountPercent: true,
  brand: { select: { id: true, name: true, slug: true } },
  variants: {
    select: { id: true, color: true, size: true, stock: true, images: true },
    orderBy: { id: "asc" },
  },
};

const wishlistBrandSelect = {
  id: true,
  name: true,
  slug: true,
  logo: true,
  description: true,
};

const cartItemSelect = {
  id: true,
  productId: true,
  variantId: true,
  quantity: true,
};

const getCartItems = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    select: { items: { orderBy: { id: "asc" }, select: cartItemSelect } },
  });
  return jsonResponse(cart?.items || []);
};

const syncCart = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body?.items)) {
    return jsonResponse({ error: "items must be an array" }, 400);
  }

  const items = body.items.map((item) => ({
    productId: item?.productId,
    variantId: item?.variantId,
    quantity: item?.quantity,
  }));
  const invalidItem = items.find(
    ({ productId, variantId, quantity }) =>
      typeof productId !== "string" ||
      !productId.trim() ||
      typeof variantId !== "string" ||
      !variantId.trim() ||
      !Number.isInteger(quantity) ||
      quantity <= 0,
  );
  if (invalidItem) {
    return jsonResponse({ error: "Goody Bag contains an invalid item" }, 400);
  }

  const cart = await prisma.$transaction(async (transaction) => {
    const existingCart = await transaction.cart.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    const currentCart =
      existingCart ||
      (await transaction.cart.create({
        data: { userId: user.id },
        select: { id: true },
      }));

    await transaction.cartItem.deleteMany({
      where: { cartId: currentCart.id },
    });
    if (items.length > 0) {
      await transaction.cartItem.createMany({
        data: items.map((item) => ({ ...item, cartId: currentCart.id })),
      });
    }

    return transaction.cart.update({
      where: { id: currentCart.id },
      data: { updatedAt: new Date(), abandonedReminderSent: false },
      select: { items: { orderBy: { id: "asc" }, select: cartItemSelect } },
    });
  });

  return jsonResponse({ items: cart.items });
};

const listWishlist = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const wishlist = await prisma.wishlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      productId: true,
      brandId: true,
      createdAt: true,
      product: { select: wishlistProductSelect },
      brand: { select: wishlistBrandSelect },
    },
  });
  return jsonResponse(wishlist);
};

// One endpoint for both — a row favorites a product or a brand depending
// on which id the caller sends, never both.
const addToWishlist = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json();
  const hasProductId =
    typeof body.productId === "string" && body.productId.trim();
  const hasBrandId = typeof body.brandId === "string" && body.brandId.trim();
  if (!hasProductId && !hasBrandId) {
    return jsonResponse({ error: "productId or brandId is required" }, 400);
  }

  if (hasBrandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: body.brandId },
      select: { id: true },
    });
    if (!brand) return jsonResponse({ error: "Brand not found" }, 404);

    const wishlist = await prisma.wishlist.upsert({
      where: { userId_brandId: { userId: user.id, brandId: brand.id } },
      create: { userId: user.id, brandId: brand.id },
      update: {},
      select: { id: true, brandId: true, createdAt: true },
    });
    return jsonResponse({ success: true, wishlist });
  }

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: { id: true },
  });
  if (!product) return jsonResponse({ error: "Product not found" }, 404);

  const wishlist = await prisma.wishlist.upsert({
    where: {
      userId_productId: { userId: user.id, productId: product.id },
    },
    create: { userId: user.id, productId: product.id },
    update: { productId: product.id },
    select: { id: true, productId: true, createdAt: true },
  });
  return jsonResponse({ success: true, wishlist });
};

const removeFromWishlist = async (request, productId) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  await prisma.wishlist.deleteMany({
    where: { userId: user.id, productId },
  });
  return jsonResponse({ success: true, productId });
};

const removeBrandFromWishlist = async (request, brandId) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  await prisma.wishlist.deleteMany({
    where: { userId: user.id, brandId },
  });
  return jsonResponse({ success: true, brandId });
};

const waitlistEntrySelect = {
  id: true,
  variantId: true,
  status: true,
  createdAt: true,
  variant: {
    select: {
      color: true,
      size: true,
      product: { select: { id: true, name: true } },
    },
  },
};

const listWaitlist = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const entries = await prisma.waitlistEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: waitlistEntrySelect,
  });
  return jsonResponse(entries);
};

const addToWaitlist = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
  if (!user.emailVerified) {
    return jsonResponse(
      { error: "Verify your email before joining the waitlist" },
      403,
    );
  }

  const body = await request.json();
  if (typeof body.variantId !== "string" || !body.variantId.trim()) {
    return jsonResponse({ error: "variantId is required" }, 400);
  }

  const variant = await prisma.variant.findUnique({
    where: { id: body.variantId },
    select: { id: true },
  });
  if (!variant) return jsonResponse({ error: "Variant not found" }, 404);

  const existing = await prisma.waitlistEntry.findUnique({
    where: {
      userId_variantId: { userId: user.id, variantId: variant.id },
    },
    select: waitlistEntrySelect,
  });
  if (
    existing &&
    (existing.status === "WAITING" || existing.status === "NOTIFIED")
  ) {
    return jsonResponse({ success: true, entry: existing });
  }

  let entry;
  try {
    entry = await prisma.waitlistEntry.upsert({
      where: {
        userId_variantId: { userId: user.id, variantId: variant.id },
      },
      create: { userId: user.id, variantId: variant.id },
      update: { status: "WAITING" },
      select: waitlistEntrySelect,
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    entry = await prisma.waitlistEntry.findUnique({
      where: {
        userId_variantId: { userId: user.id, variantId: variant.id },
      },
      select: waitlistEntrySelect,
    });
  }

  return jsonResponse({ success: true, entry });
};

const removeFromWaitlist = async (request, id) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  await prisma.waitlistEntry.deleteMany({ where: { id, userId: user.id } });
  return jsonResponse({ success: true, id });
};

const handleWaitlistRequest = async (request, segments) => {
  const id = segments[2] ? decodeURIComponent(segments[2]) : null;
  if (request.method === "GET" && !id) return listWaitlist(request);
  if (request.method === "POST" && !id) return addToWaitlist(request);
  if (request.method === "DELETE" && id) return removeFromWaitlist(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const handlePaystackWebhook = async (request) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(rawBody, signature)) {
    return jsonResponse({ error: "Invalid signature" }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid webhook payload" }, 400);
  }

  if (event.event === "refund.processed" || event.event === "refund.failed") {
    await applyPaystackRefundEvent(event);
    return jsonResponse({ ok: true });
  }

  // Explicit terminal failure/abandonment — nothing to finalize, just clear
  // the in-flight checkout attempt so it isn't left sitting around.
  if (event.event === "charge.failed") {
    const failedReference = event.data?.reference;
    if (typeof failedReference === "string" && failedReference) {
      await prisma.pendingCheckout.deleteMany({
        where: { reference: failedReference },
      });
    }
    return jsonResponse({ ok: true });
  }

  if (event.event !== "charge.success") return jsonResponse({ ok: true });

  const reference = event.data?.reference;
  if (typeof reference !== "string" || !reference) {
    return jsonResponse({ error: "Missing payment reference" }, 400);
  }

  await finalizeOrderFromReference(reference);

  // A webhook has no browser session, so it cannot identify which persisted
  // cart should be cleared after checkout.
  return jsonResponse({ ok: true });
};

const isVercelCronRequest = (request) => {
  if (request.method !== "GET" || !process.env.CRON_SECRET) return false;

  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`, "utf8");
  const actual = Buffer.from(
    request.headers.get("authorization") || "",
    "utf8",
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// --- Route table -----------------------------------------------------
// Each entry matches a path (optionally with `:param` segments) and,
// unless `method` is omitted, a single HTTP method. Entries whose method
// is omitted delegate their own method handling (and 405s) to the
// handler, exactly as the sub-dispatchers below already do — this table
// only replaces the old if-chain, it does not change how any individual
// endpoint authorizes or validates a request. Order matters: the first
// matching entry wins, same as the if-chain it replaces.
//
// `path()` builds a matcher for the common case (literal segments plus
// `:param` placeholders); a handful of routes with OR'd path segments or
// bespoke method logic (account, admin/reminders/run) pass a `match`
// function instead.
const path = (...segments) => ({
  match: (requestSegments) => {
    if (requestSegments.length !== segments.length) return null;
    const params = {};
    for (let i = 0; i < segments.length; i++) {
      const token = segments[i];
      if (token.startsWith(":")) {
        params[token.slice(1)] = decodeURIComponent(requestSegments[i]);
      } else if (token !== requestSegments[i]) {
        return null;
      }
    }
    return params;
  },
});

const prefix = (...segments) => ({
  match: (requestSegments) => {
    if (requestSegments.length < segments.length) return null;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i] !== requestSegments[i]) return null;
    }
    return {};
  },
});

const ROUTES = [
  {
    method: "POST",
    ...path("api", "auth", "send-verification"),
    handler: ({ request }) => sendVerificationCode(request),
    errorLog: "Verification email send failed",
    errorMessage: "Could not send your verification email",
  },
  {
    method: "POST",
    ...path("api", "auth", "verify-email"),
    handler: ({ request }) => verifyEmail(request),
    errorLog: "Email verification failed",
    errorMessage: "Could not verify your email",
  },
  {
    method: "GET",
    ...path("api", "checkout", "verify"),
    handler: ({ request, url }) => verifyCheckout(request, url),
    errorLog: "Checkout verification failed",
    errorMessage: "Unable to verify payment",
    errorStatus: 502,
  },
  {
    ...prefix("api", "cart"),
    handler: async ({ request, segments }) => {
      if (request.method === "GET" && !segments[2])
        return getCartItems(request);
      if (request.method === "POST" && segments[2] === "sync")
        return syncCart(request);
      return jsonResponse({ error: "Method not allowed" }, 405);
    },
    errorLog: "Cart request failed",
    errorMessage: "Goody Bag request failed",
  },
  {
    ...prefix("api", "wishlist"),
    handler: async ({ request, segments }) => {
      if (request.method === "GET" && !segments[2])
        return listWishlist(request);
      if (request.method === "POST" && !segments[2])
        return addToWishlist(request);
      if (request.method === "DELETE" && segments[2] === "brand" && segments[3])
        return removeBrandFromWishlist(
          request,
          decodeURIComponent(segments[3]),
        );
      if (request.method === "DELETE" && segments[2])
        return removeFromWishlist(request, decodeURIComponent(segments[2]));
      return jsonResponse({ error: "Method not allowed" }, 405);
    },
    errorLog: "Wishlist request failed",
    errorMessage: "Wishlist request failed",
  },
  {
    ...prefix("api", "waitlist"),
    handler: ({ request, segments }) =>
      handleWaitlistRequest(request, segments),
    errorLog: "Waitlist request failed",
    errorMessage: "Waitlist request failed",
  },
  {
    method: "POST",
    ...path("api", "contact"),
    handler: ({ request }) => createContactSubmission(request),
    errorLog: "Contact submission failed",
    errorMessage: "Unable to save contact submission",
  },
  {
    method: "POST",
    ...path("api", "track"),
    handler: ({ request }) => recordVisit(request),
    errorLog: "Visit tracking failed",
    errorMessage: "ok",
  },
  {
    method: "POST",
    ...path("api", "newsletter", "subscribe"),
    handler: ({ request }) => subscribeToNewsletter(request),
    errorLog: "Newsletter subscription failed",
    errorMessage: "Unable to subscribe right now.",
  },
  {
    method: "GET",
    ...prefix("api", "orders"),
    handler: ({ request, segments }) => {
      const id = segments[2] ? decodeURIComponent(segments[2]) : null;
      return id ? getOrder(request, id) : listOrders(request);
    },
    errorLog: "Orders request failed",
    errorMessage: "Unable to load orders",
  },
  {
    match: (segments) =>
      segments.length >= 3 &&
      segments[0] === "api" &&
      segments[1] === "account" &&
      ["profile", "change-password", "addresses", "first-order-promo"].includes(
        segments[2],
      )
        ? {}
        : null,
    handler: ({ request, segments }) => {
      if (request.method === "GET" && segments[2] === "first-order-promo")
        return getFirstOrderPromoForUser(request);
      if (request.method === "POST" && segments[2] === "first-order-promo")
        return markFirstOrderBannerSeen(request);
      return handleAccountRequest(request, segments);
    },
    errorLog: "Account request failed",
    errorMessage: "Account request failed",
  },
  {
    ...path("api", "admin", "first-order-promo"),
    handler: ({ request }) => {
      if (request.method === "GET") return getAdminFirstOrderPromo(request);
      if (request.method === "PUT") return updateAdminFirstOrderPromo(request);
      return jsonResponse({ error: "Method not allowed" }, 405);
    },
    errorLog: "First-order promo request failed",
    errorMessage: "First-order promo request failed",
  },
  {
    method: "GET",
    ...path("api", "checkout", "shipping-fee"),
    handler: ({ request, url }) => getCheckoutShippingFee(request, url),
    errorLog: "Checkout shipping fee request failed",
    errorMessage: "Unable to load shipping fee",
  },
  {
    method: "POST",
    ...path("api", "checkout", "discount"),
    handler: ({ request }) => previewCheckoutDiscount(request),
    errorLog: "Checkout discount request failed",
    errorMessage: "Unable to apply promo code",
  },
  {
    ...prefix("api", "admin", "shipping-fees"),
    handler: ({ request, segments }) => {
      if (request.method === "GET" && !segments[3])
        return listAdminShippingFees(request);
      if (request.method === "PUT" && segments[3])
        return updateAdminShippingFee(request, decodeURIComponent(segments[3]));
      return jsonResponse({ error: "Method not allowed" }, 405);
    },
    errorLog: "Shipping fee request failed",
    errorMessage: "Shipping fee request failed",
  },
  {
    method: "POST",
    ...path("api", "admin", "notifications", "process"),
    handler: ({ request }) => processUnsentNotifications(request),
    errorLog: "Notification processing request failed",
    errorMessage: "Notification processing failed",
  },
  {
    // Reachable either by Vercel Cron (GET + CRON_SECRET bearer token) or
    // by an authenticated admin (POST). Kept self-contained rather than
    // expressed through the generic `method` field because of that dual
    // entry path.
    ...path("api", "admin", "reminders", "run"),
    handler: async ({ request }) => {
      const cronRequest = isVercelCronRequest(request);
      if (request.method !== "POST" && !cronRequest) {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      if (!cronRequest) {
        const guard = await requireAdmin(request);
        if (!guard.ok) return jsonResponse(guard.body, guard.status);
      }
      return jsonResponse(await runReminderChecks());
    },
    errorLog: "Reminder check request failed",
    errorMessage: "Reminder check failed",
  },
  {
    ...prefix("api", "admin", "content-sections"),
    handler: ({ request, segments }) =>
      handleAdminContentSectionRequest(request, segments),
    errorLog: "Content section request failed",
    errorMessage: "Content section request failed",
  },
  {
    method: "GET",
    ...path("api", "content-sections"),
    handler: ({ url }) => listPublicContentSections(url),
    errorLog: "Content sections request failed",
    errorMessage: "Unable to load this page's content",
  },
  {
    method: "POST",
    ...path("api", "admin", "upload-signature"),
    handler: ({ request }) => getUploadSignature(request),
    errorLog: "Upload signature request failed",
    errorMessage: "Unable to start the upload",
  },
  {
    ...prefix("api", "admin", "discounts"),
    handler: ({ request, segments }) =>
      handleAdminDiscountRequest(request, segments),
    errorMessage: "Discount request failed",
  },
  {
    method: "GET",
    ...path("api", "admin", "messages", "options"),
    handler: ({ request }) => getMessagingOptions(request),
    errorMessage: "Request failed",
  },
  {
    method: "POST",
    ...path("api", "admin", "messages", "preview"),
    handler: ({ request }) => previewMessageAudience(request),
    errorLog: "Message preview failed",
    errorMessage: "Could not work out who would receive this.",
  },
  {
    method: "POST",
    ...path("api", "admin", "messages", "send"),
    handler: ({ request }) => sendAdminMessage(request),
    errorLog: "Admin message send failed",
    errorMessage: "The email could not be sent.",
  },
  {
    ...prefix("api", "admin", "contact-submissions"),
    handler: ({ request, segments, url }) => {
      const id = segments[3] ? decodeURIComponent(segments[3]) : null;
      if (request.method === "GET" && !id)
        return listAdminContactSubmissions(request, url);
      if (request.method === "POST" && id && segments[4] === "reply")
        return replyToAdminContactSubmission(request, id);
      if (request.method === "PUT" && id)
        return markAdminContactSubmissionRead(request, id);
      return jsonResponse({ error: "Method not allowed" }, 405);
    },
    errorLog: "Contact submissions request failed",
    errorMessage: "Contact submissions request failed",
  },
  {
    ...prefix("api", "admin", "campaigns"),
    handler: ({ request, segments, url }) =>
      handleAdminCampaignRequest(request, segments, url),
    errorLog: "Admin campaign request failed",
    errorMessage: "Campaign request failed",
  },
  {
    method: "GET",
    ...path("api", "unsubscribe"),
    handler: ({ request, url }) => handleUnsubscribe(request, url),
    errorLog: "Unsubscribe failed",
    errorMessage: "Unable to process this unsubscribe link",
  },
  {
    ...prefix("api", "admin", "brands"),
    handler: ({ request, segments }) =>
      handleAdminBrandRequest(request, segments),
    errorMessage: "Brand request failed",
  },
  {
    ...prefix("api", "admin", "categories"),
    handler: ({ request, segments }) =>
      handleAdminCategoryRequest(request, segments),
    errorMessage: "Category request failed",
  },
  {
    ...prefix("api", "admin", "filter-types"),
    handler: ({ request, segments }) =>
      handleAdminFilterTypeRequest(request, segments),
    errorMessage: "Filter type request failed",
  },
  {
    ...prefix("api", "admin", "tags"),
    handler: ({ request, segments }) =>
      handleAdminTagRequest(request, segments),
    errorMessage: "Tag request failed",
  },
  {
    ...prefix("api", "admin", "journal"),
    handler: ({ request, segments }) =>
      handleAdminJournalRequest(request, segments),
    errorMessage: "Journal request failed",
  },
  {
    ...prefix("api", "admin", "orders"),
    handler: ({ request, segments, url }) =>
      handleAdminOrderRequest(request, segments, url),
    errorMessage: "Order request failed",
  },
  {
    ...prefix("api", "admin", "customers"),
    handler: ({ request, segments, url }) =>
      handleAdminCustomerRequest(request, segments, url),
    errorMessage: "Customer request failed",
  },
  {
    ...prefix("api", "admin", "products"),
    handler: ({ request, segments }) =>
      handleAdminProductRequest(request, segments),
    errorMessage: "Product request failed",
  },
  {
    ...prefix("api", "admin", "variants"),
    handler: ({ request, segments }) =>
      handleAdminVariantRequest(request, segments),
    errorMessage: "Variant request failed",
  },
  {
    ...prefix("api", "cases"),
    handler: ({ request, segments }) => handleCaseRequest(request, segments),
    errorMessage: "Request failed",
  },
  {
    ...prefix("api", "admin", "cases"),
    handler: ({ request, segments, url }) =>
      handleAdminCaseRequest(request, segments, url),
    errorMessage: "Case request failed",
  },
  {
    method: "GET",
    ...path("api", "admin", "analytics"),
    handler: ({ request, url }) => getAdminAnalytics(request, url),
    errorMessage: "Analytics request failed",
  },
  {
    method: "GET",
    ...path("api", "admin", "visitors"),
    handler: ({ request, url }) => getAdminVisitors(request, url),
    errorMessage: "Visitors request failed",
  },
  {
    method: "GET",
    ...path("api", "admin", "ga4"),
    handler: ({ request, url }) => getAdminGa4(request, url),
    errorMessage: "Google Analytics request failed",
  },
  {
    ...prefix("api", "admin", "export"),
    handler: ({ request, segments, url }) =>
      handleAdminExportRequest(request, segments, url),
    errorMessage: "Export failed",
  },
  {
    ...prefix("api", "admin", "staff"),
    handler: ({ request, segments }) =>
      handleAdminStaffRequest(request, segments),
    errorMessage: "Staff request failed",
  },
  {
    method: "POST",
    ...path("api", "checkout", "initialize"),
    handler: ({ request }) => initializeCheckout(request),
    errorMessage: "Checkout initialization failed",
  },
  {
    method: "POST",
    ...path("api", "webhooks", "paystack"),
    handler: ({ request }) => handlePaystackWebhook(request),
    errorLog: "Paystack webhook failed",
    errorMessage: "Webhook processing failed",
  },

  // --- Public reads -----------------------------------------------
  {
    method: "GET",
    ...path("api", "products", "new-arrivals"),
    handler: () => listNewArrivals(),
  },
  {
    // Must stay ahead of `api/products/:id`, which would otherwise treat
    // "filters" as a product id.
    method: "GET",
    ...path("api", "products", "filters"),
    handler: ({ url }) => listProductFilters(url),
    errorMessage: "Unable to load filters",
  },
  {
    method: "GET",
    ...path("api", "products"),
    handler: ({ url }) => listProducts(url),
  },
  {
    method: "GET",
    ...path("api", "products", ":id"),
    handler: ({ params }) => getProductById(params.id),
  },
  {
    method: "GET",
    ...path("api", "categories"),
    handler: () => listCategories(),
  },
  {
    method: "GET",
    ...path("api", "brands"),
    handler: () => listBrands(),
  },
  {
    method: "GET",
    ...path("api", "filter-types"),
    handler: () => listFilterTypes(),
  },
  {
    method: "GET",
    ...path("api", "tags"),
    handler: () => listTags(),
  },
  {
    method: "GET",
    ...path("api", "brands", ":slug"),
    handler: ({ params }) => getBrandBySlug(params.slug),
  },
  {
    method: "GET",
    ...path("api", "journal"),
    handler: () => listPublishedJournalPosts(),
  },
  {
    method: "GET",
    ...path("api", "journal", ":slug"),
    handler: ({ params }) => getPublishedJournalPost(params.slug),
  },
  {
    method: "GET",
    ...path("api", "me"),
    handler: async ({ request }) => {
      const user = await getCurrentUser(request);
      if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
      return jsonResponse({ user });
    },
    errorMessage: "Internal server error",
  },
];

export const handleApiRequest = async (request) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean); // e.g. ["api","products",":id"]

  let pathMatched = false;
  for (const route of ROUTES) {
    const params = route.match(segments);
    if (!params) continue;
    pathMatched = true;
    if (route.method && route.method !== request.method) continue;

    try {
      const response = await route.handler({ request, url, segments, params });
      const cacheControl = publicCacheControl(request, response.status);
      if (cacheControl) response.headers.set("Cache-Control", cacheControl);
      return response;
    } catch (error) {
      console.error(route.errorLog || route.errorMessage, error);
      Sentry.captureException(error, {
        tags: { route: route.errorLog || route.errorMessage },
      });
      return jsonResponse(
        { error: route.errorMessage || "Request failed" },
        route.errorStatus || 500,
      );
    }
  }

  return jsonResponse(
    { error: pathMatched ? "Method not allowed" : "Not found" },
    pathMatched ? 405 : 404,
  );
};
