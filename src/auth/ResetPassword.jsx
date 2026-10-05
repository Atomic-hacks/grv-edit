import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import PasswordInput from "../component/ui/PasswordInput";
import InlineNotice from "../component/ui/InlineNotice";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session) {
        setRecoveryReady(true);
        setCheckingRecovery(false);
      }
    };

    checkSession().finally(() => {
      if (mounted) setCheckingRecovery(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryReady(true);
        setCheckingRecovery(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message || "Could not update your password.");
      return;
    }

    await supabase.auth.signOut();
    navigate("/login?reset=success", { replace: true });
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-24">
      <p className="text-xs font-semibold uppercase tracking-[1px] text-gray-500">
        Account access
      </p>
      <h1 className="mt-4 text-3xl font-semibold">Set a new password</h1>

      {checkingRecovery && (
        <p className="mt-6 text-sm text-gray-600">Checking your reset link…</p>
      )}

      {!checkingRecovery && !recoveryReady && (
        <div className="mt-6 space-y-4 text-sm leading-6 text-gray-600">
          <p>This reset link is missing or has expired.</p>
          <a
            href="/forgot-password"
            className="inline-block font-semibold text-black underline underline-offset-4"
          >
            Request a new link
          </a>
        </div>
      )}

      {!checkingRecovery && recoveryReady && (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <PasswordInput
            id="reset-new-password"
            label="New password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <PasswordInput
            id="reset-confirm-password"
            label="Confirm new password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <InlineNotice tone="error">{error}</InlineNotice>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
};

export default ResetPassword;
