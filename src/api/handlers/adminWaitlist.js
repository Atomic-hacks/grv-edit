import { prisma } from "../../server/prisma.js";
import { requireAdmin } from "../../server/requireAdmin.js";
import { recordAdminAction } from "../../server/auditLog.js";

const jsonResponse = (body, status = 200) => Response.json(body, { status });
const statuses = new Set(["WAITING", "NOTIFIED", "FULFILLED"]);

const parsePage = (value) =>
  Math.max(1, Math.min(100000, Number.parseInt(value, 10) || 1));

const waitlistMessageSuffix = (entry) =>
  ` (${entry.variant.color}, ${entry.variant.size}) is back in stock!`;

export const listAdminWaitlist = async (request, url) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const page = parsePage(url.searchParams.get("page"));
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const requestedStatus = (url.searchParams.get("status") || "ALL").toUpperCase();
  if (requestedStatus !== "ALL" && !statuses.has(requestedStatus)) {
    return jsonResponse({ error: "Invalid waitlist status" }, 400);
  }

  const where = {
    ...(requestedStatus === "ALL" ? {} : { status: requestedStatus }),
    ...(query
      ? {
          OR: [
            { user: { email: { contains: query, mode: "insensitive" } } },
            { user: { name: { contains: query, mode: "insensitive" } } },
            { variant: { sku: { contains: query, mode: "insensitive" } } },
            {
              variant: {
                product: { name: { contains: query, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };

  const [entries, total, groupedStatuses, queuedEmails, eligibleWaiting] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
      select: {
        id: true,
        userId: true,
        variantId: true,
        status: true,
        deliveryStatus: true,
        deliveryAttempts: true,
        lastDeliveryError: true,
        providerMessageId: true,
        notifiedAt: true,
        fulfilledAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, active: true } },
        variant: {
          select: {
            color: true,
            size: true,
            sku: true,
            stock: true,
            productId: true,
            product: { select: { name: true, archived: true } },
          },
        },
      },
    }),
    prisma.waitlistEntry.count({ where }),
    prisma.waitlistEntry.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.notification.count({
      where: { type: "WAITLIST_RESTOCK", sent: false },
    }),
    prisma.waitlistEntry.count({
      where: { status: "WAITING", variant: { stock: { gt: 0 } } },
    }),
  ]);

  const notificationPairs = entries.length
    ? await prisma.notification.findMany({
        where: {
          type: "WAITLIST_RESTOCK",
          OR: entries.map((entry) => ({
            userId: entry.userId,
            productId: entry.variant.productId,
            message: { endsWith: waitlistMessageSuffix(entry) },
          })),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          productId: true,
          message: true,
          sent: true,
          createdAt: true,
        },
      })
    : [];

  const latestNotification = new Map();
  for (const notification of notificationPairs) {
    const entry = entries.find(
      (candidate) =>
        candidate.userId === notification.userId &&
        candidate.variant.productId === notification.productId &&
        notification.message.endsWith(waitlistMessageSuffix(candidate)),
    );
    if (!entry) continue;
    const key = `${entry.userId}:${entry.variantId}`;
    if (!latestNotification.has(key)) latestNotification.set(key, notification);
  }

  const counts = { WAITING: 0, NOTIFIED: 0, FULFILLED: 0 };
  for (const row of groupedStatuses) counts[row.status] = row._count._all;

  return jsonResponse({
    page,
    pageSize: 50,
    total,
    counts,
    queuedEmails,
    eligibleWaiting,
    entries: entries.map((entry) => {
      const notification = latestNotification.get(`${entry.userId}:${entry.variantId}`);
      return {
        id: entry.id,
        variantId: entry.variantId,
        status: entry.status,
        deliveryStatus: entry.deliveryStatus,
        deliveryAttempts: entry.deliveryAttempts,
        lastDeliveryError: entry.lastDeliveryError,
        providerMessageId: entry.providerMessageId,
        notifiedAt: entry.notifiedAt,
        fulfilledAt: entry.fulfilledAt,
        createdAt: entry.createdAt,
        customer: entry.user,
        variant: {
          color: entry.variant.color,
          size: entry.variant.size,
          sku: entry.variant.sku,
          stock: entry.variant.stock,
          productId: entry.variant.productId,
          productName: entry.variant.product.name,
          productArchived: entry.variant.product.archived,
        },
        delivery: notification
          ? {
              notificationId: notification.id,
              state: notification.sent ? "SENT" : "QUEUED",
              createdAt: notification.createdAt,
            }
          : null,
      };
    }),
  });
};

export const removeAdminWaitlistEntry = async (request, id) => {
  const guard = await requireAdmin(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  return prisma.$transaction(async (transaction) => {
    const entry = await transaction.waitlistEntry.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        variantId: true,
        status: true,
        variant: {
          select: {
            color: true,
            size: true,
            productId: true,
            product: { select: { name: true } },
          },
        },
      },
    });
    if (!entry) return jsonResponse({ error: "Waitlist entry not found" }, 404);

    const cancelled = await transaction.notification.deleteMany({
      where: {
        userId: entry.userId,
        productId: entry.variant.productId,
        type: "WAITLIST_RESTOCK",
        message: { endsWith: waitlistMessageSuffix(entry) },
        sent: false,
      },
    });
    await transaction.waitlistEntry.delete({ where: { id } });
    await recordAdminAction(
      {
        actorId: guard.user.id,
        action: "waitlist.entry_removed",
        entityType: "WaitlistEntry",
        entityId: id,
        previousState: {
          userId: entry.userId,
          variantId: entry.variantId,
          status: entry.status,
        },
        newState: { cancelledQueuedEmails: cancelled.count },
      },
      { prisma: transaction, required: true },
    );
    return jsonResponse({ success: true, cancelledQueuedEmails: cancelled.count });
  });
};

export const handleAdminWaitlistRequest = async (request, segments, url) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminWaitlist(request, url);
  if (request.method === "DELETE" && id)
    return removeAdminWaitlistEntry(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};
