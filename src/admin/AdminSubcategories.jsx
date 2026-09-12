import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const emptyForm = { name: "", slug: "", categoryId: "" };

const AdminSubcategories = () => {
  const { session } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => request("/api/categories"),
    enabled: Boolean(session),
  });
  const subcategoriesQuery = useQuery({
    queryKey: ["admin", "subcategories"],
    queryFn: () => request("/api/admin/subcategories"),
    enabled: Boolean(session),
  });
  const categories = useMemo(
    () => categoriesQuery.data || [],
    [categoriesQuery.data],
  );
  const subcategories = subcategoriesQuery.data || [];
  const loading = categoriesQuery.isPending || subcategoriesQuery.isPending;
  const displayError =
    error ||
    categoriesQuery.error?.message ||
    subcategoriesQuery.error?.message;

  useEffect(() => {
    if (categories.length === 0) return;
    setForm((current) => ({
      ...current,
      categoryId: current.categoryId || categories[0].id,
    }));
  }, [categories]);

  const updateField = (setter) => (event) => {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
  };

  const createSubcategory = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/api/admin/subcategories", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ ...emptyForm, categoryId: categories[0]?.id || "" });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "subcategories"],
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (subcategory) => {
    setEditingId(subcategory.id);
    setEditingForm({
      name: subcategory.name,
      slug: subcategory.slug,
      categoryId: subcategory.categoryId,
    });
    setError("");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(`/api/admin/subcategories/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(editingForm),
      });
      setEditingId(null);
      await queryClient.invalidateQueries({
        queryKey: ["admin", "subcategories"],
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSubcategory = async (id) => {
    setError("");
    setDeletingId(id);
    try {
      await request(`/api/admin/subcategories/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "subcategories"],
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
          <h1 className="mt-3 text-3xl font-semibold">Subcategories</h1>
        </div>
        <p className="max-w-sm text-sm text-gray-500">
          Keep the catalog taxonomy tidy and easy to browse.
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
        onSubmit={createSubcategory}
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
          <span className="mb-2 block font-medium">Parent category</span>
          <select
            required
            name="categoryId"
            value={form.categoryId}
            onChange={updateField(setForm)}
            className="w-full border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving || loading}
          className="border border-black bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Spinner label="Saving" /> : "Add subcategory"}
        </button>
      </form>

      <div className="mt-8 overflow-x-auto border-t border-black">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.15em] text-gray-500">
            <tr>
              <th className="px-3 py-4 font-medium">Name</th>
              <th className="px-3 py-4 font-medium">Slug</th>
              <th className="px-3 py-4 font-medium">Parent category</th>
              <th className="px-3 py-4 font-medium">Products</th>
              <th className="px-3 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="5" className="px-3 py-8 text-gray-500">
                  <Spinner label="Loading subcategories" />
                </td>
              </tr>
            )}
            {!loading && subcategories.length === 0 && (
              <tr>
                <td colSpan="5" className="px-3 py-8 text-gray-500">
                  No subcategories yet.
                </td>
              </tr>
            )}
            {subcategories.map((subcategory) => (
              <tr
                key={subcategory.id}
                className="border-b border-gray-200 align-top"
              >
                {editingId === subcategory.id ? (
                  <td colSpan="5" className="px-3 py-4">
                    <form
                      onSubmit={saveEdit}
                      className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end"
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
                          Parent category
                        </span>
                        <select
                          required
                          name="categoryId"
                          value={editingForm.categoryId}
                          onChange={updateField(setEditingForm)}
                          className="w-full border border-gray-300 bg-white px-2.5 py-2"
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
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
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-4 font-medium">
                      {subcategory.name}
                    </td>
                    <td className="px-3 py-4 text-gray-500">
                      {subcategory.slug}
                    </td>
                    <td className="px-3 py-4">{subcategory.category.name}</td>
                    <td className="px-3 py-4">{subcategory._count.products}</td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-4">
                        <button
                          type="button"
                          onClick={() => startEditing(subcategory)}
                          className="text-sm underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSubcategory(subcategory.id)}
                          disabled={deletingId === subcategory.id}
                          className="text-sm text-red-700 underline"
                        >
                          {deletingId === subcategory.id ? (
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

export default AdminSubcategories;
