const TERMINAL_PAYMENT_STATUSES = new Set([
  "failed",
  "abandoned",
  "reversed",
]);

// A first-order offer is reserved before the customer leaves for Paystack so
// two tabs cannot both use it. If they return to checkout instead of through
// the callback page, reconcile that earlier reservation before deciding the
// offer is unavailable. Only an authoritative terminal provider state may
// release it. Timeouts and non-terminal states may only resume the existing
// provider reference, which prevents a second payment from being initialized.
export const reconcileFirstOrderPromoReservation = async ({
  prisma,
  userId,
  verifyPayment,
  releaseCheckout,
  finalizeCheckout,
}) => {
  const redemption = await prisma.firstOrderPromoRedemption.findUnique({
    where: { userId },
    select: { checkoutReference: true, status: true },
  });
  if (!redemption) return { state: "AVAILABLE" };

  const reference = redemption.checkoutReference;
  if (redemption.status === "REDEEMED") {
    return { state: "USED", reference };
  }

  const order = await prisma.order.findUnique({
    where: { paystackReference: reference },
    select: { id: true },
  });
  if (order) return { state: "PAID", reference, orderId: order.id };

  const pending = await prisma.pendingCheckout.findUnique({
    where: { reference },
    select: { reference: true, payload: true },
  });
  if (!pending) {
    // There is no payment payload and no resulting order. This can only be an
    // orphan left by older code/manual cleanup, so it cannot settle later.
    await prisma.firstOrderPromoRedemption.deleteMany({
      where: { userId, checkoutReference: reference, status: "RESERVED" },
    });
    return { state: "AVAILABLE" };
  }

  const authorizationUrl =
    typeof pending.payload?.authorizationUrl === "string" &&
    pending.payload.authorizationUrl
      ? pending.payload.authorizationUrl
      : null;

  let payment;
  try {
    payment = await verifyPayment(reference);
  } catch {
    // Reopening the provider URL continues the same Paystack transaction; it
    // cannot create a second reference or consume the promotion twice. This
    // is safer and more useful than trapping the customer on a status page
    // when Paystack verification is temporarily unavailable.
    if (authorizationUrl) {
      return { state: "READY", reference, authorizationUrl };
    }
    return { state: "UNKNOWN", reference };
  }

  if (payment.status === "success") {
    const result = await finalizeCheckout(reference, payment);
    if (result?.order) {
      return {
        state: "PAID",
        reference,
        orderId: result.order.id,
      };
    }
    return { state: "UNKNOWN", reference };
  }

  if (TERMINAL_PAYMENT_STATUSES.has(payment.status)) {
    await releaseCheckout(reference, payment.status);
    return { state: "AVAILABLE" };
  }

  // For any non-terminal state, resume this exact Paystack transaction. Even
  // when the customer selected a channel before closing the provider page,
  // reusing its authorization URL is idempotent and does not initialize a
  // second charge. The completion page still polls verification while a
  // payment is actually settling.
  if (authorizationUrl) {
    return {
      state: "READY",
      reference,
      authorizationUrl,
    };
  }

  return { state: "PENDING", reference };
};

