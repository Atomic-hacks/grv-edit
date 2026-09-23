import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import InlineNotice from "../component/ui/InlineNotice";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` },
    );

    setSubmitting(false);
    if (resetError) {
      setError(resetError.message || "Could not send the reset email.");
      return;
    }

    setSubmitted(true);
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-24">
      <p className="text-xs font-semibold uppercase tracking-[1px] text-gray-500">
        Account access
      </p>
      <h1 className="mt-4 text-3xl font-semibold">Forgot password?</h1>
      <p className="mt-4 text-sm leading-6 text-gray-600">
        Enter your email address and we&apos;ll send instructions to reset your
        password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="border border-gray-300 px-3 py-2"
          />
        </label>
        <InlineNotice tone="error">{error}</InlineNotice>
        {submitted && (
          <p className="text-sm leading-6 text-emerald-700" role="status">
            If an account exists for that email, a reset link has been sent.
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-600">
        Remember your password?{" "}
        <Link to="/login" className="underline underline-offset-4">
          Log in
        </Link>
      </p>
    </main>
  );
};

export default ForgotPassword;
