import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const AdminProducts = () => {
  const { session } = useAuth();
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

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

  const deleteProduct = async (id) => {
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

  const getDepartment = (product) =>
    product.categoryId === "accessories"
      ? "Accessories"
      : product.gender === "women"
        ? "Women"
        : "Men";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-black pb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-gray-500"
          >
            Admin
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Products</h1>
        </div>
        <Link
          to="/admin/products/new"
          className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black"
        >
          New Product
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

      <div className="mt-8 overflow-x-auto border-t border-black">
        <table className="w-full min-w-200 text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.15em] text-gray-500">
            <tr>
              <th className="px-3 py-4 font-medium">Image</th>
              <th className="px-3 py-4 font-medium">Name</th>
              <th className="px-3 py-4 font-medium">Brand</th>
              <th className="px-3 py-4 font-medium">Department</th>
              <th className="px-3 py-4 font-medium">Subcategory</th>
              <th className="px-3 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-gray-500">
                  <Spinner label="Loading products" />
                </td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-gray-500">
                  No products yet.
                </td>
              </tr>
            )}
            {products.map((product) => {
              const image = getImage(product);
              return (
                <tr
                  key={product.id}
                  className="border-b border-gray-200 align-middle"
                >
                  <td className="px-3 py-3">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        className="h-14 w-12 object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">No image</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-medium">{product.name}</td>
                  <td className="px-3 py-3">{product.brandName || "—"}</td>
                  <td className="px-3 py-3">{getDepartment(product)}</td>
                  <td className="px-3 py-3">
                    {product.subcategoryName || product.subcategory || "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-4">
                      <Link
                        to={`/admin/products/${product.id}/edit`}
                        className="text-sm underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteProduct(product.id)}
                        disabled={deletingId === product.id}
                        className="text-sm text-red-700 underline"
                      >
                        {deletingId === product.id ? (
                          <Spinner label="Deleting" />
                        ) : (
                          "Delete"
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default AdminProducts;
