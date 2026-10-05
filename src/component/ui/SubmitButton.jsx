import React from "react";
import Spinner from "./Spinner";

const SubmitButton = ({
  children,
  loading = false,
  loadingLabel = "Working...",
  className = "",
  disabled = false,
  ...props
}) => (
  <button
    type="button"
    disabled={disabled || loading}
    aria-busy={loading}
    className={`inline-flex items-center justify-center gap-2 border border-[var(--ink-900)] bg-[var(--ink-900)] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-[background-color,color,border-color] duration-200 ease-out hover:bg-white hover:text-[var(--ink-900)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--ink-900)] disabled:hover:text-white ${className}`.trim()}
    {...props}
  >
    {loading ? <Spinner label={loadingLabel} /> : children}
  </button>
);

export default SubmitButton;
