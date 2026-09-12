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
    className={`inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-semibold text-white transition-[background-color,color,transform,opacity] duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-white hover:text-black active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-black disabled:hover:text-white ${className}`.trim()}
    {...props}
  >
    {loading ? <Spinner label={loadingLabel} /> : children}
  </button>
);

export default SubmitButton;
