// Customer + admin handlers for the Refunds & Complaints ("support case")
// system. Kept in its own module (rather than growing the already very
// large src/api/routes.js) since this is a self-contained feature with its
// own state machine; routes.js only wires these into the route table.
import { prisma } from "../../server/prisma.js";
import { getCurrentUser } from "../../server/getCurrentUser.js";
import { requireRole } from "../../server/requireRole.js";
import { sendEmail } from "../../server/sendEmail.js";
import { FROM_SUPPORT } from "../../server/emailSenders.js";
import { checkRateLimit } from "../../server/rateLimit.js";
import { recordAdminAction } from "../../server/auditLog.js";
import { runInBackground } from "../../server/background.js";
import {
  generateCaseReference,
  buildCaseDedupeKey,
} from "../../server/caseReference.js";
import {
  caseAcknowledgementEmail,
  caseStatusUpdateEmail,
} from "../../server/caseEmailTemplates.js";
import {
  initiatePaystackRefund,
  verifyPaystackTransaction,
} from "../../server/paystackRefund.js";
import { v2 as cloudinary } from "cloudinary";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const CASE_ISSUE_TYPES = [
  "REFUND_REQUEST",
  "WRONG_ITEM",
  "MISSING_ITEM",
  "DAMAGED_ITEM",
  "ITEM_NOT_AS_DESCRIBED",
  "PACKAGE_NOT_RECEIVED",
  "DELIVERY_ISSUE",
  "PAYMENT_ISSUE",
  "OTHER",
];

const CASE_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CUSTOMER_INFO",
  "APPROVED",
  "REJECTED",
  "REFUND_PROCESSING",
  "REFUNDED",
  "REFUND_FAILED",
  "RESOLVED",
  "CLOSED",
];

// Statuses that must only ever be reached through the Paystack refund flow
// below, never by an admin directly setting a status.
const REFUND_EXECUTION_ONLY_STATUSES = new Set([
  "REFUND_PROCESSING",
  "REFUNDED",
  "REFUND_FAILED",
]);

const cloudinaryReady = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

const categoryForIssueType = (issueType) =>
  issueType === "REFUND_REQUEST" ? "REFUND" : "COMPLAINT";

const caseSummarySelect = {
  id: true,
  reference: true,
  userId: true,
  customerEmail: true,
  orderId: true,
  issueType: true,
  category: true,
  description: true,
  requestedRefundAmount: true,
  status: true,
  evidenceUrls: true,
  refundReference: true,
  refundedAmount: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
};

// --- Customer-facing --------------------------------------------------

export const createSupportCase = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const limit = await checkRateLimit(`support-case:${user.id}`, {
    max: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonResponse(
      {
        error:
          "Too many requests submitted. Please wait before submitting another.",
      },
      429,
    );
  }

  const body = await request.json().catch(() => ({}));
  const issueType =
    typeof body.issueType === "string" ? body.issueType.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const orderId =
    typeof body.orderId === "string" && body.orderId.trim()
      ? body.orderId.trim()
      : null;
  const orderItemIds = Array.isArray(body.orderItemIds)
    ? body.orderItemIds.filter((id) => typeof id === "string")
    : [];
  const evidenceUrls = Array.isArray(body.evidenceUrls)
    ? body.evidenceUrls
        .filter((url) => typeof url === "string" && /^https:\/\//.test(url))
        .slice(0, 6)
    : [];

  if (!CASE_ISSUE_TYPES.includes(issueType)) {
    return jsonResponse({ error: "A valid issue type is required" }, 400);
  }
  if (!description || description.length < 10) {
    return jsonResponse(
      { error: "Please describe the issue in at least 10 characters" },
      400,
    );
  }
  if (description.length > 4000) {
    return jsonResponse({ error: "Description is too long" }, 400);
  }

  const category = categoryForIssueType(issueType);
  let order = null;
  if (orderId) {
    order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      select: { id: true, total: true, paystackReference: true, status: true },
    });
    if (!order) {
      return jsonResponse({ error: "Order not found" }, 404);
    }
  }
  if (category === "REFUND" && !order) {
    return jsonResponse(
      { error: "Select the order this refund request relates to" },
      400,
    );
  }

  let requestedRefundAmount = null;
  if (
    body.requestedRefundAmount !== undefined &&
    body.requestedRefundAmount !== null &&
    body.requestedRefundAmount !== ""
  ) {
    requestedRefundAmount = Number(body.requestedRefundAmount);
    if (!Number.isFinite(requestedRefundAmount) || requestedRefundAmount <= 0) {
      return jsonResponse(
        { error: "Requested refund amount must be a positive number" },
        400,
      );
    }
    if (order && requestedRefundAmount > order.total) {
      return jsonResponse(
        { error: "Requested refund amount cannot exceed the order total" },
        400,
      );
    }
  }

  const dedupeKey = buildCaseDedupeKey({
    userId: user.id,
    orderId,
    issueType,
    description,
  });

  let supportCase;
  try {
    supportCase = await prisma.$transaction(async (transaction) => {
      const created = await transaction.supportCase.create({
        data: {
          reference: generateCaseReference(),
          userId: user.id,
          customerEmail: user.email,
          orderId: order?.id,
          orderItemIds,
          paystackReference: order?.paystackReference?.startsWith("pending-")
            ? null
            : order?.paystackReference,
          issueType,
          category,
          description,
          requestedRefundAmount,
          evidenceUrls,
          dedupeKey,
        },
        select: caseSummarySelect,
      });
      await transaction.caseEvent.create({
        data: { caseId: created.id, toStatus: "SUBMITTED", actorId: user.id },
      });
      return created;
    });
  } catch (error) {
    if (error?.code === "P2002") {
      // Same fingerprint already exists — this is a duplicate submission
      // (double-click, retry), not a new case. Return the existing one so
      // the customer still gets their reference number.
      const existing = await prisma.supportCase.findUnique({
        where: { dedupeKey },
        select: caseSummarySelect,
      });
      if (existing) {
        return jsonResponse({ case: existing, duplicate: true });
      }
    }
    throw error;
  }

  runInBackground(sendEmail({
    to: user.email,
    subject: `We've received your request — ${supportCase.reference}`,
    html: caseAcknowledgementEmail({
      reference: supportCase.reference,
      orderId: supportCase.orderId,
      issueType: supportCase.issueType,
      submittedAt: new Intl.DateTimeFormat("en", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(supportCase.createdAt),
    }),
    from: FROM_SUPPORT,
  }).catch((error) => {
    console.error("Case acknowledgement email failed", {
      caseId: supportCase.id,
      error,
    });
  }));

  return jsonResponse({ case: supportCase, duplicate: false }, 201);
};

export const listMyCases = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const cases = await prisma.supportCase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: caseSummarySelect,
  });
  return jsonResponse(cases);
};

export const getMyCase = async (request, id) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, userId: user.id },
    select: caseSummarySelect,
  });
  if (!supportCase) return jsonResponse({ error: "Case not found" }, 404);
  return jsonResponse(supportCase);
};

// Reuses the same Cloudinary credentials as the admin image upload, in a
// separate folder and behind a per-user rate limit — any signed-in customer
// may call this, not just admins, so it needs its own throttle.
export const uploadCaseEvidence = async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const limit = await checkRateLimit(`case-evidence:${user.id}`, {
    max: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonResponse(
      { error: "Too many uploads. Please wait and try again." },
      429,
    );
  }

  if (!cloudinaryReady) {
    return jsonResponse({ error: "Image upload is not configured" }, 500);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return jsonResponse({ error: "A file field is required" }, 400);
    }
    if (!file.type?.startsWith("image/")) {
      return jsonResponse({ error: "The file must be an image" }, 400);
    }
    if (file.size > 8 * 1024 * 1024) {
      return jsonResponse({ error: "Image must be smaller than 8MB" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "grv/cases", resource_type: "image" },
        (error, uploadResult) =>
          error ? reject(error) : resolve(uploadResult),
      );
      uploadStream.end(buffer);
    });
    if (!result?.secure_url) {
      return jsonResponse({ error: "Image upload returned no URL" }, 502);
    }
    return jsonResponse({ url: result.secure_url });
  } catch (error) {
    console.error("Case evidence upload failed", error);
    return jsonResponse({ error: "Image upload failed" }, 502);
  }
};

export const handleCaseRequest = async (request, segments) => {
  const id = segments[2] ? decodeURIComponent(segments[2]) : null;
  if (request.method === "GET" && !id) return listMyCases(request);
  if (request.method === "GET" && id) return getMyCase(request, id);
  if (request.method === "POST" && !id) return createSupportCase(request);
  if (request.method === "POST" && id === "upload-evidence") {
    return uploadCaseEvidence(request);
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
};

// --- Admin-facing -------------------------------------------------------

const adminCaseListSelect = {
  id: true,
  reference: true,
  userId: true,
  customerEmail: true,
  orderId: true,
  issueType: true,
  category: true,
  description: true,
  requestedRefundAmount: true,
  status: true,
  refundReference: true,
  refundedAmount: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  order: {
    select: {
      id: true,
      total: true,
      createdAt: true,
      paystackReference: true,
      status: true,
    },
  },
  _count: { select: { notes: true } },
};

export const listAdminCases = async (request, url) => {
  const guard = await requireRole(request, ["ADMIN", "SUPPORT"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const query = (url.searchParams.get("q") || "").trim();

  if (category && !["REFUND", "COMPLAINT"].includes(category)) {
    return jsonResponse({ error: "Invalid category filter" }, 400);
  }
  if (status && !CASE_STATUSES.includes(status)) {
    return jsonResponse({ error: "Invalid status filter" }, 400);
  }

  const where = {};
  if (category) where.category = category;
  if (status) where.status = status;
  if (query) {
    where.OR = [
      { reference: { contains: query, mode: "insensitive" } },
      { customerEmail: { contains: query, mode: "insensitive" } },
      { orderId: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ];
  }

  const cases = await prisma.supportCase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: adminCaseListSelect,
  });
  return jsonResponse(cases);
};

export const getAdminCase = async (request, id) => {
  const guard = await requireRole(request, ["ADMIN", "SUPPORT"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const supportCase = await prisma.supportCase.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
      order: {
        select: {
          id: true,
          total: true,
          shippingFee: true,
          status: true,
          paystackReference: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              variantId: true,
              quantity: true,
              priceAtPurchase: true,
            },
          },
        },
      },
      notes: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!supportCase) return jsonResponse({ error: "Case not found" }, 404);

  let orderItems = supportCase.order?.items || [];
  if (orderItems.length) {
    const productIds = [...new Set(orderItems.map((item) => item.productId))];
    const variantIds = [...new Set(orderItems.map((item) => item.variantId))];
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
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const variantById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );
    orderItems = orderItems.map((item) => {
      const product = productById.get(item.productId);
      const variant = variantById.get(item.variantId);
      return {
        ...item,
        productName: product?.name || "Unavailable product",
        brandName: product?.brand?.name || null,
        image: variant?.images?.[0] || product?.imageUrl || null,
        variant: variant || null,
      };
    });
  }

  let paystackTransaction = null;
  if (supportCase.paystackReference) {
    paystackTransaction = await verifyPaystackTransaction(
      supportCase.paystackReference,
    );
  }

  return jsonResponse({
    ...supportCase,
    order: supportCase.order
      ? { ...supportCase.order, items: orderItems }
      : null,
    paystackTransaction: paystackTransaction
      ? {
          amount: paystackTransaction.amount,
          currency: paystackTransaction.currency,
          status: paystackTransaction.status,
          paidAt: paystackTransaction.paid_at,
          channel: paystackTransaction.channel,
          gatewayResponse: paystackTransaction.gateway_response,
        }
      : null,
  });
};

export const addCaseNote = async (request, id) => {
  const guard = await requireRole(request, ["ADMIN", "SUPPORT"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) return jsonResponse({ error: "note is required" }, 400);

  const supportCase = await prisma.supportCase.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!supportCase) return jsonResponse({ error: "Case not found" }, 404);

  const created = await prisma.caseNote.create({
    data: { caseId: id, authorId: guard.user.id, note },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  await recordAdminAction({
    actorId: guard.user.id,
    action: "case.note_added",
    entityType: "SupportCase",
    entityId: id,
  });
  return jsonResponse(created, 201);
};

// Ordinary status transitions — everything except moving money. Refund
// execution states are rejected here and must go through initiateCaseRefund
// below, so an admin can never "mark refunded" by simply picking a status.
export const updateCaseStatus = async (request, id) => {
  const guard = await requireRole(request, ["ADMIN", "SUPPORT"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === "string" ? body.status : "";
  const note = typeof body.note === "string" ? body.note.trim() : null;
  const approvedAmount =
    body.approvedAmount !== undefined &&
    body.approvedAmount !== null &&
    body.approvedAmount !== ""
      ? Number(body.approvedAmount)
      : undefined;

  if (
    !CASE_STATUSES.includes(status) ||
    REFUND_EXECUTION_ONLY_STATUSES.has(status)
  ) {
    return jsonResponse(
      {
        error:
          "Invalid status. Use the refund endpoint to move a refund into processing.",
      },
      400,
    );
  }
  if (
    approvedAmount !== undefined &&
    (!Number.isFinite(approvedAmount) || approvedAmount <= 0)
  ) {
    return jsonResponse(
      { error: "approvedAmount must be a positive number" },
      400,
    );
  }

  const existing = await prisma.supportCase.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      category: true,
      order: { select: { total: true } },
    },
  });
  if (!existing) return jsonResponse({ error: "Case not found" }, 404);
  if (
    approvedAmount !== undefined &&
    existing.order &&
    approvedAmount > existing.order.total
  ) {
    return jsonResponse(
      { error: "approvedAmount cannot exceed the order total" },
      400,
    );
  }

  const data = { status };
  if (status === "APPROVED" && approvedAmount !== undefined) {
    data.requestedRefundAmount = approvedAmount;
  }

  const [updated] = await prisma.$transaction([
    prisma.supportCase.update({
      where: { id },
      data,
      select: caseSummarySelect,
    }),
    prisma.caseEvent.create({
      data: {
        caseId: id,
        fromStatus: existing.status,
        toStatus: status,
        actorId: guard.user.id,
        note,
      },
    }),
  ]);

  await recordAdminAction({
    actorId: guard.user.id,
    action: "case.status_changed",
    entityType: "SupportCase",
    entityId: id,
    previousState: { status: existing.status },
    newState: { status },
  });

  if (updated.customerEmail) {
    runInBackground(sendEmail({
      to: updated.customerEmail,
      subject: `Update on your request — ${updated.reference}`,
      html: caseStatusUpdateEmail({
        reference: updated.reference,
        status,
        note,
      }),
      from: FROM_SUPPORT,
    }).catch((error) => {
      console.error("Case status update email failed", { caseId: id, error });
    }));
  }

  return jsonResponse(updated);
};

// Bulk status changes are restricted to safe, reversible transitions — no
// bulk approvals/refunds, ever (each refund still requires initiateCaseRefund
// individually).
const BULK_SAFE_STATUSES = new Set([
  "UNDER_REVIEW",
  "AWAITING_CUSTOMER_INFO",
  "REJECTED",
  "RESOLVED",
  "CLOSED",
]);

export const bulkUpdateCaseStatus = async (request) => {
  const guard = await requireRole(request, ["ADMIN", "SUPPORT"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => typeof id === "string")
    : [];
  const status = typeof body.status === "string" ? body.status : "";
  if (!ids.length)
    return jsonResponse({ error: "ids must be a non-empty array" }, 400);
  if (!BULK_SAFE_STATUSES.has(status)) {
    return jsonResponse(
      { error: "This status cannot be applied in bulk" },
      400,
    );
  }

  const result = await prisma.supportCase.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });
  await prisma.caseEvent.createMany({
    data: ids.map((caseId) => ({
      caseId,
      toStatus: status,
      actorId: guard.user.id,
      note: "Bulk update",
    })),
  });
  await recordAdminAction({
    actorId: guard.user.id,
    action: "case.bulk_status_changed",
    entityType: "SupportCase",
    entityId: ids.join(","),
    newState: { status, count: result.count },
  });
  return jsonResponse({ updated: result.count });
};

// Financial action — restricted to ADMIN (OWNER always allowed via
// requireRole). A case must be in APPROVED status first (a deliberate,
// individually-reviewed decision), and the update is claimed atomically so
// two concurrent clicks cannot both trigger a Paystack refund call.
export const initiateCaseRefund = async (request, id) => {
  const guard = await requireRole(request, ["ADMIN"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const overrideAmount =
    body.amount !== undefined && body.amount !== null && body.amount !== ""
      ? Number(body.amount)
      : undefined;
  if (
    overrideAmount !== undefined &&
    (!Number.isFinite(overrideAmount) || overrideAmount <= 0)
  ) {
    return jsonResponse({ error: "amount must be a positive number" }, 400);
  }

  const supportCase = await prisma.supportCase.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          total: true,
          paystackReference: true,
          status: true,
        },
      },
    },
  });
  if (!supportCase) return jsonResponse({ error: "Case not found" }, 404);
  if (supportCase.category !== "REFUND") {
    return jsonResponse({ error: "This case is not a refund request" }, 400);
  }
  if (supportCase.status !== "APPROVED") {
    return jsonResponse(
      { error: "The refund must be approved before it can be processed" },
      409,
    );
  }
  if (
    !supportCase.order?.paystackReference ||
    supportCase.order.paystackReference.startsWith("pending-")
  ) {
    return jsonResponse(
      { error: "This order has no completed Paystack transaction to refund" },
      409,
    );
  }

  const amount =
    overrideAmount ??
    supportCase.requestedRefundAmount ??
    supportCase.order.total;
  if (amount > supportCase.order.total) {
    return jsonResponse(
      { error: "Refund amount cannot exceed the order total" },
      400,
    );
  }

  // Claim the case before calling Paystack: only one request can move it out
  // of APPROVED, so a double-click (or a retry) cannot trigger two refunds.
  const claim = await prisma.supportCase.updateMany({
    where: { id, status: "APPROVED" },
    data: { status: "REFUND_PROCESSING" },
  });
  if (claim.count === 0) {
    return jsonResponse(
      { error: "This refund is already being processed" },
      409,
    );
  }

  const refundResult = await initiatePaystackRefund({
    transactionReference: supportCase.order.paystackReference,
    amountKobo: Math.round(amount * 100),
    reason: supportCase.description,
  });

  if (!refundResult.ok) {
    // Paystack didn't even accept the request — revert to APPROVED so the
    // admin can see the error and retry, rather than getting stuck in
    // REFUND_PROCESSING with nothing actually happening.
    await prisma.$transaction([
      prisma.supportCase.update({
        where: { id },
        data: { status: "APPROVED" },
      }),
      prisma.caseEvent.create({
        data: {
          caseId: id,
          fromStatus: "REFUND_PROCESSING",
          toStatus: "APPROVED",
          actorId: guard.user.id,
          note: `Paystack refund request failed: ${refundResult.error}`,
        },
      }),
    ]);
    return jsonResponse({ error: refundResult.error }, 502);
  }

  const [updated] = await prisma.$transaction([
    prisma.supportCase.update({
      where: { id },
      data: {
        refundReference: refundResult.refundReference,
        requestedRefundAmount: amount,
      },
      select: caseSummarySelect,
    }),
    prisma.caseEvent.create({
      data: {
        caseId: id,
        fromStatus: "APPROVED",
        toStatus: "REFUND_PROCESSING",
        actorId: guard.user.id,
        note: `Refund of ${amount} submitted to Paystack (ref ${refundResult.refundReference})`,
      },
    }),
  ]);

  await recordAdminAction({
    actorId: guard.user.id,
    action: "case.refund_initiated",
    entityType: "SupportCase",
    entityId: id,
    newState: { amount, refundReference: refundResult.refundReference },
  });

  return jsonResponse(updated);
};

// Called from the Paystack webhook handler in routes.js when a
// `refund.processed` or `refund.failed` event arrives. Refund completion is
// only ever recorded from Paystack's own event, never from an admin click.
export const applyPaystackRefundEvent = async (event) => {
  const refundReference = String(
    event.data?.id ?? event.data?.refund?.id ?? "",
  );
  const transactionReference = String(
    event.data?.transaction_reference ??
      event.data?.transaction?.reference ??
      "",
  );
  if (!refundReference && !transactionReference) return;

  const supportCase = await prisma.supportCase.findFirst({
    where: refundReference
      ? { refundReference }
      : {
          paystackReference: transactionReference,
          status: "REFUND_PROCESSING",
        },
  });
  if (!supportCase) return;

  const succeeded = event.event === "refund.processed";
  const toStatus = succeeded ? "REFUNDED" : "REFUND_FAILED";
  if (supportCase.status === toStatus) return; // already applied — webhook retry

  const amount = event.data?.amount
    ? event.data.amount / 100
    : supportCase.requestedRefundAmount;

  await prisma.$transaction([
    prisma.supportCase.update({
      where: { id: supportCase.id },
      data: succeeded
        ? { status: "REFUNDED", refundedAmount: amount, refundedAt: new Date() }
        : { status: "REFUND_FAILED" },
    }),
    prisma.caseEvent.create({
      data: {
        caseId: supportCase.id,
        fromStatus: supportCase.status,
        toStatus,
        note: succeeded
          ? "Paystack confirmed the refund"
          : "Paystack reported the refund failed",
      },
    }),
  ]);

  runInBackground(sendEmail({
    to: supportCase.customerEmail,
    subject: `Update on your request — ${supportCase.reference}`,
    html: caseStatusUpdateEmail({
      reference: supportCase.reference,
      status: toStatus,
      note: succeeded
        ? "Your refund has been completed by our payment provider."
        : "Your refund could not be completed automatically. Our team has been notified and will follow up.",
    }),
    from: FROM_SUPPORT,
  }).catch((error) => {
    console.error("Refund outcome email failed", {
      caseId: supportCase.id,
      error,
    });
  }));
};

export const handleAdminCaseRequest = async (request, segments, url) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  const action = segments[4] || null;

  if (request.method === "GET" && !id) return listAdminCases(request, url);
  if (request.method === "GET" && id) return getAdminCase(request, id);
  if (request.method === "PUT" && id === "bulk-status")
    return bulkUpdateCaseStatus(request);
  if (request.method === "POST" && id && action === "notes")
    return addCaseNote(request, id);
  if (request.method === "PUT" && id && action === "status")
    return updateCaseStatus(request, id);
  if (request.method === "POST" && id && action === "refund")
    return initiateCaseRefund(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

export { CASE_STATUSES };
