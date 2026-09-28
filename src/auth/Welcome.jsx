import React from "react";
import { Link } from "react-router-dom";
import RequireAuth from "../component/auth/RequireAuth";
import { useAuth } from "../context/AuthContext";
import FadeIn from "../component/ui/FadeIn";

// Shown once, right after a fresh sign-up (password or Google) — landing a
// brand-new customer silently on the storefront read as "did that even
// work?"; this confirms the account exists and gives them somewhere to go
// next instead of dropping them back where they started.
const WelcomeContent = () => {
  const { appUser, user } = useAuth();
  const firstName = (appUser?.name || "").split(" ")[0];

  return (
    <main className="page-shell flex min-h-screen items-center justify-center py-24 text-center">
      <FadeIn className="mx-auto max-w-md">
        <p className="eyebrow">Welcome to GRV</p>
        <h1 className="display-title mt-2 text-4xl md:text-5xl">
          {firstName ? `You're in, ${firstName}` : "Your account is ready"}
        </h1>
        <p className="body-text mt-4 text-sm">
          {user?.email ? `${user.email} is now signed in. ` : ""}
          Your account is set up — track orders, save addresses, and check out
          faster from here on.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/shop"
            className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-white hover:text-[var(--ink-900)]"
          >
            Continue shopping
          </Link>
          <Link
            to="/account"
            className="border border-[var(--line)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-700)] transition-colors hover:border-[var(--ink-900)]"
          >
            Go to my account
          </Link>
        </div>
      </FadeIn>
    </main>
  );
};

const Welcome = () => (
  <RequireAuth>
    <WelcomeContent />
  </RequireAuth>
);

export default Welcome;
