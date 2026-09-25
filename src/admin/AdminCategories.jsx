import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import {
  buildCategoryTree,
  flattenCategoryOptions,
  getCategoryPath,
  getDescendantIds,
} from "../lib/categoryTree";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import InlineNotice from "../component/ui/InlineNotice";
import SubmitButton from "../component/ui/SubmitButton";
import Spinner from "../component/ui/Spinner";

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// One row, recursive — a category at any depth renders itself and, when
// expanded, its children the same way. Depth only changes indentation and
// heading weight, never the available actions.
const CategoryRow = ({
  category,
  depth,
  expandedIds,
  toggleExpanded,
  startEdit,
  deleteCategory,
  deletingId,
  resetForm,
}) => {
  const isExpanded = expandedIds.has(category.id);
  const hasChildren = category.children.length > 0;
  return (
    <div className="border-b border-[var(--line)]" style={{ paddingLeft: depth * 20 }}>
      <div className="flex items-center justify-between gap-3 py-3.5">
        <button
          type="button"
          onClick={() => hasChildren && toggleExpanded(category.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {hasChildren ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
              <path d="M3 1.5L7 5l-4 3.5" />
            </svg>
          ) : (
            <span className="block w-2.5 shrink-0" />
          )}
          <span className={depth === 0 ? "truncate text-[14px] font-semibold" : "truncate text-[13px] text-[var(--ink-700)]"}>
            {category.name}
          </span>
          <span className="meta-text shrink-0">/{category.slug}</span>
          {depth === 0 && (
            <span className="flex shrink-0 gap-1">
              {category.showInNav && (
                <span className="border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-[var(--ink-500)]">Nav</span>
              )}
              {category.showOnHomepage && (
                <span className="border border-(--color-accent-orange) px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-(--color-accent-orange)">Homepage</span>
              )}
            </span>
          )}
        </button>
        <span className="meta-text shrink-0">{category.productCount ?? 0} products</span>
        <div className="flex shrink-0 gap-3 text-[11px] font-semibold">
          <button type="button" onClick={() => startEdit(category)} className="text-[var(--ink-700)] underline underline-offset-4 hover:text-[var(--ink-900)]">Edit</button>
          <button
            type="button"
            onClick={() => deleteCategory(category)}
            disabled={deletingId === category.id}
            className="text-red-700 underline underline-offset-4 hover:text-red-900 disabled:opacity-50"
          >
            {deletingId === category.id ? "…" : "Delete"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pb-3">
          {category.children.map((child) => (
            <CategoryRow
              key={child.id}
              category={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              startEdit={startEdit}
              deleteCategory={deleteCategory}
              deletingId={deletingId}
              resetForm={resetForm}
            />
          ))}
          <button
            type="button"
            onClick={() => resetForm(category.id)}
            className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-500)] underline underline-offset-4 hover:text-[var(--ink-900)]"
            style={{ marginLeft: (depth + 1) * 20 }}
          >
            + Add subcategory under {category.name}
          </button>
        </div>
      )}
    </div>
  );
};

const emptyForm = {
  id: null,
  name: "",
  slug: "",
  parentId: "",
  description: "",
  showInNav: false,
  navOrder: 0,
  showOnHomepage: false,
  homepageOrder: "",
};

// One screen for the entire taxonomy — major categories and their
// subcategories are the same model, so create/edit/delete/reorder for
// either happens right here. A row's nav and homepage flags are what used
// to be separate Section/CategoryFilterType concepts.
const AdminCategories = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => request("/api/admin/categories"),
    enabled: Boolean(session),
  });
  const categories = categoriesQuery.data || [];
  const tree = buildCategoryTree(categories);
  // Any category can be a parent now (Men > Accessories > Jewelry), except
  // the one being edited and anything already nested under it — either
  // would create a cycle.
  const excludedParentIds = form.id ? new Set(getDescendantIds(categories, form.id)) : new Set();
  const parentOptions = flattenCategoryOptions(categories).filter(
    (option) => option.id !== form.id && !excludedParentIds.has(option.id),
  );

  const toggleExpanded = (id) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  const resetForm = (parentId = "") =>
    setForm({ ...emptyForm, parentId });

  const startEdit = (category) => {
    clearMessages();
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId || "",
      description: category.description || "",
      showInNav: category.showInNav,
      navOrder: category.navOrder,
      showOnHomepage: category.showOnHomepage,
      homepageOrder: category.homepageOrder ?? "",
    });
    // Reveal the row being edited even if it's nested a few levels deep.
    const ancestorIds = getCategoryPath(categories, category.id).map((c) => c.id);
    setExpandedIds((current) => new Set([...current, ...ancestorIds]));
  };

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async (event) => {
    event.preventDefault();
    clearMessages();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        parentId: form.parentId || null,
        description: form.description || null,
        showInNav: form.showInNav,
        navOrder: Number(form.navOrder) || 0,
        showOnHomepage: form.showOnHomepage,
        homepageOrder: form.homepageOrder === "" ? null : Number(form.homepageOrder),
      };
      if (form.id) {
        await request(`/api/admin/categories/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice(`"${form.name}" updated.`);
      } else {
        await request("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice(`"${form.name}" created.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      resetForm();
    } catch (saveError) {
      setError(saveError.message || "Could not save this category.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    clearMessages();
    setDeletingId(category.id);
    try {
      await request(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNotice(`"${category.name}" deleted.`);
      if (form.id === category.id) resetForm();
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete this category.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="max-w-6xl py-10 md:py-14">
      <AdminPageHeader
        title="Categories"
        subtitle="Major categories and their subcategories — the same list also powers navigation and homepage collections."
      />

      {error && <InlineNotice tone="error" className="mt-6">{error}</InlineNotice>}
      {notice && <InlineNotice tone="success" className="mt-6">{notice}</InlineNotice>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* The tree */}
        <div>
          {categoriesQuery.isPending ? (
            <Spinner label="Loading categories" className="text-[13px] text-[var(--ink-500)]" />
          ) : tree.length === 0 ? (
            <p className="meta-text">No categories yet — create the first one.</p>
          ) : (
            <div className="border-t border-[var(--ink-900)]">
              {tree.map((major) => (
                <CategoryRow
                  key={major.id}
                  category={major}
                  depth={0}
                  expandedIds={expandedIds}
                  toggleExpanded={toggleExpanded}
                  startEdit={startEdit}
                  deleteCategory={deleteCategory}
                  deletingId={deletingId}
                  resetForm={resetForm}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => resetForm()}
            className="mt-6 border border-[var(--ink-900)] px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-900)] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
          >
            + New major category
          </button>
        </div>

        {/* The form */}
        <form onSubmit={save} className="h-fit space-y-5 border border-[var(--line)] p-6 lg:sticky lg:top-6">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
            {form.id ? "Edit category" : "New category"}
          </h2>

          <label className="block text-sm">
            <span className="mb-2 block font-medium">Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium">Slug</span>
            <input
              value={form.slug}
              onChange={(event) => updateField("slug", slugify(event.target.value))}
              placeholder={form.name ? slugify(form.name) : "auto-generated"}
              className="w-full border border-[var(--line)] px-3 py-2.5 font-mono text-xs outline-none focus:border-[var(--ink-900)]"
            />
            <span className="mt-1.5 block text-xs text-[var(--ink-500)]">
              Reachable at /
              {form.parentId
                ? getCategoryPath(categories, form.parentId).map((c) => c.slug).join("/") + "/"
                : ""}
              {form.slug || slugify(form.name) || "…"}
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium">Parent</span>
            <select
              value={form.parentId}
              onChange={(event) => updateField("parentId", event.target.value)}
              className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            >
              <option value="">None — this is a major category</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {"  ".repeat(option.depth)}
                  {option.depth > 0 ? "— " : ""}
                  {option.name}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-[var(--ink-500)]">
              Change this anytime to move a category, and everything nested under it moves with it. Nest as deep as you need — Men &gt; Accessories &gt; Jewelry works fine.
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium">Description</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Optional — shown as the intro copy on the category page."
              className="w-full border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ink-900)]"
            />
          </label>

          <div className="space-y-3 border-t border-[var(--line)] pt-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.showInNav}
                onChange={(event) => updateField("showInNav", event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-(--color-accent-orange)"
              />
              <span>
                <span className="block font-medium">Show in navigation</span>
                <span className="text-xs text-[var(--ink-500)]">Appears in the header menu. Usually only turned on for major categories.</span>
              </span>
            </label>
            {form.showInNav && (
              <label className="block pl-7 text-sm">
                <span className="mb-1.5 block text-xs font-medium">Nav order</span>
                <input
                  type="number"
                  value={form.navOrder}
                  onChange={(event) => updateField("navOrder", event.target.value)}
                  className="w-24 border border-[var(--line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--ink-900)]"
                />
              </label>
            )}

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.showOnHomepage}
                onChange={(event) => updateField("showOnHomepage", event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-(--color-accent-orange)"
              />
              <span>
                <span className="block font-medium">Feature on homepage</span>
                <span className="text-xs text-[var(--ink-500)]">Shows as a curated product rail — this is how "Lifestyle" or a seasonal drop works, no separate section needed.</span>
              </span>
            </label>
            {form.showOnHomepage && (
              <label className="block pl-7 text-sm">
                <span className="mb-1.5 block text-xs font-medium">Homepage order</span>
                <input
                  type="number"
                  value={form.homepageOrder}
                  onChange={(event) => updateField("homepageOrder", event.target.value)}
                  className="w-24 border border-[var(--line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--ink-900)]"
                />
              </label>
            )}
          </div>

          <div className="flex gap-3 border-t border-[var(--line)] pt-4">
            <SubmitButton type="submit" loading={saving} loadingLabel="Saving">
              {form.id ? "Save changes" : "Create category"}
            </SubmitButton>
            {form.id && (
              <button
                type="button"
                onClick={() => resetForm()}
                className="border border-[var(--line)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
};

export default AdminCategories;
