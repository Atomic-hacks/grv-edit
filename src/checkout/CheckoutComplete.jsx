import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RequireAuth from "../component/auth/RequireAuth";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { createAuthenticatedRequest } from "../lib/apiClient";

const MAX_ATTEMPTS = 4;
const RETRY_DELAY = 2500;
const PENDING_ORDER_KEY = "grv_pending_order_id";
const CLEARED_ORDER_KEY = "grv_cart_cleared_order_id";

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
  const clearedOrderRef = useRef(false);

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
          const savedOrderId = localStorage.getItem(PENDING_ORDER_KEY);
          const alreadyCleared =
            localStorage.getItem(CLEARED_ORDER_KEY) === data.orderId;
          if (
            savedOrderId === data.orderId &&
            !alreadyCleared &&
            !clearedOrderRef.current
          ) {
            clearCart();
            clearedOrderRef.current = true;
            localStorage.setItem(CLEARED_ORDER_KEY, data.orderId);
            localStorage.removeItem(PENDING_ORDER_KEY);
          }
          setResult({ status: "PAID", orderId: data.orderId, error: "" });
          return;
        }

        if (
          data.status === "FAILED" ||
          (data.paystackStatus && data.paystackStatus !== "success")
        ) {
          setResult({
            status: "FAILED",
            orderId: data.orderId,
            error: "Your payment was not completed.",
          });
          return;
        }

        if (attempt < MAX_ATTEMPTS - 1) {
          setResult({ status: "PENDING", orderId: data.orderId, error: "" });
          retryTimer = window.setTimeout(
            () => checkPayment(attempt + 1),
            RETRY_DELAY,
          );
          return;
        }

        setResult({
          status: "PENDING",
          orderId: data.orderId,
          error:
            "Payment is still being confirmed. Please check again shortly.",
        });
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
          status: "FAILED",
          orderId: null,
          error: requestError.message || "Unable to verify your payment.",
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
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
          Payment
        </p>
        {result.status === "loading" || result.status === "PENDING" ? (
          <>
            <h1 className="mt-4 text-4xl font-semibold">
              Processing your payment, please wait...
            </h1>
            <p className="mt-4 text-gray-600">
              We are waiting for Paystack to confirm your payment.
            </p>
          </>
        ) : result.status === "PAID" ? (
          <>
            <h1 className="mt-4 text-4xl font-semibold">
              Payment successful, order #{result.orderId} confirmed
            </h1>
            <Link
              to={`/account/orders/${result.orderId}`}
              className="mt-8 inline-flex bg-black px-6 py-3 text-sm font-medium text-white"
            >
              View order
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-4xl font-semibold">Payment failed</h1>
            <p className="mt-4 text-red-600">{result.error}</p>
            {result.orderId && (
              <Link
                to={`/account/orders/${result.orderId}`}
                className="mt-8 inline-flex border border-black px-6 py-3 text-sm font-medium"
              >
                View order
              </Link>
            )}
          </>
        )}
        {result.status === "PENDING" && result.error && (
          <p className="mt-6 text-sm text-gray-600">{result.error}</p>
        )}
      </div>
    </main>
  );
};

const CheckoutComplete = () => (
  <RequireAuth>
    <CheckoutCompleteContent />
  </RequireAuth>
);

export default CheckoutComplete;
