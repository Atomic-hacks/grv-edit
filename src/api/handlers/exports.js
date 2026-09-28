// CSV exports for operational data. Every export is admin/analyst-guarded
// and deliberately excludes anything sensitive (no passwords, tokens,
// Paystack secret, or other credentials — there is nothing here beyond
// what an admin already sees in the corresponding list screen).
import { prisma } from "../../server/prisma.js";
import { requireRole } from "../../server/requireRole.js";

const csvCell = (value) => {
  const cell = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
};

const toCsv = (columns, rows) =>
  [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
  "\r\n";

const csvResponse = (filename, columns, rows) =>
  new Response(toCsv(columns, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const guardExport = (request) => requireRole(request, ["ADMIN", "ANALYST"]);

export const exportOrdersCsv = async (request, url) => {
  const guard = await guardExport(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const status = url.searchParams.get("status");
  const state = url.searchParams.get("state");
  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(state ? { state } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      fulfillmentStatus: true,
      total: true,
      shippingFee: true,
      paystackReference: true,
      state: true,
      city: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return csvResponse(
    "orders.csv",
    [
      "Order ID",
      "Status",
      "Fulfilment status",
      "Total",
      "Shipping fee",
      "Paystack reference",
      "Customer name",
      "Customer email",
      "City",
      "State",
      "Created at",
    ],
    orders.map((order) => [
      order.id,
      order.status,
      order.fulfillmentStatus,
      order.total,
      order.shippingFee,
      order.paystackReference,
      order.user?.name || "",
      order.user?.email || "",
      order.city,
      order.state,
      order.createdAt.toISOString(),
    ]),
  );
};

export const exportCustomersCsv = async (request) => {
  const guard = await guardExport(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      emailVerified: true,
      marketingOptIn: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  return csvResponse(
    "customers.csv",
    [
      "Customer ID",
      "Name",
      "Email",
      "Active",
      "Email verified",
      "Marketing opt-in",
      "Orders",
      "Joined",
    ],
    customers.map((customer) => [
      customer.id,
      customer.name || "",
      customer.email,
      customer.active,
      customer.emailVerified,
      customer.marketingOptIn,
      customer._count.orders,
      customer.createdAt.toISOString(),
    ]),
  );
};

export const exportProductsCsv = async (request) => {
  const guard = await guardExport(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      basePrice: true,
      discountPercent: true,
      archived: true,
      featured: true,
      brand: { select: { name: true } },
      variants: { select: { stock: true } },
    },
  });

  return csvResponse(
    "products.csv",
    [
      "Product ID",
      "Name",
      "Brand",
      "Base price",
      "Discount %",
      "Archived",
      "Featured",
      "Total stock",
    ],
    products.map((product) => [
      product.id,
      product.name,
      product.brand?.name || "",
      product.basePrice,
      product.discountPercent ?? "",
      product.archived,
      product.featured,
      product.variants.reduce((sum, variant) => sum + variant.stock, 0),
    ]),
  );
};

export const exportCasesCsv = async (request, url) => {
  const guard = await guardExport(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const cases = await prisma.supportCase.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      reference: true,
      category: true,
      issueType: true,
      status: true,
      customerEmail: true,
      orderId: true,
      requestedRefundAmount: true,
      refundedAmount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return csvResponse(
    "refunds-and-complaints.csv",
    [
      "Reference",
      "Category",
      "Issue type",
      "Status",
      "Customer email",
      "Order ID",
      "Requested refund",
      "Refunded amount",
      "Created at",
      "Updated at",
    ],
    cases.map((c) => [
      c.reference,
      c.category,
      c.issueType,
      c.status,
      c.customerEmail,
      c.orderId || "",
      c.requestedRefundAmount ?? "",
      c.refundedAmount ?? "",
      c.createdAt.toISOString(),
      c.updatedAt.toISOString(),
    ]),
  );
};

export const exportTransactionsCsv = async (request) => {
  const guard = await guardExport(request);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const orders = await prisma.order.findMany({
    where: { paystackReference: { not: { startsWith: "pending-" } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      paystackReference: true,
      status: true,
      total: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  return csvResponse(
    "transactions.csv",
    [
      "Order ID",
      "Paystack reference",
      "Order status",
      "Amount",
      "Customer email",
      "Created at",
    ],
    orders.map((order) => [
      order.id,
      order.paystackReference,
      order.status,
      order.total,
      order.user?.email || "",
      order.createdAt.toISOString(),
    ]),
  );
};

export const handleAdminExportRequest = async (request, segments, url) => {
  const resource = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method !== "GET")
    return jsonResponse({ error: "Method not allowed" }, 405);
  switch (resource) {
    case "orders":
      return exportOrdersCsv(request, url);
    case "customers":
      return exportCustomersCsv(request);
    case "products":
      return exportProductsCsv(request);
    case "cases":
      return exportCasesCsv(request, url);
    case "transactions":
      return exportTransactionsCsv(request);
    default:
      return jsonResponse({ error: "Unknown export" }, 404);
  }
};
