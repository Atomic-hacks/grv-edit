import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import AdminSearch from "../component/admin/AdminSearch";
import AdminList from "../component/admin/AdminList";

const AdminProducts = () => {
  const { session } = useAuth();
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = normalizedQuery
    ? products.filter((product) =>
        [product.name, product.brandName, ...(product.categories || []).map((c) => c.name)]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
    : products;

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
          <Link
            to="/admin/products/new"
            className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-2.5 text-[12px] font-semibold text-white transition-colors hover:border-(--color-accent-orange) hover:bg-(--color-accent-orange)"
          >
            New product
          </Link>
        }
      />


      <div className="mt-6">
        <AdminSearch
          value={query}
          onSearch={setQuery}
          placeholder="Search by name, brand, or subcategory"
          className="sm:max-w-sm"
        />
      </div>

      <div className="mt-6">
        <AdminList
          columns={[
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
                  {(product.categories || []).map((c) => c.name).join(", ") || "—"}
                </span>
              ),
            },
            {
              key: "flags",
              label: "Flags",
              render: (product) => (
                <span className="flex gap-1.5">
                  {product.isNew && (
                    <span className="border border-[var(--line)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--ink-500)]">New</span>
                  )}
                  {product.featured && (
                    <span className="border border-(--color-accent-orange) px-1.5 py-0.5 text-[10px] uppercase text-(--color-accent-orange)">Featured</span>
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
                  return <span className="text-[var(--ink-300)]">No variants</span>;
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
          emptyTitle={normalizedQuery ? "No products match" : "No products yet"}
          emptyMessage={
            normalizedQuery
              ? `Nothing matches "${query.trim()}".`
              : "Add your first product to get started."
          }
          actions={(product) => (
            <>
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
      </div>
    </main>
  );
};

export default AdminProducts;
