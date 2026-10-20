import { queueWaitlistRestock } from "./waitlistNotifications.js";
export class CheckoutInventoryError extends Error {
  constructor(message = "An item is no longer available. Please review your Goody Bag.") {
    super(message);
    this.code = "INSUFFICIENT_STOCK";
  }
}

// Merge duplicate lines before checking or allocating stock. Sorting gives
// concurrent multi-item checkouts the same row-lock order.
export const aggregateCheckoutItems = (items) => {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new CheckoutInventoryError("Checkout must contain between 1 and 100 items.");
  const merged = new Map();
  for (const item of items) {
    if (!item || typeof item.productId !== "string" || !item.productId.trim() || typeof item.variantId !== "string" || !item.variantId.trim() || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new CheckoutInventoryError("Goody Bag contains an invalid item.");
    const existing = merged.get(item.variantId);
    if (existing && existing.productId !== item.productId) throw new CheckoutInventoryError("Goody Bag contains an invalid item.");
    const quantity = (existing?.quantity || 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) throw new CheckoutInventoryError("Goody Bag quantity is too large.");
    merged.set(item.variantId, { productId: item.productId, variantId: item.variantId, quantity });
  }
  return [...merged.values()].sort((a, b) => a.variantId.localeCompare(b.variantId));
};

// Must be called inside the transaction which records the reservation/order.
// The stock predicate is evaluated under the database row lock, not an earlier
// read. Throwing rolls back *all* allocated lines on a partial failure.
export const allocateCheckoutStock = async (transaction, items) => {
  for (const item of aggregateCheckoutItems(items)) {
    const result = await transaction.variant.updateMany({
      where: { id: item.variantId, productId: item.productId, stock: { gte: item.quantity }, product: { archived: false } },
      data: { stock: { decrement: item.quantity } },
    });
    if (result.count !== 1) throw new CheckoutInventoryError();
  }
};

export const lockCheckout = async (transaction, reference) => {
  await transaction.$queryRaw`SELECT reference FROM "PendingCheckout" WHERE reference = ${reference} FOR UPDATE`;
  return transaction.pendingCheckout.findUnique({ where: { reference } });
};

// Keep the immutable payment payload for late settlements and reconciliation.
// Row lock serializes release against both webhook and browser finalization.
export const releaseCheckoutStock = async (prisma, reference, status) => prisma.$transaction(async (transaction) => {
  const pending = await lockCheckout(transaction, reference);
  if (!pending) return false;
  const payload = pending.payload;
  if (payload.inventoryReserved) {
    for (const item of aggregateCheckoutItems(payload.items)) {
      const released = await transaction.variant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
      if (released.count !== 1) throw new CheckoutInventoryError("A reserved variant is missing and requires inventory review.");
      const variant = await transaction.variant.findUnique({ where: { id: item.variantId }, include: { product: { select: { name: true } } } });
      if (variant.stock > 0) await queueWaitlistRestock(transaction, { variantId: variant.id, productId: variant.productId, productName: variant.product.name, color: variant.color, size: variant.size });
    }
  }
  // Optional chaining keeps old test doubles and a rolling application deploy
  // compatible; production deploys still apply the schema migration first.
  await transaction.firstOrderPromoRedemption?.deleteMany({
    where: { checkoutReference: reference, status: "RESERVED" },
  });
  await transaction.discountRedemption?.deleteMany({
    where: { checkoutReference: reference, status: "RESERVED" },
  });
  await transaction.pendingCheckout.update({ where: { reference }, data: { payload: { ...payload, inventoryReserved: false, paymentStatus: status } } });
  return Boolean(payload.inventoryReserved);
});
