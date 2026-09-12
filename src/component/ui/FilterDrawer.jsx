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
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white text-black shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <h2 className="text-lg font-semibold">Filter</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50"
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
                <div className="border-b border-gray-200 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Browse catalogue
                  </p>
                  <div className="mt-4 space-y-3">
                    {facetOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onFacetSelect?.(option)}
                        className={`block w-full text-left text-sm font-medium ${option.active ? "text-(--color-accent-orange)" : "text-black"}`}
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
                  <div key={group.key} className="border-b border-gray-200">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroup(isExpanded ? null : group.key)
                      }
                      className="flex w-full items-center justify-between py-5 text-left text-sm font-semibold"
                      aria-expanded={isExpanded}
                    >
                      {group.label}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className={isExpanded ? "rotate-180" : ""}
                      >
                        <path d="M2 4l4 4 4-4" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="grid grid-cols-2 gap-3 pb-5">
                        {values.map((value) => (
                          <label
                            key={value}
                            className="flex items-center gap-2 text-sm text-gray-600"
                          >
                            <input
                              type="checkbox"
                              checked={draftFilters[group.key].includes(value)}
                              onChange={() => toggleValue(group.key, value)}
                              className="accent-(--color-accent-orange)"
                            />
                            {formatValue(value)}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-gray-200 px-6 py-5">
              <button
                type="button"
                onClick={clearFilters}
                className="border border-gray-300 py-3 text-sm font-semibold hover:bg-gray-50"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => onApply(draftFilters)}
                className="bg-(--color-accent-orange) py-3 text-sm font-semibold text-white hover:brightness-90"
              >
                APPLY ({matchingCount})
              </button>
            </div>
          </Motion.aside>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default FilterDrawer;
