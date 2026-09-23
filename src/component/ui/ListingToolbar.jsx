import React from "react";

// Sort labels shown to shoppers. Keys match PRODUCT_SORT_ORDERS in the API.
const SORT_OPTIONS = [
  { value: "", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Alphabetical" },
];

const FilterIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M1.5 3.5h11M3.5 7h7M5.5 10.5h3" />
  </svg>
);

const ListingToolbar = ({
  leftContent,
  onFilter,
  activeFilterCount = 0,
  onViewAll,
  label = "VIEW ALL",
  sort,
  onSortChange,
  onClearFilters,
  chips = [],
}) => {
  return (
    // Sticky, so sort and filter stay reachable however far a shopper has
    // scrolled into a long grid instead of forcing a scroll back to the top.
    <div className="sticky top-[var(--nav-h)] z-30 -mx-[var(--gutter)] mb-8 border-b border-[var(--line)] bg-white/98 px-[var(--gutter)]">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-900)] transition-colors hover:text-[var(--color-accent-orange)]"
            >
              {label}
            </button>
          ) : null}
          {leftContent}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {onSortChange ? (
            <label className="flex items-center gap-2">
              <span className="sr-only">Sort products by</span>
              <span
                aria-hidden="true"
                className="hidden text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)] sm:inline"
              >
                Sort
              </span>
              <select
                value={sort || ""}
                onChange={(event) => onSortChange(event.target.value)}
                className="cursor-pointer border border-transparent bg-transparent py-1.5 pl-1 pr-5 text-xs font-semibold text-[var(--ink-900)] outline-none transition-colors hover:border-[var(--line)]"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value || "featured"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={onFilter}
            aria-label={
              activeFilterCount > 0
                ? `Filter, ${activeFilterCount} applied`
                : "Filter"
            }
            className="inline-flex items-center gap-2 border border-[var(--ink-900)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-900)] transition-colors duration-200 hover:bg-[var(--ink-900)] hover:text-white"
          >
            <FilterIcon />
            Filter
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center bg-[var(--color-accent-orange)] px-1 text-[10px] leading-none text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Applied filters, visible and individually removable. Previously the
          only clue was a count on the Filter button, so shoppers had to open
          the drawer to find out why the grid was short. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-3">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.label}`}
              className="group inline-flex items-center gap-1.5 border border-[var(--line)] py-1 pl-2.5 pr-2 text-[11px] text-[var(--ink-700)] transition-colors hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
            >
              {chip.label}
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
                className="text-[var(--ink-300)] transition-colors group-hover:text-[var(--ink-900)]"
              >
                <path d="M8 2L2 8M2 2l6 6" />
              </svg>
            </button>
          ))}
          {onClearFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
            >
              Clear all
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ListingToolbar;
