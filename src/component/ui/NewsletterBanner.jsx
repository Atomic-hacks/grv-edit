import React, { useState } from "react";
import Spinner from "./Spinner";
import InlineNotice from "./InlineNotice";

const NewsletterBanner = ({ compact = false }) => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to subscribe.");
      setSubscribed(true);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className={`border-y border-[var(--line)] bg-white ${
        compact ? "px-6 py-6" : "px-[var(--gutter)] py-12 md:py-16"
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Stay close</p>
          <h2 className="section-title mt-1.5">
            {compact
              ? "A little more GRV."
              : "New collections, when they arrive."}
          </h2>
          <p className="body-text mt-2 max-w-md text-sm">
            {subscribed
              ? "Thanks, you're subscribed!"
              : "Quiet discoveries and the occasional reason to look twice."}
          </p>
        </div>

        {!subscribed && (
          <form onSubmit={handleSubmit} className="w-full md:max-w-md">
            <div className="flex items-center border-b border-[var(--ink-900)] pb-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                aria-label="Email address"
                disabled={submitting}
                className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-[var(--ink-300)] disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={submitting}
                className="ml-4 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:text-(--color-accent-orange) disabled:cursor-wait disabled:opacity-50"
              >
                {submitting ? <Spinner label="Joining" /> : "Join"}
              </button>
            </div>
            {error && (
              <InlineNotice tone="error" className="mt-2 text-xs">
                {error}
              </InlineNotice>
            )}
          </form>
        )}
      </div>
    </section>
  );
};

export default NewsletterBanner;
