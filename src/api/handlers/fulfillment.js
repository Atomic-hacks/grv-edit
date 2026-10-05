// Manual (pre-courier-API) order fulfilment tracking. Deliberately a thin
// status + free-text courier fields, not a fake integration — see
// FulfillmentStatus in schema.prisma for the lifecycle this drives.
import { prisma } from "../../server/prisma.js";
import { requireRole } from "../../server/requireRole.js";
import { recordAdminAction } from "../../server/auditLog.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const FULFILLMENT_STATUSES = [
  "PLACED",
  "PAYMENT_CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "CANCELLED",
  "RETURNED",
];

export const updateOrderFulfillment = async (request, id) => {
  const guard = await requireRole(request, ["ADMIN", "FULFILMENT"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const data = {};
  let statusChanged = false;

  if (body.fulfillmentStatus !== undefined) {
    if (!FULFILLMENT_STATUSES.includes(body.fulfillmentStatus)) {
      return jsonResponse({ error: "Invalid fulfillmentStatus" }, 400);
    }
    data.fulfillmentStatus = body.fulfillmentStatus;
    statusChanged = true;
  }
  for (const field of [
    "courierName",
    "trackingNumber",
    "trackingUrl",
    "deliveryNotes",
  ]) {
    if (body[field] !== undefined) {
      if (body[field] !== null && typeof body[field] !== "string") {
        return jsonResponse({ error: `${field} must be a string` }, 400);
      }
      data[field] = body[field]?.trim() || null;
    }
  }
  for (const field of ["shippingDate", "estimatedDeliveryDate"]) {
    if (body[field] !== undefined) {
      if (body[field] === null) {
        data[field] = null;
        continue;
      }
      const date = new Date(body[field]);
      if (Number.isNaN(date.getTime())) {
        return jsonResponse({ error: `${field} must be a valid date` }, 400);
      }
      data[field] = date;
    }
  }
  if (Object.keys(data).length === 0) {
    return jsonResponse(
      { error: "At least one fulfilment field is required" },
      400,
    );
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true, fulfillmentStatus: true },
  });
  if (!order) return jsonResponse({ error: "Order not found" }, 404);
  if (["CANCELLED", "FAILED"].includes(order.status)) {
    return jsonResponse(
      {
        error: `Cannot update fulfilment on a ${order.status.toLowerCase()} order`,
      },
      409,
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.order.update({ where: { id }, data }),
    ...(statusChanged
      ? [
          prisma.orderFulfillmentEvent.create({
            data: {
              orderId: id,
              status: data.fulfillmentStatus,
              note:
                typeof body.note === "string" ? body.note.trim() || null : null,
            },
          }),
        ]
      : []),
  ]);

  await recordAdminAction({
    actorId: guard.user.id,
    action: "order.fulfillment_updated",
    entityType: "Order",
    entityId: id,
    previousState: { fulfillmentStatus: order.fulfillmentStatus },
    newState: data,
  });

  const events = await prisma.orderFulfillmentEvent.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
  });

  return jsonResponse({ ...updated, fulfillmentEvents: events });
};

export const bulkUpdateOrderFulfillment = async (request) => {
  const guard = await requireRole(request, ["ADMIN", "FULFILMENT"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => typeof id === "string")
    : [];
  const status = body.fulfillmentStatus;
  if (!ids.length)
    return jsonResponse({ error: "ids must be a non-empty array" }, 400);
  if (!FULFILLMENT_STATUSES.includes(status)) {
    return jsonResponse({ error: "Invalid fulfillmentStatus" }, 400);
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, status: { notIn: ["CANCELLED", "FAILED"] } },
    select: { id: true },
  });
  const validIds = orders.map((order) => order.id);

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: { in: validIds } },
      data: { fulfillmentStatus: status },
    }),
    prisma.orderFulfillmentEvent.createMany({
      data: validIds.map((orderId) => ({
        orderId,
        status,
        note: "Bulk update",
      })),
    }),
  ]);

  await recordAdminAction({
    actorId: guard.user.id,
    action: "order.bulk_fulfillment_updated",
    entityType: "Order",
    entityId: validIds.join(","),
    newState: { status, count: validIds.length },
  });

  return jsonResponse({
    updated: validIds.length,
    skipped: ids.length - validIds.length,
  });
};

export const handleAdminFulfillmentRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "PUT" && id === "bulk-fulfillment") {
    return bulkUpdateOrderFulfillment(request);
  }
  if (request.method === "PUT" && id && segments[4] === "fulfillment") {
    return updateOrderFulfillment(request, id);
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
};
