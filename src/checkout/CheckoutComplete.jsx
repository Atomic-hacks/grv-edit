import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RequireAuth from "../component/auth/RequireAuth";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import InlineNotice from "../component/ui/InlineNotice";

const MAX_ATTEMPTS = 6;
const RETRY_DELAY = 2500;

// A ring that sweeps while we wait on Paystack — deliberately not a plain
// spinner, since this can take several seconds and should feel like active
// progress rather than a stuck page.
const PendingIcon = () => (
  <span className="relative inline-flex h-20 w-20 items-center justify-center">
    <span
      aria-hidden="true"
      className="status-ring-pulse absolute inset-0 rounded-full bg-(--color-accent-orange)/15"
    />
    <svg
      viewBox="0 0 48 48"
      className="status-ring-spin h-14 w-14"
      aria-hidden="true"
    >
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="var(--line)"
        strokeWidth="3"
      />
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="var(--color-accent-orange)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="90 126"
      />
    </svg>
  </span>
);

// A check mark that draws itself once the payment is confirmed — the one
// moment on this page worth making feel deliberate.
const SuccessIcon = () => (
  <span className="status-icon-pop relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-(--ink-900)">
    <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 7"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="status-check-path"
      />
    </svg>
  </span>
);

const NoticeIcon = ({ tone = "muted" }) => (
  <span
    className={`status-icon-pop inline-flex h-20 w-20 items-center justify-center rounded-full border-2 ${
      tone === "error"
        ? "border-red-700 text-red-700"
        : "border-(--ink-300) text-(--ink-500)"
    }`}
  >
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      <path
        d="M12 8v5M12 16.5h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  </span>
);

const CheckoutCompleteContent = () => {
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { clearCart } = useCart();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const [result, setResult] = useState({
    status: "loading",
    orderId: null,
    error: "",
  });
  const clearedCartRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    const checkPayment = async (attempt) => {
      if (!reference) {
        setResult({
          status: "FAILED",
          orderId: null,
          error: "Payment reference is missing.",
        });
        return;
      }

      try {
        const request = createAuthenticatedRequest(session);
        const data = await request(
          `/api/checkout/verify?reference=${encodeURIComponent(reference)}`,
        );
        if (cancelled) return;

        if (data.status === "PAID") {
          if (!clearedCartRef.current) {
            clearedCartRef.current = true;
            clearCart();
          }
          setResult({ status: "PAID", orderId: data.orderId, error: "" });
          return;
        }

        // Paystack has definitively confirmed nothing was charged — safe to
        // invite a retry.
        if (data.status === "FAILED") {
          setResult({
            status: "FAILED",
            orderId: null,
            error: "Your payment was not completed. Nothing was charged.",
          });
          return;
        }

        // Still PENDING — this covers both "Paystack hasn't settled yet"
        // and "our own request to Paystack hit a hiccup". Neither means the
        // payment failed, so we just keep polling instead of ever showing
        // an error for it.
        if (attempt < MAX_ATTEMPTS - 1) {
          setResult({ status: "PENDING", orderId: null, error: "" });
          retryTimer = window.setTimeout(
            () => checkPayment(attempt + 1),
            RETRY_DELAY,
          );
          return;
        }

        // Exhausted our polling window without a definitive answer. This is
        // deliberately NOT "FAILED" — the payment may still complete a
        // moment later via the webhook, and inviting a retry here risks a
        // double charge. Point them at their orders instead of "try again."
        setResult({ status: "UNKNOWN", orderId: null, error: "" });
      } catch (requestError) {
        if (cancelled) return;
        if (attempt < MAX_ATTEMPTS - 1) {
          retryTimer = window.setTimeout(
            () => checkPayment(attempt + 1),
            RETRY_DELAY,
          );
          return;
        }
        setResult({
          status: "UNKNOWN",
          orderId: null,
          error: requestError.message || "",
        });
      }
    };

    checkPayment(0);
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, [clearCart, reference, session]);

  return (
    <main className="min-h-screen px-6 py-24 md:px-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-gray-500">
          Payment
        </p>
        {result.status === "loading" || result.status === "PENDING" ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <PendingIcon />
            <h1 className="mt-8 text-4xl font-semibold">
              Processing your payment
            </h1>
            <p className="mt-4 max-w-md text-gray-600">
              We're waiting for Paystack to confirm your payment. This usually
              only takes a few seconds — please don't close this page.
            </p>
          </div>
        ) : result.status === "PAID" ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <SuccessIcon />
            <h1 className="mt-8 text-4xl font-semibold">Payment successful</h1>
            <p className="mt-3 text-gray-600">
              Order #{result.orderId} is confirmed.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to={`/account/orders/${result.orderId}`}
                className="inline-flex bg-[var(--ink-900)] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-(--color-accent-orange)"
              >
                View order
              </Link>
              <Link
                to="/shop"
                className="inline-flex border border-[var(--ink-900)] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        ) : result.status === "UNKNOWN" ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <NoticeIcon />
            <h1 className="mt-8 text-4xl font-semibold">
              Still confirming your payment
            </h1>
            <p className="body-text mt-4 max-w-md">
              This is taking longer than usual. If you were charged, you'll get
              an email confirmation shortly and the order will show up in your
              account — please check there before trying again.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/account?section=orders"
                className="inline-flex bg-[var(--ink-900)] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-(--color-accent-orange)"
              >
                Check my orders
              </Link>
              <Link
                to="/shop"
                className="inline-flex border border-[var(--ink-900)] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center text-center">
            <NoticeIcon tone="error" />
            <h1 className="mt-8 text-4xl font-semibold">
              Payment didn't go through
            </h1>
            <p className="body-text mt-4 max-w-md">
              Nothing was charged. Your Goody Bag is still here — you can try
              again whenever you're ready.
            </p>
            {result.error && (
              <InlineNotice tone="error" className="mt-4">
                {result.error}
              </InlineNotice>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/cart"
                className="inline-flex bg-[var(--ink-900)] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-(--color-accent-orange)"
              >
                Back to bag
              </Link>
            </div>
          </div>
        )}
      </div>
      {result.status === "PAID" && (
        <>
          <div className="page-shell">
            <RecentlyViewedRail />
          </div>
          <StoreSupport promises={false} newsletter={false} />
        </>
      )}
    </main>
  );
};

const CheckoutComplete = () => (
  <RequireAuth>
    <CheckoutCompleteContent />
  </RequireAuth>
);

export default CheckoutComplete;
