import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const AdminBrands = () => {
  const { session } = useAuth();
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  const queryClient = useQueryClient();
  const brandsQuery = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: () => request("/api/admin/brands"),
    enabled: Boolean(session),
  });
  const brands = brandsQuery.data || [];
  const loading = brandsQuery.isPending;
  const displayError = error || brandsQuery.error?.message;

  const deleteBrand = async (brand) => {
    if (!window.confirm(`Delete ${brand.name}?`)) return;

    setError("");
    setDeletingId(brand.id);
    try {
      await request(`/api/admin/brands/${brand.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
          >
            Admin
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Brands</h1>
        </div>
        <Link
          to="/admin/brands/new"
          className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink-900)]"
        >
          New Brand
        </Link>
      </div>

      {displayError && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {displayError}
        </div>
      )}

      <div className="mt-8 overflow-x-auto border-t border-[var(--ink-900)]">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
            <tr>
              <th className="px-3 py-4 font-medium">Logo</th>
              <th className="px-3 py-4 font-medium">Name</th>
              <th className="px-3 py-4 font-medium">Products</th>
              <th className="px-3 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="4" className="px-3 py-8 text-[var(--ink-500)]">
                  <Spinner label="Loading brands" />
                </td>
              </tr>
            )}
            {!loading && brands.length === 0 && (
              <tr>
                <td colSpan="4" className="px-3 py-8 text-[var(--ink-500)]">
                  No brands yet.
                </td>
              </tr>
            )}
            {brands.map((brand) => (
              <tr
                key={brand.id}
                className="border-b border-[var(--line)] align-middle"
              >
                <td className="px-3 py-3">
                  {brand.logo ? (
                    <img
                      src={brand.logo}
                      alt=""
                      className="h-14 w-14 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-[var(--ink-300)]">No logo</span>
                  )}
                </td>
                <td className="px-3 py-3 font-medium">{brand.name}</td>
                <td className="px-3 py-3">{brand._count?.products ?? 0}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-4">
                    <Link
                      to={`/admin/brands/${brand.id}/edit`}
                      className="text-sm underline"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteBrand(brand)}
                      disabled={deletingId === brand.id}
                      className="text-sm text-red-700 underline"
                    >
                      {deletingId === brand.id ? (
                        <Spinner label="Deleting" />
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default AdminBrands;
