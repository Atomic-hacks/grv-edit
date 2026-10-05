import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import AdminSearch from "../component/admin/AdminSearch";
import AdminList from "../component/admin/AdminList";
import InlineNotice from "../component/ui/InlineNotice";
import ListToolbar, { ShowMore } from "../component/admin/ListToolbar";
import { useListControls, byText, byNumber, byDate } from "../lib/useListControls";

const LOW_STOCK_AT = 3;

const PRODUCT_SORTS = [
  { value: "newest", label: "Newest first", compare: byDate((p) => p.createdAt, -1) },
  { value: "oldest", label: "Oldest first", compare: byDate((p) => p.createdAt) },
  { value: "name", label: "Name A–Z", compare: byText((p) => p.name) },
  { value: "brand", label: "Brand A–Z", compare: byText((p) => p.brandName) },
  { value: "stock-low", label: "Lowest stock", compare: byNumber((p) => stockOf(p)) },
  { value: "stock-high", label: "Highest stock", compare: byNumber((p) => stockOf(p), -1) },
];

const stockOf = (product) =>
  (product.variants || []).reduce((sum, variant) => sum + (variant.stock ?? 0), 0);

// Where a product sits for the stock tabs. A product with no variants can't
// be bought at all, so it counts as out of stock rather than being invisible
// to the filter that exists to catch exactly that.
const stockState = (product) => {
  const total = stockOf(product);
  if (!product.variants?.length || total <= 0) return "out";
  const lowestVariant = Math.min(...product.variants.map((variant) => variant.stock ?? 0));
  return total <= LOW_STOCK_AT || lowestVariant <= LOW_STOCK_AT ? "low" : "ok";
};

const FILTERS = [
  { key: "all", label: "All", test: (p) => !p.archived },
  { key: "low", label: "Low stock", test: (p) => !p.archived && stockState(p) === "low" },
  { key: "out", label: "Out of stock", test: (p) => !p.archived && stockState(p) === "out" },
  { key: "featured", label: "Featured", test: (p) => !p.archived && p.featured },
  { key: "archived", label: "Archived", test: (p) => p.archived },
];

const AdminProducts = () => {
  const { session } = useAuth();
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [stockDelta, setStockDelta] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => request("/api/admin/products"),
    enabled: Boolean(session),
  });
  const products = productsQuery.data || [];
  const loading = productsQuery.isPending;
  const displayError = error || productsQuery.error?.message;

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => request("/api/admin/categories"),
    enabled: Boolean(session),
  });
  const categoryOptions = useMemo(() => {
    const all = categoriesQuery.data || [];
    const byId = new Map(all.map((category) => [category.id, category]));
    return all
      .map((category) => {
        const path = [];
        for (let node = category; node; node = node.parentId ? byId.get(node.parentId) : null) {
          path.unshift(node.name);
        }
        return { id: category.id, label: path.join(" › ") };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoriesQuery.data]);

  const activeFilter = FILTERS.find((item) => item.key === filter) || FILTERS[0];
  const counts = Object.fromEntries(
    FILTERS.map((item) => [item.key, products.filter(item.test).length]),
  );
  const filtered = products.filter(activeFilter.test);

  const normalizedQuery = query.trim().toLowerCase();
  const matchedProducts = normalizedQuery
    ? filtered.filter((product) =>
        [
          product.name,
          product.brandName,
          ...(product.categories || []).map((c) => c.name),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
    : filtered;

  const controls = useListControls(matchedProducts, { sorts: PRODUCT_SORTS });
  const visibleProducts = controls.visible;

  const visibleIds = visibleProducts.map((product) => product.id);
  const selectedIds = visibleIds.filter((id) => selected.has(id));
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length;

  const toggleOne = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  const changeFilter = (key) => {
    setFilter(key);
    setSelected(new Set());
    setNotice("");
  };

  // Every bulk action goes through the same call so the busy state, error
  // handling and refresh can't drift apart between buttons.
  const runBulk = async (path, body, describe) => {
    if (!selectedIds.length) return;
    setError("");
    setNotice("");
    setBulkBusy(true);
    try {
      const result = await request(`/api/admin/products/bulk/${path}`, {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds, ...body }),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      setNotice(describe(result));
      setSelected(new Set());
    } catch (bulkError) {
      setError(bulkError.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const archiveSelected = (archived) =>
    runBulk("archived", { archived }, (result) => {
      const skipped = result.skipped?.length || 0;
      return `${result.updated} product${result.updated === 1 ? "" : "s"} ${archived ? "archived" : "restored"}${
        skipped ? `. ${skipped} skipped — only fully sold-out products can be archived.` : "."
      }`;
    });

  const adjustStock = () => {
    const delta = Number(stockDelta);
    if (!Number.isInteger(delta) || delta === 0) {
      setError("Enter a whole number to add or remove, e.g. 5 or -2.");
      return;
    }
    return runBulk("stock", { delta }, (result) => {
      setStockDelta("");
      return `Stock ${delta > 0 ? "increased" : "reduced"} by ${Math.abs(delta)} on every size of ${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"}${result.variantsUpdated ? ` (${result.variantsUpdated} variants)` : ""}.`;
    });
  };

  const recategorize = () => {
    if (!categoryId) {
      setError("Choose a category first.");
      return;
    }
    if (!window.confirm("This replaces the selected products' categories with the one you chose. Continue?")) return;
    return runBulk("categories", { categoryIds: [categoryId] }, (result) => {
      setCategoryId("");
      return `${result.updated} product${result.updated === 1 ? "" : "s"} moved.`;
    });
  };

  const deleteProduct = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setError("");
    setDeletingId(id);
    try {
      await request(`/api/admin/products/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "products"],
      });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId(null);
    }
  };

  const getImage = (product) =>
    product.imageUrl ||
    product.variants?.find((variant) => variant.images?.[0])?.images?.[0];

  return (
    <main className="max-w-7xl py-12 md:py-16">
      <AdminPageHeader
        title="Products"
        count={loading ? undefined : `${products.length} total`}
        actions={
          <>
            <a
              href="/api/admin/export/products"
              className="border border-[var(--line)] px-4 py-2.5 text-[12px] font-semibold text-[var(--ink-700)] transition-colors hover:border-[var(--ink-900)]"
            >
              Export CSV
            </a>
            <Link
              to="/admin/products/new"
              className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-2.5 text-[12px] font-semibold text-white transition-colors hover:border-(--color-accent-orange) hover:bg-(--color-accent-orange)"
            >
              New product
            </Link>
          </>
        }
      />

      <div className="mt-6">
        <AdminSearch
          value={query}
          onSearch={setQuery}
          placeholder="Search by name, brand, or subcategory"
          className="sm:max-w-sm"
        />
        <div className="mt-3">
          <ListToolbar controls={controls} hideSearch noun="products" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--line)]">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => changeFilter(item.key)}
            aria-pressed={filter === item.key}
            className={`-mb-px border-b-2 pb-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors ${
              filter === item.key
                ? "border-[var(--ink-900)] text-[var(--ink-900)]"
                : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            }`}
          >
            {item.label}
            <span className="ml-1.5 font-normal text-[var(--ink-300)]">{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {notice && <InlineNotice tone="success" className="mt-4">{notice}</InlineNotice>}

      {selectedIds.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border border-[var(--ink-900)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
          <span className="font-semibold">{selectedIds.length} selected</span>
          <button type="button" disabled={bulkBusy} onClick={() => archiveSelected(true)} className="underline underline-offset-4 disabled:opacity-50">
            Archive
          </button>
          <button type="button" disabled={bulkBusy} onClick={() => archiveSelected(false)} className="underline underline-offset-4 disabled:opacity-50">
            Restore
          </button>
          <span className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              value={stockDelta}
              onChange={(event) => setStockDelta(event.target.value)}
              placeholder="± stock"
              aria-label="Stock to add or remove on every size"
              className="w-24 border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
            />
            <button type="button" disabled={bulkBusy || !stockDelta} onClick={adjustStock} className="underline underline-offset-4 disabled:opacity-50">
              Adjust stock
            </button>
          </span>
          <span className="flex items-center gap-2">
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label="Move to category"
              className="max-w-52 border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Move to category…</option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <button type="button" disabled={bulkBusy || !categoryId} onClick={recategorize} className="underline underline-offset-4 disabled:opacity-50">
              Move
            </button>
          </span>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[var(--ink-500)] underline underline-offset-4">
            Clear selection
          </button>
        </div>
      )}

      <div className="mt-4">
        <AdminList
          columns={[
            {
              key: "select",
              mobile: "hidden",
              className: "w-8",
              label: (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={!visibleIds.length}
                  aria-label="Select all products shown"
                />
              ),
              render: (product) => (
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={() => toggleOne(product.id)}
                  aria-label={`Select ${product.name}`}
                />
              ),
            },
            {
              key: "product",
              label: "Product",
              mobile: "title",
              render: (product) => (
                <span className="flex items-center gap-3">
                  {getImage(product) ? (
                    <img
                      src={getImage(product)}
                      alt=""
                      className="h-12 w-9 shrink-0 object-cover md:h-14 md:w-11"
                    />
                  ) : (
                    <span className="h-12 w-9 shrink-0 bg-[var(--surface-muted)] md:h-14 md:w-11" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium text-[var(--ink-900)]">
                      {product.name}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[var(--ink-500)]">
                      {product.brandName || "No brand"}
                    </span>
                  </span>
                </span>
              ),
            },
            {
              key: "categories",
              label: "Categories",
              render: (product) => (
                <span className="text-[var(--ink-700)]">
                  {(product.categories || []).map((c) => c.name).join(", ") ||
                    "—"}
                </span>
              ),
            },
            {
              key: "flags",
              label: "Flags",
              render: (product) => (
                <span className="flex gap-1.5">
                  {product.isNew && (
                    <span className="border border-[var(--line)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--ink-500)]">
                      New
                    </span>
                  )}
                  {product.archived && (
                    <span className="border border-[var(--ink-900)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--ink-900)]">
                      Archived
                    </span>
                  )}
                  {product.featured && (
                    <span className="border border-(--color-accent-orange) px-1.5 py-0.5 text-[10px] uppercase text-(--color-accent-orange)">
                      Featured
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: "stock",
              label: "Stock",
              render: (product) => {
                const total = (product.variants || []).reduce(
                  (sum, variant) => sum + (variant.stock ?? 0),
                  0,
                );
                if (!product.variants?.length) {
                  return (
                    <span className="text-[var(--ink-300)]">No variants</span>
                  );
                }
                return (
                  <span
                    className={
                      total <= 0
                        ? "font-semibold text-red-700"
                        : total <= 3
                          ? "font-semibold text-(--color-accent-orange)"
                          : "text-[var(--ink-700)]"
                    }
                  >
                    {total <= 0 ? "Out of stock" : `${total} in stock`}
                  </span>
                );
              },
            },
          ]}
          rows={visibleProducts}
          loading={loading}
          error={displayError}
          onRetry={() => productsQuery.refetch()}
          emptyTitle={normalizedQuery || filter !== "all" ? "No products match" : "No products yet"}
          emptyMessage={
            normalizedQuery
              ? `Nothing matches "${query.trim()}".`
              : filter !== "all"
                ? "Nothing in this view right now."
                : "Add your first product to get started."
          }
          actions={(product) => (
            <>
              <Link
                to={`/product/${product.id}`}
                target="_blank"
                rel="noreferrer"
                className="mr-4 text-[12px] font-semibold text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
              >
                View
              </Link>
              <Link
                to={`/admin/products/${product.id}/edit`}
                className="text-[12px] font-semibold text-[var(--ink-700)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => deleteProduct(product.id, product.name)}
                disabled={deletingId === product.id}
                className="ml-4 text-[12px] font-semibold text-red-700 underline underline-offset-4 transition-colors hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === product.id ? "Deleting…" : "Delete"}
              </button>
            </>
          )}
        />
        <ShowMore controls={controls} />
      </div>
    </main>
  );
};

export default AdminProducts;
