import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../component/ui/PasswordInput";
import InlineNotice from "../component/ui/InlineNotice";
import GoogleSignInButton from "../component/ui/GoogleSignInButton";

const SignUp = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp({ email, password, name });
      navigate(
        `/confirm-email?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(returnTo)}`,
        { replace: true },
      );
    } catch (err) {
      setError(err.message || "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <div className="mt-6">
        <GoogleSignInButton returnTo={returnTo} onError={setError} />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.1em] text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        or
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
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
        <PasswordInput
          id="signup-password"
          label="Password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <PasswordInput
          id="signup-confirm-password"
          label="Confirm password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        {confirmPassword && password !== confirmPassword && (
          <InlineNotice tone="error">Passwords do not match.</InlineNotice>
        )}
        <InlineNotice tone="error">{error}</InlineNotice>
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
