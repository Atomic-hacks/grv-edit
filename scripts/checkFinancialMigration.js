import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
    const objects = await transaction.$queryRaw`
      SELECT
        to_regclass('public."RefundAttempt"') IS NOT NULL AS "refundAttempt",
        to_regclass('public."FirstOrderPromoRedemption"') IS NOT NULL AS "firstOrderPromoRedemption",
        to_regclass('public."DiscountRedemption"') IS NOT NULL AS "discountRedemption"`;
    const waitlistColumns = await transaction.$queryRaw`
      SELECT column_name AS name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'WaitlistEntry'
        AND column_name IN ('deliveryStatus', 'deliveryAttempts', 'lastDeliveryError', 'providerMessageId', 'notifiedAt', 'fulfilledAt')`;
    const orderStatuses = await transaction.$queryRaw`
      SELECT e.enumlabel AS value FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'OrderStatus' AND e.enumlabel IN ('RETURN_PENDING', 'RETURNED')`;
    const constraints = await transaction.$queryRaw`
      SELECT conname AS name, convalidated AS validated
      FROM pg_constraint WHERE conname = 'Order_trackingUrl_http_check'`;
    return {
      ...objects[0],
      waitlistColumns: waitlistColumns.map((row) => row.name).sort(),
      orderStatuses: orderStatuses.map((row) => row.value).sort(),
      trackingConstraint: constraints[0] ?? null,
    };
  });

  const expectedColumns = ["deliveryAttempts", "deliveryStatus", "fulfilledAt", "lastDeliveryError", "notifiedAt", "providerMessageId"].sort();
  const complete = result.refundAttempt && result.firstOrderPromoRedemption && result.discountRedemption &&
    JSON.stringify(result.waitlistColumns) === JSON.stringify(expectedColumns) &&
    JSON.stringify(result.orderStatuses) === JSON.stringify(["RETURNED", "RETURN_PENDING"].sort()) &&
    Boolean(result.trackingConstraint);

  console.log(JSON.stringify({ complete, ...result }, null, 2));
  if (!complete) process.exitCode = 1;
} catch (error) {
  console.error("Financial migration check failed", {
    code: error?.code || error?.errorCode || "CONNECTION_FAILED",
    message: error?.message?.split("\n").at(-1),
  });
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
