import { prisma } from "../server/prisma.js";
import { getCurrentUser } from "../server/getCurrentUser.js";
import { requireAdmin } from "../server/requireAdmin.js";
import { getSupabaseAdmin } from "../server/supabaseAdmin.js";
import { sendEmail } from "../server/sendEmail.js";
import {
  queueOrderEmail,
  EMAIL_TYPE_FOR_STATUS,
} from "../server/orderEmails.js";
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
import {
  verifyPaystackSignature,
  claimOrderForPayment,
} from "../server/paystack.js";
import { formatPrice } from "../lib/productHelpers.js";
import { getRegionForState, NIGERIAN_REGIONS } from "../lib/nigeriaRegions.js";
import { v2 as cloudinary } from "cloudinary";
import { parse } from "csv-parse/sync";
import { randomInt, timingSafeEqual } from "node:crypto";

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
    jsonResponse({ error: "That verification code is invalid or expired" }, 400);

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
    return { error: `audience must be one of ${CAMPAIGN_AUDIENCES.join(", ")}` };
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
        ? body.featuredProductIds.filter((id) => typeof id === "string").slice(0, 3)
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
  if (!["DRAFT", "SCHEDULED", "CANCELLED", "FAILED"].includes(existing.status)) {
    return jsonResponse(
      { error: `A campaign that is ${existing.status} can no longer be edited` },
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

const cloudinaryReady = initializeCloudinary();

const DEFAULT_PAGE_SIZE = 48;
const MAX_PAGE_SIZE = 100;

const productInclude = {
  variants: true,
  styleTags: true,
  tags: {
    include: {
      tag: {
        include: {
          filterType: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
  brand: { select: { id: true, name: true, slug: true } },
};

// Flattens relations (styleTags, brand) back to the plain shape the frontend
// already expects from the old mock data — kept here so no component needs
// to change just because the DB models these as relations.
const serializeProduct = (product) => ({
  id: product.id,
  name: product.name,
  gender: product.gender,
  categoryId: product.categoryId,
  subcategory: product.subcategory,
  styleTags: product.styleTags.map((tag) => tag.name),
  tags: product.tags.map(({ tag }) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    filterTypeId: tag.filterTypeId,
    filterType: tag.filterType,
  })),
  description: product.description,
  basePrice: product.basePrice,
  discountPercent: product.discountPercent,
  status: product.status,
  createdAt: product.createdAt,
  imageUrl: product.imageUrl,
  isNew: product.isNew,
  archived: product.archived,
  brandId: product.brandId,
  brandName: product.brand?.name,
  variants: product.variants.map((variant) => ({
    id: variant.id,
    color: variant.color,
    size: variant.size,
    stock: variant.stock,
    sku: variant.sku,
    images: variant.images,
  })),
});

const serializeCategory = (category) => ({
  id: category.id,
  name: category.name,
  styleTags: category.styleTags.map((tag) => tag.name),
  // Exposed publicly so storefront navigation and filters reflect the
  // taxonomy an admin actually manages, instead of a hardcoded copy.
  subcategories: (category.subcategories || []).map((subcategory) => ({
    id: subcategory.id,
    name: subcategory.name,
    slug: subcategory.slug,
  })),
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

const buildProductsWhere = (url) => {
  const params = url.searchParams;
  const where = { archived: params.get("archived") === "true" };
  // Each entry here is AND'd together. Anything needing case-insensitive
  // matching or a relation lookup goes here rather than on `where`
  // directly, since Prisma's `in` has no insensitive mode.
  const and = [];

  const genders = filterValues(params, "gender");
  if (genders.length) where.gender = { in: genders };

  const categories = filterValues(params, "category");
  if (categories.length) where.categoryId = { in: categories };

  const brands = filterValues(params, "brand");
  if (brands.length) where.brandId = { in: brands };

  const subcategories = filterValues(params, "subcategory");
  if (subcategories.length) {
    and.push({
      OR: subcategories.map((value) => ({
        subcategory: { equals: value, mode: "insensitive" },
      })),
    });
  }

  const styleTags = filterValues(params, "style");
  if (styleTags.length) {
    and.push({
      OR: styleTags.map((value) => ({
        styleTags: { some: { name: { equals: value, mode: "insensitive" } } },
      })),
    });
  }

  // Admin-managed tags (see /api/admin/tags) are matched by slug so the
  // taxonomy an admin builds is filterable on the storefront.
  const tags = filterValues(params, "tag");
  if (tags.length) {
    and.push({
      OR: tags.map((value) => ({
        tags: { some: { tag: { slug: { equals: value, mode: "insensitive" } } } },
      })),
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

  const query = params.get("q");
  if (query) {
    and.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { brand: { name: { contains: query, mode: "insensitive" } } },
        { subcategory: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { styleTags: { some: { name: { contains: query, mode: "insensitive" } } } },
        { tags: { some: { tag: { name: { contains: query, mode: "insensitive" } } } } },
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
  const where = buildProductsWhere(url);
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

// Facets for the filter drawer, derived from the live catalogue rather
// than a hardcoded list, so anything an admin creates becomes filterable
// as soon as a product uses it. Counts respect every *other* active
// filter but not the facet's own, which is what lets a shopper widen a
// selection without the options disappearing underneath them.
const CLOTHING_SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
];

const compareSizes = (a, b) => {
  const numericA = Number(a);
  const numericB = Number(b);
  const aIsNumeric = Number.isFinite(numericA);
  const bIsNumeric = Number.isFinite(numericB);
  // Numeric (shoe) sizes sort numerically and sit before lettered sizes.
  if (aIsNumeric && bIsNumeric) return numericA - numericB;
  if (aIsNumeric) return -1;
  if (bIsNumeric) return 1;

  const indexA = CLOTHING_SIZE_ORDER.indexOf(a.toUpperCase());
  const indexB = CLOTHING_SIZE_ORDER.indexOf(b.toUpperCase());
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return a.localeCompare(b);
};

// "Red" and "red" are the same colour to a shopper even when they were
// typed differently at product-entry time.
const titleCase = (value) =>
  value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const listProductFilters = async (url) => {
  const where = buildProductsWhere(url);

  const [products, priceBounds] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        categoryId: true,
        subcategory: true,
        brandId: true,
        brand: { select: { id: true, name: true } },
        styleTags: { select: { name: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
        variants: { select: { size: true, color: true, stock: true } },
      },
    }),
    prisma.product.aggregate({
      where,
      _min: { basePrice: true },
      _max: { basePrice: true },
    }),
  ]);

  const tally = (entries) => {
    const counts = new Map();
    for (const { value, label } of entries) {
      if (!value) continue;
      const existing = counts.get(value);
      if (existing) existing.count += 1;
      else counts.set(value, { value, label: label ?? value, count: 1 });
    }
    return [...counts.values()];
  };

  const brands = tally(
    products.map((product) => ({
      value: product.brandId,
      label: product.brand?.name,
    })),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const categories = tally(
    products.map((product) => ({ value: product.categoryId })),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const subcategories = tally(
    products.map((product) => ({
      value: product.subcategory,
      label: product.subcategory,
    })),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const styles = tally(
    products.flatMap((product) =>
      product.styleTags.map((tag) => ({ value: tag.name })),
    ),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const tags = tally(
    products.flatMap((product) =>
      product.tags.map(({ tag }) => ({ value: tag.slug, label: tag.name })),
    ),
  ).sort((a, b) => a.label.localeCompare(b.label));

  // Variant facets are per-product, not per-variant: a product with three
  // black variants counts once against "Black".
  const sizes = tally(
    products.flatMap((product) => [
      ...new Set(product.variants.map((variant) => variant.size)),
    ].map((size) => ({ value: size }))),
  ).sort((a, b) => compareSizes(a.value, b.value));

  const colors = tally(
    products.flatMap((product) => [
      ...new Set(
        product.variants.map((variant) => titleCase(variant.color || "")),
      ),
    ].map((color) => ({ value: color }))),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const inStockCount = products.filter((product) =>
    product.variants.some((variant) => variant.stock > 0),
  ).length;

  return jsonResponse({
    total: products.length,
    brands,
    categories,
    subcategories,
    styles,
    tags,
    sizes,
    colors,
    inStockCount,
    price: {
      min: priceBounds._min.basePrice ?? 0,
      max: priceBounds._max.basePrice ?? 0,
    },
    sorts: PRODUCT_SORT_KEYS,
  });
};

const listNewArrivals = async () => {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
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

const listCategories = async () => {
  const [categories, inUse] = await Promise.all([
    prisma.category.findMany({
      include: {
        styleTags: true,
        subcategories: { orderBy: { name: "asc" } },
      },
      orderBy: { id: "asc" },
    }),
    // Products carry a free-text `subcategory` alongside the managed
    // Subcategory table, and the two have drifted apart. Merging both
    // keeps storefront navigation complete without silently linking to a
    // subcategory that has nothing to show.
    prisma.product.groupBy({
      by: ["categoryId", "subcategory"],
      where: { archived: false, status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);

  const inUseByCategory = new Map();
  for (const row of inUse) {
    if (!row.subcategory) continue;
    const list = inUseByCategory.get(row.categoryId) || [];
    list.push({ name: row.subcategory, count: row._count._all });
    inUseByCategory.set(row.categoryId, list);
  }

  return jsonResponse(
    categories.map((category) => {
      const serialized = serializeCategory(category);
      const used = inUseByCategory.get(category.id) || [];
      const byName = new Map(
        serialized.subcategories.map((subcategory) => [
          subcategory.name.toLowerCase(),
          { ...subcategory, productCount: 0 },
        ]),
      );
      for (const { name, count } of used) {
        const key = name.toLowerCase();
        const existing = byName.get(key);
        if (existing) existing.productCount = count;
        else byName.set(key, { id: null, name, slug: null, productCount: count });
      }
      return {
        ...serialized,
        subcategories: [...byName.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      };
    }),
  );
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
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  return jsonResponse(filterTypes);
};

const listSiteImages = async () => {
  const images = await prisma.siteImage.findMany({
    select: { key: true, imageUrl: true },
    orderBy: { key: "asc" },
  });
  return jsonResponse(
    Object.fromEntries(images.map((image) => [image.key, image.imageUrl])),
  );
};

const updateAdminSiteImage = async (request, key) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  if (typeof body.imageUrl !== "string" || !body.imageUrl.trim()) {
    return jsonResponse({ error: "imageUrl must be a non-empty string" }, 400);
  }

  const image = await prisma.siteImage.update({
    where: { key },
    data: { imageUrl: body.imageUrl.trim() },
    select: { key: true, imageUrl: true, updatedAt: true },
  });
  return jsonResponse(image);
};

const uploadImage = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return jsonResponse({ error: "A file field is required" }, 400);
    }
    if (!file.type?.startsWith("image/")) {
      return jsonResponse({ error: "The file must be an image" }, 400);
    }

    if (!cloudinaryReady) {
      console.error("Cloudinary credentials are not configured");
      return jsonResponse({ error: "Image upload is not configured" }, 500);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "grv", resource_type: "image" },
        (error, uploadResult) => {
          if (error) reject(error);
          else resolve(uploadResult);
        },
      );
      uploadStream.end(buffer);
    });

    if (!result?.secure_url) {
      console.error("Cloudinary returned no secure URL");
      return jsonResponse({ error: "Image upload returned no URL" }, 502);
    }
    return jsonResponse({ url: result.secure_url });
  } catch (error) {
    console.error("Cloudinary image upload failed", error);
    return jsonResponse({ error: "Image upload failed" }, 502);
  }
};

const listSubcategories = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const subcategories = await prisma.subcategory.findMany({
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { products: true } },
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });
  return jsonResponse(subcategories);
};

const createSubcategory = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  if (!body.name || !body.slug || !body.categoryId) {
    return jsonResponse(
      { error: "name, slug, and categoryId are required" },
      400,
    );
  }

  const subcategory = await prisma.subcategory.create({
    data: {
      name: body.name,
      slug: body.slug,
      categoryId: body.categoryId,
    },
    include: { category: { select: { id: true, name: true } } },
  });
  return jsonResponse(subcategory, 201);
};

const updateSubcategory = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const data = Object.fromEntries(
    ["name", "slug", "categoryId"]
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
  if (Object.keys(data).length === 0) {
    return jsonResponse(
      { error: "At least one of name, slug, or categoryId is required" },
      400,
    );
  }

  const subcategory = await prisma.subcategory.update({
    where: { id },
    data,
    include: { category: { select: { id: true, name: true } } },
  });
  return jsonResponse(subcategory);
};

const deleteSubcategory = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const productCount = await prisma.product.count({
    where: { subcategoryId: id },
  });
  if (productCount > 0) {
    return jsonResponse(
      {
        error: "Subcategory has products and cannot be deleted",
        productCount,
      },
      409,
    );
  }

  await prisma.subcategory.delete({ where: { id } });
  return jsonResponse({ deleted: true, id });
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

const createAdminBrand = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  if (!body.name || !body.slug) {
    return jsonResponse({ error: "name and slug are required" }, 400);
  }

  const brand = await prisma.brand.create({
    data: {
      id: crypto.randomUUID(),
      name: body.name,
      slug: body.slug,
      logo: body.logo,
    },
    include: { _count: { select: { products: true } } },
  });
  return jsonResponse(brand, 201);
};

const updateAdminBrand = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json();
  const data = Object.fromEntries(
    ["name", "slug", "logo", "description"]
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
  if (Object.keys(data).length === 0) {
    return jsonResponse(
      { error: "At least one of name, slug, logo, or description is required" },
      400,
    );
  }

  const brand = await prisma.brand.update({
    where: { id },
    data,
    include: { _count: { select: { products: true } } },
  });
  return jsonResponse(brand);
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

  await prisma.brand.delete({ where: { id } });
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

const handleAdminSubcategoryRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listSubcategories(request);
  if (request.method === "POST" && !id) return createSubcategory(request);
  if (request.method === "PUT" && id) return updateSubcategory(request, id);
  if (request.method === "DELETE" && id) return deleteSubcategory(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const listAdminCategoryFilterTypes = async (request, categoryId) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
      filterTypes: {
        select: {
          filterType: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  if (!category) return jsonResponse({ error: "Category not found" }, 404);

  return jsonResponse({
    ...category,
    filterTypes: category.filterTypes
      .map(({ filterType }) => filterType)
      .sort((left, right) => left.name.localeCompare(right.name)),
  });
};

const replaceAdminCategoryFilterTypes = async (request, categoryId) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true },
  });
  if (!category) return jsonResponse({ error: "Category not found" }, 404);

  const body = await request.json();
  if (
    !Array.isArray(body.filterTypeIds) ||
    body.filterTypeIds.some((id) => typeof id !== "string")
  ) {
    return jsonResponse(
      { error: "filterTypeIds must be an array of IDs" },
      400,
    );
  }

  const filterTypeIds = [...new Set(body.filterTypeIds)];
  const filterTypeCount = await prisma.filterType.count({
    where: { id: { in: filterTypeIds } },
  });
  if (filterTypeCount !== filterTypeIds.length) {
    return jsonResponse(
      { error: "One or more filterTypeIds were not found" },
      400,
    );
  }

  const updatedCategory = await prisma.$transaction(async (transaction) => {
    await transaction.categoryFilterType.deleteMany({ where: { categoryId } });
    if (filterTypeIds.length) {
      await transaction.categoryFilterType.createMany({
        data: filterTypeIds.map((filterTypeId) => ({
          categoryId,
          filterTypeId,
        })),
      });
    }

    return transaction.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        filterTypes: {
          select: {
            filterType: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  });

  return jsonResponse({
    ...updatedCategory,
    filterTypes: updatedCategory.filterTypes
      .map(({ filterType }) => filterType)
      .sort((left, right) => left.name.localeCompare(right.name)),
  });
};

const handleAdminCategoryFilterTypeRequest = async (request, segments) => {
  const categoryId = decodeURIComponent(segments[3]);
  if (request.method === "GET") {
    return listAdminCategoryFilterTypes(request, categoryId);
  }
  if (request.method === "PUT") {
    return replaceAdminCategoryFilterTypes(request, categoryId);
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const filterTypeSelect = {
  id: true,
  name: true,
  slug: true,
  _count: { select: { tags: true } },
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

  const filterType = await prisma.filterType.create({
    data: { name: body.name, slug: body.slug },
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
  if (Object.keys(data).length === 0) {
    return jsonResponse(
      { error: "At least one of name or slug is required" },
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

const sectionSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  showOnHomepage: true,
  homepageOrder: true,
  createdAt: true,
  products: { select: { productId: true } },
};

const serializeAdminSection = (section) => ({
  ...section,
  productIds: section.products.map(({ productId }) => productId),
  productCount: section.products.length,
  products: undefined,
});

const validateSectionInput = (body, { partial = false } = {}) => {
  const data = {};
  for (const field of ["title", "slug", "description"]) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "string" || !body[field].trim()) {
        return { error: `${field} must be a non-empty string` };
      }
      data[field] = body[field].trim();
    } else if (!partial) {
      return { error: `${field} is required` };
    }
  }
  if (body.showOnHomepage !== undefined) {
    if (typeof body.showOnHomepage !== "boolean") {
      return { error: "showOnHomepage must be a boolean" };
    }
    data.showOnHomepage = body.showOnHomepage;
  }
  if (body.homepageOrder !== undefined) {
    if (
      body.homepageOrder !== null &&
      (!Number.isInteger(Number(body.homepageOrder)) ||
        Number(body.homepageOrder) < 0)
    ) {
      return { error: "homepageOrder must be a non-negative integer or null" };
    }
    data.homepageOrder =
      body.homepageOrder === null ? null : Number(body.homepageOrder);
  }
  return { data };
};

const listAdminSections = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const sections = await prisma.section.findMany({
    orderBy: [{ homepageOrder: "asc" }, { createdAt: "desc" }],
    select: sectionSelect,
  });
  return jsonResponse(sections.map(serializeAdminSection));
};

const getAdminSection = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const section = await prisma.section.findUnique({
    where: { id },
    select: sectionSelect,
  });
  if (!section) return jsonResponse({ error: "Section not found" }, 404);
  return jsonResponse(serializeAdminSection(section));
};

const createAdminSection = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const result = validateSectionInput(await request.json());
  if (result.error) return jsonResponse({ error: result.error }, 400);
  const section = await prisma.section.create({
    data: result.data,
    select: sectionSelect,
  });
  return jsonResponse(serializeAdminSection(section), 201);
};

const updateAdminSection = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const result = validateSectionInput(await request.json(), { partial: true });
  if (result.error || Object.keys(result.data).length === 0) {
    return jsonResponse(
      { error: result.error || "At least one section field is required" },
      400,
    );
  }
  const section = await prisma.section.update({
    where: { id },
    data: result.data,
    select: sectionSelect,
  });
  return jsonResponse(serializeAdminSection(section));
};

const deleteAdminSection = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  await prisma.section.delete({ where: { id } });
  return jsonResponse({ deleted: true, id });
};

const replaceAdminSectionProducts = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const body = await request.json();
  if (
    !Array.isArray(body.productIds) ||
    body.productIds.some((productId) => typeof productId !== "string")
  ) {
    return jsonResponse(
      { error: "productIds must be an array of product IDs" },
      400,
    );
  }
  const productIds = [...new Set(body.productIds)];
  const section = await prisma.section.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!section) return jsonResponse({ error: "Section not found" }, 404);
  const productCount = await prisma.product.count({
    where: { id: { in: productIds } },
  });
  if (productCount !== productIds.length) {
    return jsonResponse({ error: "One or more products were not found" }, 400);
  }
  await prisma.$transaction([
    prisma.productSection.deleteMany({ where: { sectionId: id } }),
    prisma.productSection.createMany({
      data: productIds.map((productId) => ({ productId, sectionId: id })),
    }),
  ]);
  return getAdminSection(request, id);
};

const handleAdminSectionRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminSections(request);
  if (request.method === "GET" && id && segments[4] !== "products") {
    return getAdminSection(request, id);
  }
  if (request.method === "POST" && !id) return createAdminSection(request);
  if (request.method === "PUT" && id && segments[4] === "products") {
    return replaceAdminSectionProducts(request, id);
  }
  if (request.method === "PUT" && id) return updateAdminSection(request, id);
  if (request.method === "DELETE" && id) return deleteAdminSection(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

const serializePublicSection = (section) => ({
  id: section.id,
  title: section.title,
  slug: section.slug,
  description: section.description,
  showOnHomepage: section.showOnHomepage,
  homepageOrder: section.homepageOrder,
  products: section.products.map(serializeProduct),
});

const sectionProductInclude = {
  product: { include: productInclude },
};

const publicSectionProductsInclude = {
  where: { product: { archived: false, status: "ACTIVE" } },
  include: sectionProductInclude,
};

const getPublicSection = async (slug) => {
  const section = await prisma.section.findUnique({
    where: { slug },
    include: { products: publicSectionProductsInclude },
  });
  if (!section) return jsonResponse({ error: "Section not found" }, 404);
  return jsonResponse(
    serializePublicSection({
      ...section,
      products: section.products.map(({ product }) => product),
    }),
  );
};

const listHomepageSections = async () => {
  const sections = await prisma.section.findMany({
    where: { showOnHomepage: true },
    orderBy: [{ homepageOrder: "asc" }, { createdAt: "asc" }],
    include: { products: publicSectionProductsInclude },
  });
  return jsonResponse(
    sections.map((section) =>
      serializePublicSection({
        ...section,
        products: section.products.map(({ product }) => product),
      }),
    ),
  );
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

    if (
      body.status === "CANCELLED" &&
      !["PAID", "SHIPPED"].includes(order.status)
    ) {
      return {
        error: `Only PAID or SHIPPED orders can be cancelled; this order is ${order.status}`,
        status: 409,
      };
    }

    if (body.status === "CANCELLED") {
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
      data: { status: body.status },
      select: adminOrderSelect,
    });
    return { order: updatedOrder };
  });

  if (result.error) return jsonResponse({ error: result.error }, result.status);

  // The status change is committed at this point, so the customer is owed
  // the matching email. sendOrderEmail dedupes on (order, type), which is
  // what stops an admin flipping a status back and forth from sending the
  // same notification twice.
  const emailType = EMAIL_TYPE_FOR_STATUS[body.status];
  if (emailType) queueOrderEmail(id, emailType);

  if (body.status === "CANCELLED" && restockedVariants.length > 0) {
    void processRestockNotificationsBestEffort(restockedVariants).catch(
      (error) => {
        console.error("Restock notification batch failed", {
          orderId: result.order.id,
          error,
        });
      },
    );
  }
  return jsonResponse(await serializeAdminOrder(result.order));
};

const handleAdminOrderRequest = async (request, segments, url) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminOrders(request, url);
  if (request.method === "GET" && id) return getAdminOrder(request, id);
  if (request.method === "PUT" && id && segments[4] === "status") {
    return updateAdminOrderStatus(request, id);
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
  category: { select: { id: true, name: true } },
  subcategoryRef: { select: { id: true, name: true, slug: true } },
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

const BULK_PRODUCT_CSV_COLUMNS = [
  "name",
  "description",
  "price",
  "brandSlug",
  "department",
  "subcategorySlug",
  "designCode",
  "color",
  "size",
  "stock",
  "tagSlugs",
];

const csvCell = (value) => {
  const cell = String(value ?? "");
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
};

const getAdminProductBulkUploadTemplate = async (request) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return new Response(JSON.stringify(guard.body), {
      status: guard.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const exampleRow = [
    "Example product",
    "A sample product for bulk upload",
    "49.99",
    "northline",
    "Men",
    "tops",
    "DESIGN-001",
    "Black",
    "M",
    "10",
    "casual,weekend",
  ];
  const csv = [BULK_PRODUCT_CSV_COLUMNS, exampleRow]
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

const bulkProductDepartments = {
  Men: { gender: "men", categoryId: "apparel" },
  Women: { gender: "women", categoryId: "apparel" },
  Accessories: { gender: "unisex", categoryId: "accessories" },
};

const getBulkProductRowValue = (row, field) =>
  typeof row[field] === "string" ? row[field].trim() : "";

const validateBulkProductRow = async (
  row,
  rowNumber,
  context,
  seenDesignCodes,
) => {
  const requiredFields = [
    "name",
    "description",
    "price",
    "brandSlug",
    "department",
    "subcategorySlug",
    "designCode",
    "color",
    "size",
    "stock",
  ];
  const values = Object.fromEntries(
    BULK_PRODUCT_CSV_COLUMNS.map((field) => [
      field,
      getBulkProductRowValue(row, field),
    ]),
  );
  const missingField = requiredFields.find((field) => !values[field]);
  if (missingField) return { error: `${missingField} is required` };

  const department = bulkProductDepartments[values.department];
  if (!department) {
    return {
      error: "department must be one of Men, Women, or Accessories",
    };
  }

  const price = Number(values.price);
  if (!Number.isFinite(price)) return { error: "price must be a number" };

  const stock = Number(values.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: "stock must be a non-negative integer" };
  }

  if (seenDesignCodes.has(values.designCode)) {
    return { error: "designCode is duplicated in this CSV" };
  }
  seenDesignCodes.add(values.designCode);
  if (context.existingDesignCodes.has(values.designCode)) {
    return { error: "designCode is already used by an existing product" };
  }

  const brand = context.brandsBySlug.get(values.brandSlug);
  if (!brand) return { error: `brandSlug "${values.brandSlug}" was not found` };

  const subcategory = context.subcategoriesBySlug.get(values.subcategorySlug);
  if (!subcategory) {
    return {
      error: `subcategorySlug "${values.subcategorySlug}" was not found`,
    };
  }
  if (subcategory.categoryId !== department.categoryId) {
    return {
      error: `subcategorySlug "${values.subcategorySlug}" belongs to category "${subcategory.categoryId}", not department ${values.department}`,
    };
  }
  if (
    subcategory.genders.length > 0 &&
    !subcategory.genders.includes(department.gender)
  ) {
    return {
      error: `subcategorySlug "${values.subcategorySlug}" is associated with ${subcategory.genders.join(" and ")}, not department ${values.department}`,
    };
  }

  return {
    values,
    brand,
    subcategory,
    department,
    price,
    stock,
  };
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

  const dataRows = rows.slice(1);
  const designCodes = dataRows
    .map((row) =>
      getBulkProductRowValue(
        Object.fromEntries(
          BULK_PRODUCT_CSV_COLUMNS.map((field, index) => [field, row[index]]),
        ),
        "designCode",
      ),
    )
    .filter(Boolean);
  const [brands, subcategories, tags, existingVariants] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, slug: true } }),
    prisma.subcategory.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        categoryId: true,
        products: { select: { gender: true }, distinct: ["gender"] },
      },
    }),
    prisma.tag.findMany({ select: { id: true, slug: true } }),
    prisma.variant.findMany({
      where: { sku: { in: designCodes } },
      select: { sku: true },
    }),
  ]);
  const context = {
    brandsBySlug: new Map(brands.map((brand) => [brand.slug, brand])),
    subcategoriesBySlug: new Map(
      subcategories.map((subcategory) => [
        subcategory.slug,
        {
          ...subcategory,
          genders: subcategory.products.map((product) => product.gender),
        },
      ]),
    ),
    tagsBySlug: new Map(tags.map((tag) => [tag.slug, tag])),
    existingDesignCodes: new Set(
      existingVariants.map((variant) => variant.sku),
    ),
  };

  const summary = {
    totalRows: dataRows.length,
    created: 0,
    failed: [],
    warnings: [],
  };
  const seenDesignCodes = new Set();
  for (const [index, row] of dataRows.entries()) {
    const rowNumber = index + 2;
    const values = Object.fromEntries(
      BULK_PRODUCT_CSV_COLUMNS.map((field, fieldIndex) => [
        field,
        row[fieldIndex],
      ]),
    );
    if (row.length !== BULK_PRODUCT_CSV_COLUMNS.length) {
      summary.failed.push({
        row: rowNumber,
        error: `Expected ${BULK_PRODUCT_CSV_COLUMNS.length} columns, received ${row.length}`,
      });
      continue;
    }

    const validated = await validateBulkProductRow(
      values,
      rowNumber,
      context,
      seenDesignCodes,
    );
    if (validated.error) {
      summary.failed.push({ row: rowNumber, error: validated.error });
      continue;
    }

    const tagSlugs = validated.values.tagSlugs
      ? [
          ...new Set(
            validated.values.tagSlugs
              .split(",")
              .map((slug) => slug.trim())
              .filter(Boolean),
          ),
        ]
      : [];
    const tagIds = [];
    for (const tagSlug of tagSlugs) {
      const tag = context.tagsBySlug.get(tagSlug);
      if (tag) {
        tagIds.push(tag.id);
      } else {
        summary.warnings.push({
          row: rowNumber,
          warning: `Tag slug "${tagSlug}" was not found and was skipped`,
        });
      }
    }

    try {
      await prisma.$transaction(async (transaction) => {
        const productId = crypto.randomUUID();
        await transaction.product.create({
          data: {
            id: productId,
            name: validated.values.name,
            description: validated.values.description,
            basePrice: validated.price,
            gender: validated.department.gender,
            categoryId: validated.department.categoryId,
            subcategory: validated.subcategory.name,
            subcategoryId: validated.subcategory.id,
            brandId: validated.brand.id,
            variants: {
              create: {
                id: crypto.randomUUID(),
                color: validated.values.color,
                size: validated.values.size,
                sku: validated.values.designCode,
                stock: validated.stock,
                images: [],
              },
            },
            tags: {
              create: tagIds.map((tagId) => ({ tagId })),
            },
          },
        });
      });
      summary.created += 1;
    } catch (error) {
      const reason =
        error?.code === "P2002"
          ? "designCode is already used by an existing product"
          : "could not create product";
      summary.failed.push({ row: rowNumber, error: reason });
    }
  }

  return jsonResponse(summary);
};

const serializeAdminProduct = (product) => ({
  id: product.id,
  name: product.name,
  gender: product.gender,
  description: product.description,
  basePrice: product.basePrice,
  discountPercent: product.discountPercent,
  imageUrl: product.imageUrl,
  isNew: product.isNew,
  archived: product.archived,
  brandId: product.brandId,
  brandName: product.brand?.name,
  categoryId: product.categoryId,
  categoryName: product.category?.name,
  subcategory: product.subcategory,
  subcategoryId: product.subcategoryId,
  subcategoryName: product.subcategoryRef?.name,
  variants: product.variants,
  tags: product.tags.map(({ tag }) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    filterTypeId: tag.filterTypeId,
    filterType: tag.filterType,
  })),
});

const getAdminProductInput = async (body, { partial = false } = {}) => {
  const fields = [
    "name",
    "gender",
    "description",
    "basePrice",
    "discountPercent",
    "imageUrl",
    "isNew",
    "archived",
    "brandId",
    "categoryId",
    "subcategoryId",
  ];
  const data = Object.fromEntries(
    fields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );

  if (!partial) {
    const required = [
      "name",
      "gender",
      "description",
      "basePrice",
      "brandId",
      "categoryId",
      "subcategoryId",
    ];
    const missing = required.filter(
      (field) =>
        body[field] === undefined || body[field] === null || body[field] === "",
    );
    if (missing.length) {
      return {
        error: `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`,
      };
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
  if (data.isNew !== undefined && typeof data.isNew !== "boolean") {
    return { error: "isNew must be a boolean" };
  }
  if (data.archived !== undefined && typeof data.archived !== "boolean") {
    return { error: "archived must be a boolean" };
  }
  if (data.archived !== undefined) {
    data.status = data.archived ? "ARCHIVED" : "ACTIVE";
  }

  if (data.subcategoryId !== undefined && data.subcategoryId !== null) {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: data.subcategoryId },
      select: { id: true, name: true, categoryId: true },
    });
    if (!subcategory) return { error: "subcategoryId was not found" };
    if (data.categoryId && data.categoryId !== subcategory.categoryId) {
      return { error: "subcategoryId must belong to categoryId" };
    }
    data.subcategory = subcategory.name;
  }

  return { data };
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
    data: { id: body.id || crypto.randomUUID(), ...input.data },
    include: adminProductInclude,
  });
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

    return updatedProduct;
  });
  return jsonResponse(serializeAdminProduct(product));
};

const deleteAdminProduct = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  await prisma.$transaction([
    prisma.productTag.deleteMany({ where: { productId: id } }),
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

  await prisma.variant.delete({ where: { id } });
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

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      total: orderTotal,
      discountId: discount?.id,
      discountAmount,
      firstOrderDiscountPercent,
      firstOrderDiscountAmount,
      firstOrderFreeShipping,
      shippingFee,
      shippingAmount: shippingFee,
      paystackReference: `pending-${crypto.randomUUID()}`,
      fullName: body.fullName.trim(),
      country: body.country.trim(),
      phone: body.phone.trim(),
      address: body.address.trim(),
      city: body.city.trim(),
      state: body.state.trim(),
      postalCode: body.postalCode.trim(),
      items: { create: orderItems },
    },
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
          amount: Math.round(orderTotal * 100),
          currency: "NGN",
          email: user.email,
          callback_url: `${new URL(request.url).origin}/checkout/complete`,
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
      await prisma.order.delete({ where: { id: order.id } });
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

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { paystackReference: paystackBody.data.reference },
    });
    if (!updatedOrder) {
      return jsonResponse({ error: "Unable to save payment reference" }, 500);
    }
    queueOrderEmail(order.id, "ORDER_CREATED");
    return jsonResponse({
      authorization_url: paystackBody.data.authorization_url,
      orderId: order.id,
    });
  } catch (error) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
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

const markOrderAsPaid = async (reference) => {
  let transitionedToPaid = false;
  const notificationsToProcess = [];
  const paidOrder = await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { paystackReference: reference },
      include: { items: true },
    });
    if (!order) {
      console.warn("Paystack payment order not found", reference);
      return null;
    }

    if (order.status === "PAID") return order;
    if (order.status !== "PENDING") return order;

    // Claim the order before changing stock so webhook retries and verification
    // requests cannot both finalize the same payment.
    const claimed = await claimOrderForPayment(transaction, order.id);
    if (!claimed) {
      return transaction.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });
    }
    transitionedToPaid = true;

    if (order.discountId) {
      await transaction.discount.update({
        where: { id: order.discountId },
        data: { usedCount: { increment: 1 } },
      });
    }

    if (
      order.firstOrderDiscountPercent !== null ||
      order.firstOrderFreeShipping
    ) {
      await transaction.user.updateMany({
        where: { id: order.userId, firstOrderPromoUsed: false },
        data: { firstOrderPromoUsed: true },
      });
    }

    for (const item of order.items) {
      const variant = await transaction.variant.findUnique({
        where: { id: item.variantId },
        select: {
          id: true,
          stock: true,
          product: { select: { name: true } },
        },
      });
      if (!variant) {
        console.error(
          "Serious warning: paid order references a missing variant",
          { orderId: order.id, variantId: item.variantId },
        );
        continue;
      }
      if (variant.stock < item.quantity) {
        console.error(
          "Serious warning: stock race caused paid order to go below zero",
          {
            orderId: order.id,
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

        if (wishlists.length > 0) {
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
    }

    return transaction.order.findUnique({
      where: { id: order.id },
      include: { items: true, user: { select: { email: true } } },
    });
  });

  if (transitionedToPaid && paidOrder) {
    // Fire and forget so order completion never depends on email providers.
    queueOrderEmail(paidOrder.id, "ORDER_PAID");
    void sendAdminOrderAlert(paidOrder).catch((error) => {
      console.error("Admin order alert failed", {
        orderId: paidOrder.id,
        error,
      });
    });
    void processOrderPaidNotificationsBestEffort(notificationsToProcess).catch(
      (error) => {
        console.error("Order notification batch failed", {
          orderId: paidOrder.id,
          error,
        });
      },
    );
  }
  return paidOrder;
};

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

  const order = await prisma.order.findFirst({
    where: { paystackReference: reference, userId: user.id },
    select: { id: true, status: true },
  });
  if (!order) return jsonResponse({ error: "Order not found" }, 404);

  if (order.status === "PAID") {
    return jsonResponse({ orderId: order.id, status: order.status });
  }

  if (order.status === "PENDING") {
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );
    const paystackBody = await paystackResponse.json().catch(() => null);
    if (!paystackResponse.ok || !paystackBody?.status || !paystackBody.data) {
      return jsonResponse(
        { error: paystackBody?.message || "Unable to verify payment" },
        502,
      );
    }

    if (paystackBody.data.status === "success") {
      const paidOrder = await markOrderAsPaid(reference);
      return jsonResponse({
        orderId: paidOrder?.id || order.id,
        status: paidOrder?.status || order.status,
        paystackStatus: paystackBody.data.status,
      });
    }

    return jsonResponse({
      orderId: order.id,
      status: order.status,
      paystackStatus: paystackBody.data.status,
    });
  }

  return jsonResponse({
    orderId: order.id,
    status: order.status,
  });
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
    },
  });
  if (!order) return jsonResponse({ error: "Order not found" }, 404);

  const [enrichedOrder] = await enrichOrderItems([order]);
  return jsonResponse({
    ...enrichedOrder,
    region: getRegionForState(enrichedOrder.state),
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
      createdAt: true,
      product: { select: wishlistProductSelect },
    },
  });
  return jsonResponse(wishlist);
};

const addToWishlist = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json();
  if (typeof body.productId !== "string" || !body.productId.trim()) {
    return jsonResponse({ error: "productId is required" }, 400);
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

  if (event.event !== "charge.success") return jsonResponse({ ok: true });

  const reference = event.data?.reference;
  if (typeof reference !== "string" || !reference) {
    return jsonResponse({ error: "Missing payment reference" }, 400);
  }

  await markOrderAsPaid(reference);

  // A webhook has no browser session, so it cannot identify which persisted
  // cart should be cleared after checkout.
  return jsonResponse({ ok: true });
};

const isVercelCronRequest = (request) => {
  if (request.method !== "GET" || !process.env.CRON_SECRET) return false;

  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`, "utf8");
  const actual = Buffer.from(request.headers.get("authorization") || "", "utf8");
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
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
    method: "POST",
    ...path("api", "admin", "upload-image"),
    handler: ({ request }) => uploadImage(request),
    errorMessage: "Image upload failed",
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
      if (request.method === "GET" && !segments[2]) return getCartItems(request);
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
      if (request.method === "GET" && !segments[2]) return listWishlist(request);
      if (request.method === "POST" && !segments[2])
        return addToWishlist(request);
      if (request.method === "DELETE" && segments[2])
        return removeFromWishlist(request, decodeURIComponent(segments[2]));
      return jsonResponse({ error: "Method not allowed" }, 405);
    },
    errorLog: "Wishlist request failed",
    errorMessage: "Wishlist request failed",
  },
  {
    ...prefix("api", "waitlist"),
    handler: ({ request, segments }) => handleWaitlistRequest(request, segments),
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
    ...prefix("api", "admin", "site-images"),
    handler: ({ request, segments }) => {
      const key = segments[3] ? decodeURIComponent(segments[3]) : null;
      if (request.method === "PUT" && key)
        return updateAdminSiteImage(request, key);
      return jsonResponse({ error: "Method not allowed" }, 405);
    },
    errorMessage: "Site image update failed",
  },
  {
    method: "GET",
    ...path("api", "site-images"),
    handler: () => listSiteImages(),
    errorMessage: "Site images request failed",
  },
  {
    ...prefix("api", "admin", "discounts"),
    handler: ({ request, segments }) => handleAdminDiscountRequest(request, segments),
    errorMessage: "Discount request failed",
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
    handler: ({ request, segments }) => handleAdminBrandRequest(request, segments),
    errorMessage: "Brand request failed",
  },
  {
    ...prefix("api", "admin", "subcategories"),
    handler: ({ request, segments }) =>
      handleAdminSubcategoryRequest(request, segments),
    errorMessage: "Subcategory request failed",
  },
  {
    ...path("api", "admin", "categories", ":categoryId", "filter-types"),
    handler: ({ request, segments }) =>
      handleAdminCategoryFilterTypeRequest(request, segments),
    errorMessage: "Category filter type request failed",
  },
  {
    ...prefix("api", "admin", "filter-types"),
    handler: ({ request, segments }) =>
      handleAdminFilterTypeRequest(request, segments),
    errorMessage: "Filter type request failed",
  },
  {
    ...prefix("api", "admin", "tags"),
    handler: ({ request, segments }) => handleAdminTagRequest(request, segments),
    errorMessage: "Tag request failed",
  },
  {
    ...prefix("api", "admin", "sections"),
    handler: ({ request, segments }) => handleAdminSectionRequest(request, segments),
    errorMessage: "Section request failed",
  },
  {
    ...prefix("api", "admin", "journal"),
    handler: ({ request, segments }) => handleAdminJournalRequest(request, segments),
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
    handler: ({ request, segments }) => handleAdminProductRequest(request, segments),
    errorMessage: "Product request failed",
  },
  {
    ...prefix("api", "admin", "variants"),
    handler: ({ request, segments }) => handleAdminVariantRequest(request, segments),
    errorMessage: "Variant request failed",
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
    ...path("api", "sections", "homepage"),
    handler: () => listHomepageSections(),
  },
  {
    method: "GET",
    ...path("api", "sections", ":slug"),
    handler: ({ params }) => getPublicSection(params.slug),
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
      return await route.handler({ request, url, segments, params });
    } catch (error) {
      console.error(route.errorLog || route.errorMessage, error);
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
