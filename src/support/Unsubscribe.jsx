import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Spinner from "../component/ui/Spinner";
import ErrorState from "../component/ui/ErrorState";

// A real unsubscribe: one click from the email, no login, and the opt-out is
// recorded before this page says it was.
const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState({ status: "working", email: "" });

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid" });
      return;
    }
    let cancelled = false;
    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Unsubscribe failed");
        return body;
      })
      .then((body) => {
        if (!cancelled) setState({ status: "done", email: body.email });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "invalid" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="page-shell flex min-h-[60vh] items-center justify-center py-24">
      <div className="max-w-md text-center">
        {state.status === "working" && (
          <Spinner label="Updating your preferences" className="text-sm text-[var(--ink-500)]" />
        )}

        {state.status === "done" && (
          <>
            <h1 className="section-title">You've been unsubscribed</h1>
            <p className="meta-text mt-3">
              {state.email ? `${state.email} will` : "You will"} no longer
              receive promotional email from GRV. You'll still get order
              confirmations and delivery updates for anything you buy.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-block border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
            >
              Back to GRV
            </Link>
          </>
        )}

        {state.status === "invalid" && (
          <ErrorState
            tone="not-found"
            title="This unsubscribe link isn't valid"
            message="It may have already been used, or the link was cut short by your email client. You can manage promotional email from your account settings."
            secondaryTo="/account?section=details"
            secondaryLabel="Account settings"
          />
        )}
      </div>
    </main>
  );
};

export default Unsubscribe;
