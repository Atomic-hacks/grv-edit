import React from "react";

// Search box + sort menu + "showing N of M" for an admin list driven by
// useListControls. `children` is for page-specific filters (status tabs etc.).
const ListToolbar = ({ controls, placeholder = "Search", noun = "items", hideSearch = false, children }) => {
  const { query, setQuery, sortKey, setSortKey, sorts, matched, total } = controls;
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!hideSearch && (
        <div className="relative min-w-56 flex-1">
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full border border-[var(--line)] bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[var(--ink-900)]"
          />
        </div>
        )}
        {sorts.length > 1 && (
          <label className="flex items-center gap-2 text-[12px] text-[var(--ink-500)]">
            Sort
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value)}
              className="border border-[var(--line)] bg-white px-3 py-2.5 text-[13px] text-[var(--ink-900)] outline-none focus:border-[var(--ink-900)]"
            >
              {sorts.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {children}
      </div>
      <p className="text-[12px] text-[var(--ink-500)]" aria-live="polite">
        {matched === total ? `${total} ${noun}` : `${matched} of ${total} ${noun}`}
        {query && matched === 0 && " — nothing matches your search."}
      </p>
    </div>
  );
};

export const ShowMore = ({ controls }) =>
  controls.hasMore ? (
    <div className="mt-4 text-center">
      <button
        type="button"
        onClick={controls.showMore}
        className="border border-[var(--line)] px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors hover:border-[var(--ink-900)]"
      >
        Show more ({controls.matched - controls.visible.length} left)
      </button>
    </div>
  ) : null;

export default ListToolbar;
