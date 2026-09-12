import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const emptyForm = { name: "", slug: "" };

const AdminFilterTypes = () => {
  const { session } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  const queryClient = useQueryClient();
  const filterTypesQuery = useQuery({
    queryKey: ["admin", "filter-types"],
    queryFn: () => request("/api/admin/filter-types"),
    enabled: Boolean(session),
  });
  const filterTypes = filterTypesQuery.data || [];
  const loading = filterTypesQuery.isPending;
  const displayError = error || filterTypesQuery.error?.message;

  const updateField = (setter) => (event) => {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
  };

  const createFilterType = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/api/admin/filter-types", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      await queryClient.invalidateQueries({
        queryKey: ["admin", "filter-types"],
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (filterType) => {
    setEditingId(filterType.id);
    setEditingForm({ name: filterType.name, slug: filterType.slug });
    setError("");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(`/api/admin/filter-types/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(editingForm),
      });
      setEditingId(null);
      await queryClient.invalidateQueries({
        queryKey: ["admin", "filter-types"],
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteFilterType = async (id) => {
    setError("");
    setDeletingId(id);
    try {
      await request(`/api/admin/filter-types/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "filter-types"],
      });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-black pb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-gray-500"
          >
            Admin
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Filter types</h1>
        </div>
        <p className="max-w-sm text-sm text-gray-500">
          Manage the groups used to organize product tags.
        </p>
      </div>

      {displayError && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {displayError}
        </div>
      )}

      <form
        onSubmit={createFilterType}
        className="mt-8 grid gap-4 border-b border-gray-200 pb-8 md:grid-cols-[1fr_1fr_auto] md:items-end"
      >
        <label className="text-sm">
          <span className="mb-2 block font-medium">Name</span>
          <input
            required
            name="name"
            value={form.name}
            onChange={updateField(setForm)}
            className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
          />
        </label>
        <label className="text-sm">
          <span className="mb-2 block font-medium">Slug</span>
          <input
            required
            name="slug"
            value={form.slug}
            onChange={updateField(setForm)}
            className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
          />
        </label>
        <button
          type="submit"
          disabled={saving || loading}
          className="border border-black bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Spinner label="Saving" /> : "Add filter type"}
        </button>
      </form>

      <div className="mt-8 overflow-x-auto border-t border-black">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.15em] text-gray-500">
            <tr>
              <th className="px-3 py-4 font-medium">Name</th>
              <th className="px-3 py-4 font-medium">Slug</th>
              <th className="px-3 py-4 font-medium">Tags</th>
              <th className="px-3 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="4" className="px-3 py-8 text-gray-500">
                  <Spinner label="Loading filter types" />
                </td>
              </tr>
            )}
            {!loading && filterTypes.length === 0 && (
              <tr>
                <td colSpan="4" className="px-3 py-8 text-gray-500">
                  No filter types yet.
                </td>
              </tr>
            )}
            {filterTypes.map((filterType) => (
              <tr
                key={filterType.id}
                className="border-b border-gray-200 align-top"
              >
                {editingId === filterType.id ? (
                  <td colSpan="4" className="px-3 py-4">
                    <form
                      onSubmit={saveEdit}
                      className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
                    >
                      <label className="text-sm">
                        <span className="mb-1 block text-xs text-gray-500">
                          Name
                        </span>
                        <input
                          required
                          name="name"
                          value={editingForm.name}
                          onChange={updateField(setEditingForm)}
                          className="w-full border border-gray-300 px-2.5 py-2"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-xs text-gray-500">
                          Slug
                        </span>
                        <input
                          required
                          name="slug"
                          value={editingForm.slug}
                          onChange={updateField(setEditingForm)}
                          className="w-full border border-gray-300 px-2.5 py-2"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={saving}
                        className="border border-black bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        {saving ? <Spinner label="Saving" /> : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-2 text-sm underline"
                      >
                        Cancel
                      </button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-4 font-medium">{filterType.name}</td>
                    <td className="px-3 py-4 text-gray-600">
                      {filterType.slug}
                    </td>
                    <td className="px-3 py-4 text-gray-600">
                      {filterType._count.tags}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-4">
                        <button
                          type="button"
                          onClick={() => startEditing(filterType)}
                          className="text-sm underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteFilterType(filterType.id)}
                          disabled={deletingId === filterType.id}
                          className="text-sm text-red-700 underline"
                        >
                          {deletingId === filterType.id ? (
                            <Spinner label="Deleting" />
                          ) : (
                            "Delete"
                          )}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default AdminFilterTypes;
