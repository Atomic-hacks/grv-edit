import { Prisma } from "@prisma/client";
import { fetchPaystackPayment } from "./paystack.js";
import { releaseCheckoutStock } from "./checkoutInventory.js";

export const TERMINAL_PAYMENT_STATUSES = new Set(["failed", "abandoned", "reversed"]);

// Reconcile instead of deleting old payment attempts. Unknown/provider-error
// states keep their reservation and payload; only authoritative terminal states
// release stock. Provider calls are always outside database transactions.
export const reconcileCheckouts = async ({ prisma, finalize, verify = fetchPaystackPayment, now = new Date(), variantIds = [] }) => {
  const before = new Date(now.getTime() - 30 * 60_000);
  const variantFilter = variantIds.length ? Prisma.sql`AND EXISTS (SELECT 1 FROM jsonb_array_elements(payload->'items') AS item WHERE item->>'variantId' IN (${Prisma.join(variantIds)}))` : Prisma.empty;
  const references = await prisma.$queryRaw`
    SELECT reference FROM "PendingCheckout"
    WHERE "createdAt" < ${before}
      AND COALESCE(payload->>'paymentStatus', 'pending') NOT IN ('failed', 'abandoned', 'reversed', 'initialization_rejected')
      AND COALESCE(payload->>'nextCheckAt', '') <= ${now.toISOString()}
      ${variantFilter}
    ORDER BY COALESCE(payload->>'nextCheckAt', '') ASC, "createdAt" ASC LIMIT 5`;
  const result = { checked: 0, recovered: 0, released: 0, errors: [] };
  for (const { reference } of references) {
    try {
      const payment = await verify(reference);
      result.checked++;
      if (payment.status === "success") {
        const completed = await finalize(reference, payment);
        if (!completed.order) throw new Error("Successful payment requires manual reconciliation");
        result.recovered++;
      } else if (TERMINAL_PAYMENT_STATUSES.has(payment.status)) {
        if (await releaseCheckoutStock(prisma, reference, payment.status)) result.released++;
      }
    } catch (error) {
      result.errors.push({ reference, error: error.message });
    } finally {
      // Defer unresolved entries so a permanently pending old payment cannot
      // starve newer recoverable attempts on every scheduled batch.
      await prisma.$executeRaw`
        UPDATE "PendingCheckout"
        SET payload = jsonb_set(payload, '{nextCheckAt}', to_jsonb(${new Date(now.getTime() + 60 * 60_000).toISOString()}::text))
        WHERE reference = ${reference}`;
    }
  }
  return result;
};
