// Bulk product operations. Archiving still respects the existing "only
// sold-out products can be archived" rule enforced elsewhere in the admin
// product editor — a bulk archive simply applies that same check per
// product and reports which ones were skipped, rather than overriding it.
import { prisma } from "../../server/prisma.js";
import { Prisma } from "@prisma/client";
import { requireRole } from "../../server/requireRole.js";
import { recordAdminAction } from "../../server/auditLog.js";
import { queueWaitlistRestock } from "../../server/waitlistNotifications.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const bulkSetProductArchived = async (request) => {
  const guard = await requireRole(request, ["ADMIN"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => typeof id === "string")
    : [];
  const archived = body.archived;
  if (!ids.length)
    return jsonResponse({ error: "ids must be a non-empty array" }, 400);
  if (typeof archived !== "boolean")
    return jsonResponse({ error: "archived must be a boolean" }, 400);

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, variants: { select: { stock: true } } },
  });

  const eligibleIds = archived
    ? products
        .filter(
          (p) =>
            p.variants.length > 0 && p.variants.every((v) => v.stock === 0),
        )
        .map((p) => p.id)
    : products.map((p) => p.id);
  const skippedIds = ids.filter((id) => !eligibleIds.includes(id));

  if (eligibleIds.length) {
    await prisma.product.updateMany({
      where: { id: { in: eligibleIds } },
      data: { archived },
    });
  }

  await recordAdminAction({
    actorId: guard.user.id,
    action: archived ? "product.bulk_archived" : "product.bulk_unarchived",
    entityType: "Product",
    entityId: eligibleIds.join(","),
    newState: { count: eligibleIds.length },
  });

  return jsonResponse({ updated: eligibleIds.length, skipped: skippedIds });
};

export const bulkSetProductCategories = async (request) => {
  const guard = await requireRole(request, ["ADMIN"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => typeof id === "string")
    : [];
  const categoryIds = Array.isArray(body.categoryIds)
    ? body.categoryIds.filter((id) => typeof id === "string")
    : [];
  if (!ids.length)
    return jsonResponse({ error: "ids must be a non-empty array" }, 400);
  if (!categoryIds.length)
    return jsonResponse(
      { error: "categoryIds must be a non-empty array" },
      400,
    );

  const categoryCount = await prisma.category.count({
    where: { id: { in: categoryIds } },
  });
  if (categoryCount !== categoryIds.length) {
    return jsonResponse(
      { error: "One or more categoryIds were not found" },
      400,
    );
  }

  await prisma.$transaction([
    prisma.productCategory.deleteMany({ where: { productId: { in: ids } } }),
    prisma.productCategory.createMany({
      data: ids.flatMap((productId) =>
        categoryIds.map((categoryId) => ({ productId, categoryId })),
      ),
    }),
  ]);

  await recordAdminAction({
    actorId: guard.user.id,
    action: "product.bulk_categories_changed",
    entityType: "Product",
    entityId: ids.join(","),
    newState: { categoryIds },
  });

  return jsonResponse({ updated: ids.length });
};

// Adjusts every variant's stock for the selected products by the same
// delta (positive to restock, negative to correct a count). Stock never
// drops below zero.
export const bulkAdjustProductStock = async (request, { processRestocks } = {}) => {
  const guard = await requireRole(request, ["ADMIN"]);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => typeof id === "string")
    : [];
  const delta = Number(body.delta);
  if (!ids.length)
    return jsonResponse({ error: "ids must be a non-empty array" }, 400);
  if (!Number.isInteger(delta) || delta === 0) {
    return jsonResponse({ error: "delta must be a non-zero integer" }, 400);
  }

  const restockedVariants = [];
  let variantsUpdated = 0;
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Variant" WHERE "productId" IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    const variants = await transaction.variant.findMany({
      where: { productId: { in: ids } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        stock: true,
        color: true,
        size: true,
        productId: true,
        product: { select: { name: true } },
      },
    });
    variantsUpdated = variants.length;
    for (const variant of variants) {
      const stock = Math.max(0, variant.stock + delta);
      await transaction.variant.update({
        where: { id: variant.id },
        data: { stock },
      });
      if (variant.stock <= 0 && stock > 0) {
        const restock = {
          variantId: variant.id,
          productId: variant.productId,
          productName: variant.product.name,
          color: variant.color,
          size: variant.size,
        };
        restockedVariants.push(restock);
        await queueWaitlistRestock(transaction, restock);
      }
    }
  });

  await recordAdminAction({
    actorId: guard.user.id,
    action: "product.bulk_stock_adjusted",
    entityType: "Product",
    entityId: ids.join(","),
    newState: { delta, variantsUpdated },
  });

  if (restockedVariants.length && processRestocks) {
    await processRestocks(restockedVariants);
  }

  return jsonResponse({
    variantsUpdated,
    restockedVariants: restockedVariants.length,
  });
};

export const handleAdminProductBulkRequest = async (request, segments, deps) => {
  const action = segments[4] || null;
  if (request.method !== "PUT")
    return jsonResponse({ error: "Method not allowed" }, 405);
  if (action === "archived") return bulkSetProductArchived(request);
  if (action === "categories") return bulkSetProductCategories(request);
  if (action === "stock") return bulkAdjustProductStock(request, deps);
  return jsonResponse({ error: "Unknown bulk action" }, 404);
};
