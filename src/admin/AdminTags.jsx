import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const emptyForm = { name: "", slug: "", filterTypeId: "" };

const AdminTags = () => {
  const { session } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  const queryClient = useQueryClient();
  const tagsQuery = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: () => request("/api/admin/tags"),
    enabled: Boolean(session),
  });
  const filterTypesQuery = useQuery({
    queryKey: ["admin", "filter-types"],
    queryFn: () => request("/api/admin/filter-types"),
    enabled: Boolean(session),
  });
  const tags = tagsQuery.data || [];
  const filterTypes = filterTypesQuery.data || [];
  const loading = tagsQuery.isPending || filterTypesQuery.isPending;
  const displayError =
    error || tagsQuery.error?.message || filterTypesQuery.error?.message;

  const updateField = (setter) => (event) => {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
  };

  const createTag = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/api/admin/tags", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (tag) => {
    setEditingId(tag.id);
    setEditingForm({
      name: tag.name,
      slug: tag.slug,
      filterTypeId: tag.filterTypeId,
    });
    setError("");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(`/api/admin/tags/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(editingForm),
      });
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = async (id) => {
    setError("");
    setDeletingId(id);
    try {
      await request(`/api/admin/tags/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId(null);
    }
  };

  const tagsByType = (filterTypeId) =>
    tags.filter((tag) => tag.filterTypeId === filterTypeId);

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
          <h1 className="mt-3 text-3xl font-semibold">Tags</h1>
        </div>
        <p className="max-w-sm text-sm text-gray-500">
          Organize products by mood, occasion, weather, and style.
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
        onSubmit={createTag}
        className="mt-8 grid gap-4 border-b border-gray-200 pb-8 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
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
        <label className="text-sm">
          <span className="mb-2 block font-medium">Filter type</span>
          <select
            required
            name="filterTypeId"
            value={form.filterTypeId}
            onChange={updateField(setForm)}
            className="w-full border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
          >
            <option value="">Select a filter type</option>
            {filterTypes.map((filterType) => (
              <option key={filterType.id} value={filterType.id}>
                {filterType.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving || loading}
          className="border border-black bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Spinner label="Saving" /> : "Add tag"}
        </button>
      </form>

      {loading ? (
        <Spinner label="Loading tags" className="mt-8 text-sm text-gray-500" />
      ) : (
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          {filterTypes.map((filterType) => {
            const typeTags = tagsByType(filterType.id);
            return (
              <section key={filterType.id} className="border-t border-black">
                <div className="flex items-baseline justify-between py-4">
                  <h2 className="text-lg font-semibold">{filterType.name}</h2>
                  <span className="text-xs text-gray-500">
                    {typeTags.length} tag{typeTags.length === 1 ? "" : "s"}
                  </span>
                </div>
                {typeTags.length === 0 ? (
                  <p className="border-t border-gray-200 py-5 text-sm text-gray-500">
                    No {filterType.name.toLowerCase()} tags yet.
                  </p>
                ) : (
                  <div className="border-t border-gray-200">
                    {typeTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="border-b border-gray-200 py-4"
                      >
                        {editingId === tag.id ? (
                          <form
                            onSubmit={saveEdit}
                            className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end"
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
                            <label className="text-sm">
                              <span className="mb-1 block text-xs text-gray-500">
                                Filter type
                              </span>
                              <select
                                required
                                name="filterTypeId"
                                value={editingForm.filterTypeId}
                                onChange={updateField(setEditingForm)}
                                className="w-full border border-gray-300 bg-white px-2.5 py-2"
                              >
                                {filterTypes.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
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
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <p className="font-medium">{tag.name}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {tag.slug}
                              </p>
                            </div>
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={() => startEditing(tag)}
                                className="text-sm underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTag(tag.id)}
                                disabled={deletingId === tag.id}
                                className="text-sm text-red-700 underline"
                              >
                                {deletingId === tag.id ? (
                                  <Spinner label="Deleting" />
                                ) : (
                                  "Delete"
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default AdminTags;
