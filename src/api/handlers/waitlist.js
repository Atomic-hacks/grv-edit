import { checkRateLimit } from "../../server/rateLimit.js";
import { prisma } from "../../server/prisma.js";
import { getCurrentUser } from "../../server/getCurrentUser.js";

const jsonResponse = (body, status = 200) => Response.json(body, { status });

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

  const limit = await checkRateLimit(`waitlist:${user.id}`, { max: 10 });
  if (!limit.allowed) return Response.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (typeof body?.variantId !== "string" || !body.variantId.trim()) {
    return jsonResponse({ error: "variantId is required" }, 400);
  }

  const variant = await prisma.variant.findUnique({
    where: { id: body.variantId },
    select: { id: true, stock: true },
  });
  if (!variant) return jsonResponse({ error: "Variant not found" }, 404);

  if (variant.stock > 0) {
    return jsonResponse({ error: "This variant is already in stock. Refresh the product to purchase it." }, 409);
  }

  const existing = await prisma.waitlistEntry.findUnique({
    where: {
      userId_variantId: { userId: user.id, variantId: variant.id },
    },
    select: waitlistEntrySelect,
  });
  if (existing?.status === "WAITING") {
    return jsonResponse({ success: true, entry: existing });
  }

  let entry;
  try {
    entry = await prisma.waitlistEntry.upsert({
      where: {
        userId_variantId: { userId: user.id, variantId: variant.id },
      },
      create: { userId: user.id, variantId: variant.id },
      update: {
        status: "WAITING",
        deliveryStatus: "NOT_QUEUED",
        deliveryAttempts: 0,
        lastDeliveryError: null,
        providerMessageId: null,
        notifiedAt: null,
        fulfilledAt: null,
      },
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

export const handleWaitlistRequest = async (request, segments) => {
  const id = segments[2] ? decodeURIComponent(segments[2]) : null;
  if (request.method === "GET" && !id) return listWaitlist(request);
  if (request.method === "POST" && !id) return addToWaitlist(request);
  if (request.method === "DELETE" && id) return removeFromWaitlist(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

