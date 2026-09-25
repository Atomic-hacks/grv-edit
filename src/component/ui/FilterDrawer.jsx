import React, { useEffect, useState } from "react";
import SidePanel from "./SidePanel";

const formatValue = (value) =>
  String(value)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

// Filters, kept deliberately small: brand and size are already structured,
// color reads off the variant, style is the one admin-managed tag
// dimension. This is not where category/subcategory browsing happens
// anymore — that's the Browse drawer, opening from the other side.
const FilterDrawer = ({
  isOpen,
  onClose,
  appliedFilters,
  onApply,
  facets,
  facetsLoading,
}) => {
  const [draft, setDraft] = useState(appliedFilters);
  const [openGroup, setOpenGroup] = useState("brand");

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

  const clear = () =>
    setDraft({ brand: [], size: [], color: [], style: [], minPrice: "", maxPrice: "" });

  const groups = [
    { key: "brand", label: "Brand", options: facets?.brands?.map((b) => ({ value: b.value, label: b.label, count: b.count })) },
    { key: "size", label: "Size", options: facets?.sizes?.map((s) => ({ value: s.value, label: s.value, count: s.count })) },
    { key: "color", label: "Color", options: facets?.colors?.map((c) => ({ value: c.value, label: c.value, count: c.count })) },
    { key: "style", label: "Style", options: facets?.styles?.map((s) => ({ value: s.value, label: s.label, count: s.count })) },
  ];

  const activeCount =
    (draft.brand?.length || 0) +
    (draft.size?.length || 0) +
    (draft.color?.length || 0) +
    (draft.style?.length || 0) +
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
      {/* Price is its own, always-open row — a range isn't a checklist. */}
      <div className="border-b border-[var(--line)] py-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em]">Price</p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min="0"
            placeholder="Min"
            value={draft.minPrice || ""}
            onChange={(event) => setPrice("minPrice", event.target.value)}
            className="w-full border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--ink-900)]"
          />
          <span className="text-[var(--ink-300)]">–</span>
          <input
            type="number"
            min="0"
            placeholder="Max"
            value={draft.maxPrice || ""}
            onChange={(event) => setPrice("maxPrice", event.target.value)}
            className="w-full border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--ink-900)]"
          />
        </div>
      </div>

      {groups.map((group) => {
        const isExpanded = openGroup === group.key;
        const options = group.options || [];
        return (
          <div key={group.key} className="border-b border-[var(--line)]">
            <button
              type="button"
              onClick={() => setOpenGroup(isExpanded ? null : group.key)}
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
                {facetsLoading && <p className="meta-text col-span-2">Loading…</p>}
                {!facetsLoading && options.length === 0 && (
                  <p className="meta-text col-span-2">Nothing to filter by here.</p>
                )}
                {options.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
                    <input
                      type="checkbox"
                      checked={(draft[group.key] || []).includes(option.value)}
                      onChange={() => toggle(group.key, option.value)}
                      className="accent-(--color-accent-orange)"
                    />
                    <span className="truncate">{formatValue(option.label)}</span>
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
    </SidePanel>
  );
};

export default FilterDrawer;
