import React from "react";

const ICONS = {
  error: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="5.75" />
      <path d="M7 4.3v3" />
      <circle cx="7" cy="9.7" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  success: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.3 5.8 10 11 3.8" />
    </svg>
  ),
};

const TONES = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

// One look for every inline form message on the storefront — a failed
// sign-in, a mismatched password, a saved profile. An icon plus plain
// language, instead of a bare line of red text a shopper can miss entirely.
const InlineNotice = ({ tone = "error", children, className = "" }) => {
  if (!children) return null;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 border px-4 py-3 text-[13px] leading-relaxed ${TONES[tone]} ${className}`}
    >
      <span className="mt-0.5 shrink-0">{ICONS[tone]}</span>
      <span>{children}</span>
    </p>
  );
};

export default InlineNotice;
