// Real-data operational analytics for the admin dashboard. No placeholder
// numbers: every figure here is a Prisma aggregate/query against actual
// Order/SupportCase/User/Product rows, filtered to the requested date
// range (defaults to the last 30 days) and to states that actually mean
// what the label says (e.g. "revenue" only counts orders that were really
// paid for).
import { prisma } from "../../server/prisma.js";
import { requireRole } from "../../server/requireRole.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Orders in any of these statuses represent money actually collected.
const PAID_STATUSES = ["PAID", "SHIPPED", "DELIVERED"];
const OPEN_COMPLAINT_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CUSTOMER_INFO",
];
const PENDING_REFUND_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CUSTOMER_INFO",
  "APPROVED",
  "REFUND_PROCESSING",
];

const parseDateRange = (url) => {
  const now = new Date();
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const to = toParam ? new Date(toParam) : now;
  const from = fromParam
    ? new Date(fromParam)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  // Inclusive of the whole "to" day.
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

export const getAdminAnalytics = async (request, url) => {
  const guard = await requireRole(request, ["ADMIN", "ANALYST"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const range = parseDateRange(url);
  if (!range) return jsonResponse({ error: "Invalid from/to date" }, 400);
  const { from, to } = range;
  const createdAtRange = { gte: from, lte: to };

  const [
    revenueAgg,
    paidOrders,
    pendingPayments,
    completedOrders,
    cancelledOrders,
    refundedAgg,
    pendingRefunds,
    openComplaints,
    totalCustomers,
    newCustomers,
    totalProducts,
    recentOrders,
    recentCases,
    ordersOverTime,
    revenueOverTime,
    topProductRows,
    topCategoryRows,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: PAID_STATUSES }, createdAt: createdAtRange },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.count({
      where: { status: { in: PAID_STATUSES }, createdAt: createdAtRange },
    }),
    prisma.order.count({
      where: { status: "PENDING", createdAt: createdAtRange },
    }),
    prisma.order.count({
      where: { status: "DELIVERED", createdAt: createdAtRange },
    }),
    prisma.order.count({
      where: { status: "CANCELLED", createdAt: createdAtRange },
    }),
    prisma.supportCase.aggregate({
      where: { status: "REFUNDED", refundedAt: createdAtRange },
      _sum: { refundedAmount: true },
      _count: true,
    }),
    prisma.supportCase.count({
      where: { category: "REFUND", status: { in: PENDING_REFUND_STATUSES } },
    }),
    prisma.supportCase.count({
      where: { category: "COMPLAINT", status: { in: OPEN_COMPLAINT_STATUSES } },
    }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({
      where: { role: "CUSTOMER", createdAt: createdAtRange },
    }),
    prisma.product.count(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.supportCase.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        reference: true,
        category: true,
        issueType: true,
        status: true,
        createdAt: true,
        customerEmail: true,
      },
    }),
    prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "Order"
      WHERE "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY 1 ASC
    `,
    prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") AS day, COALESCE(SUM("total"), 0)::float AS revenue
      FROM "Order"
      WHERE "status" IN ('PAID','SHIPPED','DELIVERED') AND "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY 1 ASC
    `,
    prisma.$queryRaw`
      SELECT oi."productId" AS "productId", p."name" AS name,
             SUM(oi."quantity")::int AS "unitsSold",
             SUM(oi."quantity" * oi."priceAtPurchase")::float AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      LEFT JOIN "Product" p ON p.id = oi."productId"
      WHERE o.status IN ('PAID','SHIPPED','DELIVERED') AND o."createdAt" BETWEEN ${from} AND ${to}
      GROUP BY oi."productId", p."name"
      ORDER BY revenue DESC
      LIMIT 10
    `,
    prisma.$queryRaw`
      SELECT c."name" AS name, SUM(oi."quantity" * oi."priceAtPurchase")::float AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "ProductCategory" pc ON pc."productId" = oi."productId"
      JOIN "Category" c ON c.id = pc."categoryId"
      WHERE o.status IN ('PAID','SHIPPED','DELIVERED') AND o."createdAt" BETWEEN ${from} AND ${to}
      GROUP BY c.name
      ORDER BY revenue DESC
      LIMIT 10
    `,
  ]);

  const revenue = revenueAgg._sum.total || 0;
  const averageOrderValue = paidOrders > 0 ? revenue / paidOrders : 0;

  return jsonResponse({
    range: { from, to },
    revenue,
    paidOrders,
    pendingPayments,
    completedOrders,
    cancelledOrders,
    refundedAmount: refundedAgg._sum.refundedAmount || 0,
    refundedCount: refundedAgg._count,
    pendingRefunds,
    openComplaints,
    customers: totalCustomers,
    newCustomers,
    products: totalProducts,
    averageOrderValue,
    ordersOverTime: ordersOverTime.map((row) => ({
      day: row.day,
      count: row.count,
    })),
    revenueOverTime: revenueOverTime.map((row) => ({
      day: row.day,
      revenue: row.revenue,
    })),
    topProducts: topProductRows.map((row) => ({
      productId: row.productId,
      name: row.name || "Unavailable product",
      unitsSold: row.unitsSold,
      revenue: row.revenue,
    })),
    topCategories: topCategoryRows.map((row) => ({
      name: row.name,
      revenue: row.revenue,
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      customerName: order.user?.name,
      customerEmail: order.user?.email,
    })),
    recentCases,
  });
};
