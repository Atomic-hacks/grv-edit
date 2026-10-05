import React, { useEffect, useState } from "react";

// Debounced search box. `onSearch` receives the settled value, so a
// server-backed list issues one query per pause in typing rather than one
// per keystroke.
const AdminSearch = ({
  value,
  onSearch,
  placeholder = "Search",
  delay = 300,
  className = "",
}) => {
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    if (draft === (value || "")) return undefined;
    const timer = setTimeout(() => onSearch(draft.trim()), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, delay]);

  return (
    <div className={`relative ${className}`}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-300)]"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5 14 14" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="w-full border border-[var(--line)] bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[var(--ink-900)]"
      />
    </div>
  );
};

export default AdminSearch;
