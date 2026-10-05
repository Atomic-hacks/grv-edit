import React, { useState } from "react";
import { getCategoryHref } from "../lib/categoryTree";

const STATIC_PAGES = [
  ["/shop", "Shop"],
  ["/catalogues", "Departments"],
  ["/shop/new-arrivals", "New arrivals"],
  ["/brands", "All brands"],
  ["/shop-by", "Shop by"],
  ["/journal", "Journal"],
  ["/about", "About"],
  ["/contact", "Contact"],
  ["/archive", "Archive"],
];

const inputClass = "w-full border border-[var(--line)] px-2 py-1.5 text-sm";

// A link is picked, never typed blind: an existing category, a brand, a
// fixed page, a brand-new category (created when the section is saved, at
// the top level or under any parent), or a custom URL. Picking from lists is
// what stops a section pointing at a page that doesn't exist.
const LinkPicker = ({ value, onChange, pending, onPendingChange, categories, categoryOptions, brands }) => {
  const initialMode = () => {
    if (pending) return "new";
    if (!value) return "category";
    if (/^https?:\/\//i.test(value)) return "custom";
    if (value.startsWith("/brands/")) return "brand";
    if (STATIC_PAGES.some(([href]) => href === value)) return "page";
    if (categoryOptions.some((option) => getCategoryHref(categories, option.id) === value)) return "category";
    return "custom";
  };
  const [mode, setMode] = useState(initialMode);

  const changeMode = (next) => {
    setMode(next);
    if (next === "new") {
      onChange("");
      onPendingChange({ name: "", parentId: "" });
    } else {
      onPendingChange(null);
      if (next !== "custom") onChange("");
    }
  };

  const brandValue = value.startsWith("/brands/") ? value : "";
  const categoryValue =
    categoryOptions.find((option) => getCategoryHref(categories, option.id) === value)?.id || "";

  return (
    <div className="space-y-1.5">
      <select value={mode} onChange={(event) => changeMode(event.target.value)} className={inputClass} aria-label="Link type">
        <option value="category">Link to a category</option>
        <option value="new">Create a new category</option>
        <option value="brand">Link to a brand</option>
        <option value="page">Link to a page</option>
        <option value="custom">Custom URL</option>
      </select>

      {mode === "category" && (
        <select required value={categoryValue} onChange={(event) => onChange(getCategoryHref(categories, event.target.value))} className={inputClass}>
          <option value="">Choose a category…</option>
          {categoryOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      )}

      {mode === "new" && pending && (
        <div className="space-y-1.5 border border-dashed border-[var(--line)] p-2">
          <input
            required
            placeholder="New category name, e.g. Lifestyle"
            value={pending.name}
            onChange={(event) => onPendingChange({ ...pending, name: event.target.value })}
            className={inputClass}
          />
          <select value={pending.parentId} onChange={(event) => onPendingChange({ ...pending, parentId: event.target.value })} className={inputClass}>
            <option value="">Top-level category</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>Inside: {option.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-[var(--ink-500)]">Created automatically when you save, and this link will point to it.</p>
        </div>
      )}

      {mode === "brand" && (
        <select required value={brandValue} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          <option value="">Choose a brand…</option>
          {brands.map((brand) => (
            <option key={brand.id} value={`/brands/${brand.slug || brand.id}`}>{brand.name}</option>
          ))}
        </select>
      )}

      {mode === "page" && (
        <select required value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          <option value="">Choose a page…</option>
          {STATIC_PAGES.map(([href, label]) => (
            <option key={href} value={href}>{label}</option>
          ))}
        </select>
      )}

      {mode === "custom" && (
        <input required value={value} onChange={(event) => onChange(event.target.value)} placeholder="/path or https://…" className={inputClass} />
      )}
    </div>
  );
};

export default LinkPicker;
