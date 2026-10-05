import React, { useEffect, useState } from "react";
import SidePanel from "./SidePanel";

const EMPTY_FILTERS = { brand: [], subcategory: [], minPrice: "", maxPrice: "" };

// Three filters, deliberately: Brand, Subcategory, Price. Subcategory
// options are supplied by the page and are always contextual — the
// children of whatever is being browsed — so Footwear never offers
// Knitwear. Category *navigation* lives in the Browse drawer on the other
// side; this only narrows what's already on screen.
const FilterDrawer = ({
  isOpen,
  onClose,
  appliedFilters,
  onApply,
  facets,
  facetsLoading,
}) => {
  const [draft, setDraft] = useState(appliedFilters);
  const [openGroup, setOpenGroup] = useState(null);

  useEffect(() => {
    if (isOpen) setDraft(appliedFilters);
  }, [appliedFilters, isOpen]);

  const toggle = (key, value) => {
    setDraft((current) => {
      const list = current[key] || [];
      return {
        ...current,
        [key]: list.includes(value)
          ? list.filter((item) => item !== value)
          : [...list, value],
      };
    });
  };

  const setPrice = (field, value) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const clear = () => setDraft(EMPTY_FILTERS);

  // A group with a single option filters nothing, so it's hidden — unless
  // the shopper already has something ticked in it and needs to untick it.
  const groups = [
    { key: "subcategory", label: "Category", options: facets?.subcategories || [] },
    { key: "brand", label: "Brand", options: facets?.brands || [] },
  ].filter(
    (group) => group.options.length > 1 || (draft[group.key] || []).length > 0,
  );
  const expandedKey = openGroup ?? groups[0]?.key;

  const activeCount =
    (draft.brand?.length || 0) +
    (draft.subcategory?.length || 0) +
    (draft.minPrice ? 1 : 0) +
    (draft.maxPrice ? 1 : 0);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      side="right"
      title="Filter"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={clear}
            className="border border-[var(--line)] py-3 text-[11px] font-semibold uppercase tracking-[0.12em] hover:bg-[var(--surface-muted)]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="bg-[var(--ink-900)] py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-(--color-accent-orange)"
          >
            Apply{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      }
    >
      {groups.map((group) => {
        const isExpanded = expandedKey === group.key;
        return (
          <div key={group.key} className="border-b border-[var(--line)]">
            <button
              type="button"
              onClick={() => setOpenGroup(isExpanded ? "" : group.key)}
              className="flex w-full items-center justify-between py-5 text-left text-[12px] font-semibold uppercase tracking-[0.12em]"
              aria-expanded={isExpanded}
            >
              {group.label}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className={isExpanded ? "rotate-180" : ""}>
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
            {isExpanded && (
              <div className="grid grid-cols-2 gap-3 pb-5">
                {group.options.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
                    <input
                      type="checkbox"
                      checked={(draft[group.key] || []).includes(option.value)}
                      onChange={() => toggle(group.key, option.value)}
                      className="accent-(--color-accent-orange)"
                    />
                    <span className="truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="text-[var(--ink-300)]">({option.count})</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {facetsLoading && groups.length === 0 && (
        <p className="meta-text py-5">Loading…</p>
      )}

      {/* Price is its own, always-open row — a range isn't a checklist. */}
      <div className="py-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em]">Price</p>
        {facets?.price?.max > 0 && (
          <p className="meta-text mt-1">
            ₦{Number(facets.price.min).toLocaleString()} – ₦{Number(facets.price.max).toLocaleString()} here
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min="0"
            placeholder="Min"
            aria-label="Minimum price"
            value={draft.minPrice || ""}
            onChange={(event) => setPrice("minPrice", event.target.value)}
            className="w-full border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--ink-900)]"
          />
          <span className="text-[var(--ink-300)]">–</span>
          <input
            type="number"
            min="0"
            placeholder="Max"
            aria-label="Maximum price"
            value={draft.maxPrice || ""}
            onChange={(event) => setPrice("maxPrice", event.target.value)}
            className="w-full border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--ink-900)]"
          />
        </div>
      </div>
    </SidePanel>
  );
};

export default FilterDrawer;
