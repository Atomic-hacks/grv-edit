import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const AdminBulkUpload = () => {
  const { session } = useAuth();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  const uploadCsv = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a CSV file to upload.");
      return;
    }

    setUploading(true);
    setError("");
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    try {
      setResult(
        await request("/api/admin/products/bulk-upload", {
          method: "POST",
          body,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:px-12 md:py-20 lg:px-0">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
        <div>
          <Link
            to="/admin/products"
            className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
          >
            Catalog
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Bulk Upload</h1>
        </div>
        <a
          href="/api/admin/products/bulk-upload/template"
          className="border border-[var(--line)] px-5 py-3 text-sm font-medium transition-colors hover:border-[var(--ink-900)]"
        >
          Download Template
        </a>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <form onSubmit={uploadCsv} className="mt-8 space-y-8">
        <label className="block text-sm">
          <span className="mb-2 block font-medium">CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            disabled={uploading}
            className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
          <span className="mt-2 block text-xs text-[var(--ink-500)]">
            Columns: name, description, price, brandSlug, categorySlugs,
            designCode, color, size, stock, tagSlugs. categorySlugs is a
            comma-separated list — any mix of major categories and
            subcategories, e.g. "women,accessories,bags".
          </span>
        </label>
        <button
          type="submit"
          disabled={uploading}
          className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink-900)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? <Spinner label="Uploading" /> : "Upload Products"}
        </button>
      </form>

      {result && (
        <section className="mt-10 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-[var(--line)] p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                Total rows
              </p>
              <p className="mt-2 text-2xl font-semibold">{result.totalRows}</p>
            </div>
            <div className="border border-[var(--line)] p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                Created
              </p>
              <p className="mt-2 text-2xl font-semibold">{result.created}</p>
            </div>
            <div className="border border-[var(--line)] p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                Failed
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {result.failed.length}
              </p>
            </div>
          </div>

          {result.failed.length > 0 && (
            <div className="overflow-x-auto border-t border-[var(--ink-900)]">
              <table className="w-full min-w-120 text-left text-sm">
                <thead className="border-b border-[var(--line)] text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                  <tr>
                    <th className="px-3 py-4 font-medium">Row</th>
                    <th className="px-3 py-4 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failed.map((failure) => (
                    <tr key={failure.row} className="border-b border-[var(--line)]">
                      <td className="px-3 py-3 font-medium">{failure.row}</td>
                      <td className="px-3 py-3 text-red-700">
                        {failure.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="overflow-x-auto border-t border-[var(--ink-900)]">
              <table className="w-full min-w-120 text-left text-sm">
                <thead className="border-b border-[var(--line)] text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                  <tr>
                    <th className="px-3 py-4 font-medium">Row</th>
                    <th className="px-3 py-4 font-medium">Warning</th>
                  </tr>
                </thead>
                <tbody>
                  {result.warnings.map((warning, index) => (
                    <tr
                      key={`${warning.row}-${index}`}
                      className="border-b border-[var(--line)]"
                    >
                      <td className="px-3 py-3 font-medium">{warning.row}</td>
                      <td className="px-3 py-3">{warning.warning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default AdminBulkUpload;
