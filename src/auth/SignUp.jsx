import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

const SignUp = () => {
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown === 0) return undefined;

    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setResendMessage("");
    setResendError("");
    setSubmitting(true);
    try {
      await signUp({ email, password, name });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendConfirmationEmail = async () => {
    if (resendCooldown > 0) return;

    setResendMessage("");
    setResendError("");
    setResendCooldown(60);

    const { error: resendErrorResponse } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (resendErrorResponse) {
      setResendCooldown(0);
      setResendError(resendErrorResponse.message);
      return;
    }

    setResendMessage("Email resent");
  };

  if (submitted) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-4 text-sm text-gray-600">
          We sent a confirmation link to {email}. Confirm your address, then{" "}
          <Link
            to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="underline"
          >
            log in
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={resendConfirmationEmail}
          disabled={resendCooldown > 0}
          className="mt-6 text-sm underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
        >
          {resendCooldown > 0
            ? `Resend available in ${resendCooldown}s`
            : "Didn't receive an email? Resend"}
        </button>
        {resendMessage && (
          <p className="mt-3 text-sm text-green-700">{resendMessage}</p>
        )}
        {resendError && (
          <p className="mt-3 text-sm text-red-600">{resendError}</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
          className="underline"
        >
          Log in
        </Link>
      </p>
    </main>
  );
};

export default SignUp;
