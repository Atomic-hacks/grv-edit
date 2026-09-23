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
 * Claims a PENDING order for payment, atomically.
 *
 * This is the single point that decides whether a given payment gets
 * processed. The webhook and the customer's return-from-Paystack
 * verification both call it for the same order, often within the same
 * second; the conditional updateMany means exactly one of them sees
 * `true` and goes on to decrement stock. Everything downstream —
 * stock, discount usage counters, the first-order promo flag — depends
 * on this returning true only once.
 */
export const claimOrderForPayment = async (transaction, orderId) => {
  const claim = await transaction.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "PAID" },
  });
  return claim.count > 0;
};
