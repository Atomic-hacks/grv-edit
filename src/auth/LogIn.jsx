import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../component/ui/PasswordInput";
import InlineNotice from "../component/ui/InlineNotice";
import GoogleSignInButton from "../component/ui/GoogleSignInButton";

const LogIn = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const resetComplete = searchParams.get("reset") === "success";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.message || "Could not log in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <div className="mt-6">
        <GoogleSignInButton returnTo={returnTo} onError={setError} />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.1em] text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        or
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      {resetComplete && (
        <p className="mt-4 text-sm text-emerald-700" role="status">
          Your password has been updated. You can now log in.
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
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
        <PasswordInput
          id="login-password"
          label="Password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Link
          to="/forgot-password"
          className="self-start text-sm text-gray-600 underline underline-offset-4"
        >
          Forgot password?
        </Link>
        <InlineNotice tone="error">{error}</InlineNotice>
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-600">
        Need an account?{" "}
        <Link
          to={`/signup?returnTo=${encodeURIComponent(returnTo)}`}
          className="underline"
        >
          Sign up
        </Link>
      </p>
    </main>
  );
};

export default LogIn;
