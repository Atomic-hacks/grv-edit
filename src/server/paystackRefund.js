// Server-side Paystack refund calls. Never exposed to the client — only
// called from requireRole-guarded admin case-handling endpoints.
//
// Paystack's refund endpoint is idempotent-ish per transaction but does not
// stop a caller from requesting a second refund on the same transaction, so
// duplicate-prevention is handled by the caller (routes.js) using the
// SupportCase.status state machine before this is ever called.
const PAYSTACK_API = "https://api.paystack.co";

export const initiatePaystackRefund = async ({
  transactionReference,
  amountKobo,
  reason,
  secretKey = process.env.PAYSTACK_SECRET_KEY,
}) => {
  if (!secretKey) {
    return {
      ok: false,
      error: "Paystack is not configured (missing PAYSTACK_SECRET_KEY)",
    };
  }
  if (!transactionReference) {
    return { ok: false, error: "A transaction reference is required" };
  }

  try {
    const response = await fetch(`${PAYSTACK_API}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: transactionReference,
        ...(amountKobo ? { amount: Math.round(amountKobo) } : {}),
        ...(reason ? { customer_note: reason, merchant_note: reason } : {}),
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.status) {
      return {
        ok: false,
        error:
          body?.message ||
          `Paystack refund request failed (${response.status})`,
      };
    }
    return {
      ok: true,
      refundReference: String(
        body.data?.id ?? body.data?.reference ?? transactionReference,
      ),
      status: body.data?.status || "pending",
      raw: body.data,
    };
  } catch (error) {
    console.error("Paystack refund request threw", error);
    return { ok: false, error: "Could not reach Paystack" };
  }
};

// Fetches a transaction's verified details (amount actually paid, currency,
// status) — used to validate a requested refund amount never exceeds what
// was actually collected, and to surface Paystack transaction info to the
// admin case view.
export const verifyPaystackTransaction = async (
  reference,
  secretKey = process.env.PAYSTACK_SECRET_KEY,
) => {
  if (!secretKey || !reference) return null;
  try {
    const response = await fetch(
      `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.status) return null;
    return body.data;
  } catch (error) {
    console.error("Paystack transaction verify threw", error);
    return null;
  }
};
