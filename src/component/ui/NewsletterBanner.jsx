import React, { useState } from "react";
import Spinner from "./Spinner";

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
      className={`border-y border-black bg-white px-6 py-10 md:px-12 ${compact ? "px-5 py-6" : ""}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Stay close
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {compact
              ? "A little more GRV."
              : "New collections, when they arrive."}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
            {subscribed
              ? "Thanks, you're subscribed!"
              : "Quiet discoveries and the occasional reason to look twice."}
          </p>
        </div>

        {!subscribed && (
          <form onSubmit={handleSubmit} className="w-full md:max-w-md">
            <div className="flex border-b border-black pb-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                aria-label="Email address"
                disabled={submitting}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={submitting}
                className="ml-4 text-sm font-semibold transition-colors hover:text-(--color-accent-orange) disabled:cursor-wait disabled:opacity-50"
              >
                {submitting ? <Spinner label="Joining" /> : "JOIN"}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
};

export default NewsletterBanner;
