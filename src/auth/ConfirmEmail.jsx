import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import InlineNotice from "../component/ui/InlineNotice";

const ConfirmEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const email = searchParams.get("email") || "";
  const returnTo = searchParams.get("returnTo") || "/account";
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown === 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const verifyCode = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!email) {
      setError("This confirmation session is missing an email address.");
      return;
    }
    if (!/^\d{6}$/.test(token)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setSubmitting(true);
    try {
      await createAuthenticatedRequest(session)("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ code: token }),
      });
    } catch (verifyError) {
      setError(verifyError.message);
      setSubmitting(false);
      return;
    }

    navigate(returnTo, { replace: true });
  };

  const resendCode = async () => {
    if (!email || !session || resending || resendCooldown > 0) return;
    setError("");
    setMessage("");
    setResending(true);
    setResendCooldown(60);
    try {
      await createAuthenticatedRequest(session)("/api/auth/send-verification", {
        method: "POST",
      });
    } catch (resendError) {
      setResendCooldown(0);
      setError(resendError.message);
      setResending(false);
      return;
    }
    setMessage("A new code has been sent.");
    setResending(false);
  };

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Confirm your email</h1>
      <p className="mt-4 text-sm text-gray-600">
        Enter the 6-digit code we sent to {email || "your email address"}.
      </p>
      <form onSubmit={verifyCode} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-left text-sm">
          Confirmation code
          <input
            required
            autoFocus
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={token}
            onChange={(event) =>
              setToken(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="border border-gray-300 px-3 py-3 text-center text-xl tracking-[0.35em] outline-none focus:border-black"
          />
        </label>
        <InlineNotice tone="error" className="text-left">{error}</InlineNotice>
        {message && (
          <p className="text-left text-sm text-emerald-700" role="status">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !email || !session}
          className="bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Confirming…" : "Confirm email"}
        </button>
      </form>
      <button
        type="button"
        onClick={resendCode}
        disabled={resending || resendCooldown > 0 || !email || !session}
        className="mt-6 text-sm underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
      >
        {resending
          ? "Sending…"
          : resendCooldown > 0
            ? `Resend available in ${resendCooldown}s`
            : "Didn't receive a code? Resend"}
      </button>
      <p className="mt-6 text-sm text-gray-600">
        Wrong email?{" "}
        <Link to="/signup" className="underline">
          Create your account again
        </Link>
      </p>
    </main>
  );
};

export default ConfirmEmail;
