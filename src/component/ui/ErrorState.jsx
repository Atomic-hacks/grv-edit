import React from "react";
import { Link } from "react-router-dom";

const WarningIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3.5 22 20.5H2L12 3.5Z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

const SearchOffIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M19 19l-4.5-4.5" />
    <path d="M8 8l5 5M13 8l-5 5" />
  </svg>
);

const ICONS = {
  error: WarningIcon,
  "not-found": SearchOffIcon,
};

// One block for every "this didn't work" moment on the storefront: a failed
// fetch, a missing product, a broken link. Plain-language copy, a way to
// retry when retrying can plausibly help, and a way out when it can't — never
// just a sentence of red text with nowhere to go.
const ErrorState = ({
  tone = "error",
  title,
  message,
  onRetry,
  retryLabel = "Try again",
  retryPending = false,
  secondaryTo,
  secondaryLabel = "Back to shop",
  className = "",
}) => {
  const Icon = ICONS[tone] || ICONS.error;

  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`flex flex-col items-center gap-4 py-20 text-center md:py-24 ${className}`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-500)]">
        <Icon />
      </span>
      <div>
        <p className="section-title">{title}</p>
        {message && <p className="meta-text mx-auto mt-2 max-w-sm">{message}</p>}
      </div>
      {(onRetry || secondaryTo) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retryPending}
              aria-busy={retryPending}
              className="border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-900)] transition-colors duration-200 hover:bg-[var(--ink-900)] hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              {retryPending ? "Retrying…" : retryLabel}
            </button>
          )}
          {secondaryTo && (
            <Link
              to={secondaryTo}
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorState;
