import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  emptyFilters,
  filterGroups,
  filterProducts,
  getFilterValues,
} from "../../data/listing";

const formatValue = (value) =>
  value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const FilterDrawer = ({
  isOpen,
  onClose,
  products,
  appliedFilters,
  onApply,
  activeCategoryId,
  categories = [],
  facetOptions = [],
  onFacetSelect,
}) => {
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const [openGroup, setOpenGroup] = useState(null);

  useEffect(() => {
    if (isOpen) setDraftFilters(appliedFilters);
  }, [appliedFilters, isOpen]);

  const matchingCount = useMemo(
    () => filterProducts(products, draftFilters).length,
    [draftFilters, products],
  );

  const toggleValue = (key, value) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };

  const clearFilters = () => setDraftFilters(emptyFilters());

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Motion.button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <Motion.aside
            aria-label="Product filters"
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white text-[var(--ink-900)] shadow-[-8px_0_40px_rgba(0,0,0,0.12)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-5">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em]">
                Filter
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-500)] transition-colors hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6">
              {facetOptions.length > 0 && (
                <div className="border-b border-[var(--line)] py-5">
                  <p className="eyebrow">Browse catalogue</p>
                  <div className="mt-3 space-y-0.5">
                    {facetOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onFacetSelect?.(option)}
                        className={`block w-full py-1.5 text-left text-[13px] transition-colors hover:text-(--color-accent-orange) ${
                          option.active
                            ? "font-semibold text-(--color-accent-orange)"
                            : "text-[var(--ink-700)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filterGroups.map((group) => {
                const values = getFilterValues(
                  products,
                  group.key,
                  activeCategoryId,
                  categories,
                );
                const isExpanded = openGroup === group.key;
                return (
                  <div key={group.key} className="border-b border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroup(isExpanded ? null : group.key)
                      }
                      className="flex w-full items-center justify-between gap-3 py-5 text-left"
                      aria-expanded={isExpanded}
                    >
                      <span className="text-[12px] font-semibold uppercase tracking-[0.12em]">
                        {group.label}
                        {draftFilters[group.key].length > 0 && (
                          <span className="ml-2 font-normal normal-case tracking-normal text-[var(--ink-500)]">
                            {draftFilters[group.key].length} selected
                          </span>
                        )}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className={`shrink-0 transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        <path d="M2 4l4 4 4-4" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="grid grid-cols-2 gap-x-4 pb-4">
                        {values.map((value) => (
                          <label
                            key={value}
                            className="flex min-h-10 cursor-pointer items-center gap-2.5 py-1 text-[13px] text-[var(--ink-700)] transition-colors hover:text-[var(--ink-900)]"
                          >
                            <input
                              type="checkbox"
                              checked={draftFilters[group.key].includes(value)}
                              onChange={() => toggleValue(group.key, value)}
                              className="h-4 w-4 shrink-0 accent-(--color-accent-orange)"
                            />
                            <span className="min-w-0 truncate">
                              {formatValue(value)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-[1fr_1.6fr] gap-3 border-t border-[var(--line)] px-6 py-5">
              <button
                type="button"
                onClick={clearFilters}
                className="border border-[var(--line)] py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[var(--ink-900)]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => onApply(draftFilters)}
                className="bg-[var(--ink-900)] py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-(--color-accent-orange)"
              >
                Show {matchingCount} {matchingCount === 1 ? "item" : "items"}
              </button>
            </div>
          </Motion.aside>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default FilterDrawer;
