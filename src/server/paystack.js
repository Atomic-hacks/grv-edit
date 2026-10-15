import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Paystack webhook signature.
 *
 * Paystack signs the raw request body with HMAC-SHA512 using the secret
 * key. The comparison is constant-time so a timing side channel cannot be
 * used to discover a valid signature byte by byte, and length is checked
 * first because timingSafeEqual throws on mismatched buffer lengths.
 *
 * `secret` is injectable so this can be tested without touching process.env.
 */
export const verifyPaystackSignature = (
  rawBody,
  signature,
  secret = process.env.PAYSTACK_SECRET_KEY,
) => {
  if (!secret || !signature || typeof rawBody !== "string") return false;

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
};

/**
 * Claims a checkout attempt for finalization, atomically.
 *
 * A row only exists here while payment is in flight; the webhook and the
 * customer's return-from-Paystack verification both try to claim the same
 * reference, often within the same second. The delete is the claim: it can
 * only ever succeed once for a given reference (the row is gone after),
 * so exactly one caller goes on to create the Order — everything
 * downstream (stock, discount usage, the first-order promo flag) depends
 * on that.
 */
export const claimPendingCheckout = async (transaction, reference) => {
  const claim = await transaction.pendingCheckout.deleteMany({
    where: { reference },
  });
  return claim.count > 0;
};

/**
 * Confirms what Paystack says was actually paid covers what we charged.
 *
 * Neither the webhook nor the customer's return-from-Paystack check used to
 * look at the amount at all: a `charge.success` for a reference was taken as
 * proof the order was paid in full. That trusts the event's existence rather
 * than its contents, so any flow that can settle a transaction for less than
 * the requested amount (partial payments, a bank transfer short by a naira,
 * a currency mix-up) would still have produced a PAID order and shipped the
 * goods.
 *
 * `expectedTotal` is the server-computed order total in naira — never a
 * client-supplied figure. Paystack reports `amount` in kobo.
 *
 * Overpayment is allowed through (refusing to fulfil an order someone paid
 * too much for helps nobody) but reported, so it can be reconciled.
 */
export const checkPaidAmount = ({
  paidAmount,
  paidCurrency,
  expectedTotal,
}) => {
  const expectedKobo = Math.round(Number(expectedTotal) * 100);
  if (!Number.isFinite(expectedKobo) || expectedKobo < 0) {
    return { ok: false, reason: "expected-total-invalid", expectedKobo };
  }
  if (!Number.isInteger(paidAmount) || paidAmount < 0) {
    return { ok: false, reason: "paid-amount-invalid", expectedKobo };
  }
  if (paidCurrency !== "NGN") {
    return { ok: false, reason: "currency-mismatch", expectedKobo };
  }
  if (paidAmount < expectedKobo) {
    return { ok: false, reason: "underpaid", expectedKobo };
  }
  return {
    ok: true,
    reason: paidAmount > expectedKobo ? "overpaid" : "exact",
    expectedKobo,
  };
};
