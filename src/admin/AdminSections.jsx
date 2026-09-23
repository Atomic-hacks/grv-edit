import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const emptyForm = {
  title: "",
  slug: "",
  description: "",
  showOnHomepage: false,
  homepageOrder: "",
};

const AdminSections = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingProducts, setSavingProducts] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sectionsQuery = useQuery({
    queryKey: ["admin", "sections"],
    queryFn: () => request("/api/admin/sections"),
    enabled: Boolean(session) && !isEditing,
  });
  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => request("/api/admin/products"),
    enabled: Boolean(session) && isEditing,
  });
  const sectionQuery = useQuery({
    queryKey: ["admin", "section", id],
    queryFn: () => request(`/api/admin/sections/${id}`),
    enabled: Boolean(session && isEditing),
  });

  useEffect(() => {
    if (!sectionQuery.data) return;
    const section = sectionQuery.data;
    setForm({
      title: section.title,
      slug: section.slug,
      description: section.description,
      showOnHomepage: section.showOnHomepage,
      homepageOrder:
        section.homepageOrder === null ? "" : String(section.homepageOrder),
    });
    setSelectedProductIds(section.productIds || []);
  }, [sectionQuery.data]);

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const saveSection = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...form,
        homepageOrder: form.homepageOrder === "" ? null : form.homepageOrder,
      };
      const section = await request(
        isEditing ? `/api/admin/sections/${id}` : "/api/admin/sections",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "sections"] });
      if (!isEditing) navigate(`/admin/sections/${section.id}/edit`);
      else setNotice("Section details saved.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save section.");
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (productId) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((idValue) => idValue !== productId)
        : [...current, productId],
    );
  };

  const saveProducts = async (event) => {
    event.preventDefault();
    setSavingProducts(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/sections/${id}/products`, {
        method: "PUT",
        body: JSON.stringify({ productIds: selectedProductIds }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "section", id],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "sections"] });
      setNotice("Section products saved.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save section products.");
    } finally {
      setSavingProducts(false);
    }
  };

  const deleteSection = async () => {
    setDeleting(true);
    setError("");
    try {
      await request(`/api/admin/sections/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "sections"] });
      navigate("/admin/sections");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete section.");
      setDeleting(false);
    }
  };

  if (isEditing && (sectionQuery.isPending || productsQuery.isPending)) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-20 md:px-12">
        <Spinner label="Loading section" />
      </main>
    );
  }

  if (!isEditing) {
    const sections = sectionsQuery.data || [];
    return (
      <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
          <div>
            <Link
              to="/admin"
              className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
            >
              Admin
            </Link>
            <h1 className="mt-3 text-3xl font-semibold">Sections</h1>
          </div>
          <p className="max-w-sm text-sm text-[var(--ink-500)]">
            Create curated product groupings for their own pages and the
            homepage.
          </p>
        </div>
        {error && (
          <p role="alert" className="mt-6 text-sm text-red-600">
            {error}
          </p>
        )}
        <form
          onSubmit={saveSection}
          className="mt-8 grid gap-4 border-b border-[var(--line)] pb-8 md:grid-cols-2"
        >
          <label className="text-sm">
            <span className="mb-2 block font-medium">Title</span>
            <input
              required
              name="title"
              value={form.title}
              onChange={updateField}
              className="w-full border border-[var(--line)] px-3 py-2.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Slug</span>
            <input
              required
              name="slug"
              value={form.slug}
              onChange={updateField}
              className="w-full border border-[var(--line)] px-3 py-2.5"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Description</span>
            <textarea
              required
              name="description"
              value={form.description}
              onChange={updateField}
              rows={3}
              className="w-full border border-[var(--line)] px-3 py-2.5"
            />
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="showOnHomepage"
              checked={form.showOnHomepage}
              onChange={updateField}
              className="h-4 w-4 accent-black"
            />
            Show on homepage
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Homepage order</span>
            <input
              min="0"
              step="1"
              type="number"
              name="homepageOrder"
              value={form.homepageOrder}
              onChange={updateField}
              className="w-full border border-[var(--line)] px-3 py-2.5"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50 md:col-span-2 md:justify-self-start"
          >
            {saving ? <Spinner label="Saving" /> : "Create section"}
          </button>
        </form>
        {sectionsQuery.isPending ? (
          <Spinner label="Loading sections" className="mt-8" />
        ) : (
          <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {sections.map((section) => (
              <div
                key={section.id}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div>
                  <h2 className="font-semibold">{section.title}</h2>
                  <p className="mt-1 text-xs text-[var(--ink-500)]">
                    /{section.slug} · {section.productCount} products
                  </p>
                </div>
                <Link
                  to={`/admin/sections/${section.id}/edit`}
                  className="text-sm underline"
                >
                  Edit section
                </Link>
              </div>
            ))}
            {!sections.length && (
              <p className="py-6 text-sm text-[var(--ink-500)]">No sections yet.</p>
            )}
          </div>
        )}
      </main>
    );
  }

  const products = productsQuery.data || [];
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
        <div>
          <Link
            to="/admin/sections"
            className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
          >
            Sections
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Edit section</h1>
        </div>
        <button
          type="button"
          onClick={deleteSection}
          disabled={deleting}
          className="text-sm text-red-700 underline"
        >
          {deleting ? "Deleting..." : "Delete section"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {error}
        </p>
      )}
      {notice && <p className="mt-6 text-sm text-green-700">{notice}</p>}
      <form
        onSubmit={saveSection}
        className="mt-8 grid gap-4 border-b border-[var(--line)] pb-8 md:grid-cols-2"
      >
        <label className="text-sm">
          <span className="mb-2 block font-medium">Title</span>
          <input
            required
            name="title"
            value={form.title}
            onChange={updateField}
            className="w-full border border-[var(--line)] px-3 py-2.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-2 block font-medium">Slug</span>
          <input
            required
            name="slug"
            value={form.slug}
            onChange={updateField}
            className="w-full border border-[var(--line)] px-3 py-2.5"
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-2 block font-medium">Description</span>
          <textarea
            required
            name="description"
            value={form.description}
            onChange={updateField}
            rows={3}
            className="w-full border border-[var(--line)] px-3 py-2.5"
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="showOnHomepage"
            checked={form.showOnHomepage}
            onChange={updateField}
            className="h-4 w-4 accent-black"
          />
          Show on homepage
        </label>
        <label className="text-sm">
          <span className="mb-2 block font-medium">Homepage order</span>
          <input
            min="0"
            step="1"
            type="number"
            name="homepageOrder"
            value={form.homepageOrder}
            onChange={updateField}
            className="w-full border border-[var(--line)] px-3 py-2.5"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50 md:col-span-2 md:justify-self-start"
        >
          {saving ? <Spinner label="Saving" /> : "Save section"}
        </button>
      </form>
      <form onSubmit={saveProducts} className="mt-8">
        <div className="flex items-baseline justify-between border-b border-[var(--ink-900)] pb-4">
          <h2 className="text-xl font-semibold">Assign products</h2>
          <span className="text-sm text-[var(--ink-500)]">
            {selectedProductIds.length} selected
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <label
              key={product.id}
              className="flex cursor-pointer gap-3 border border-[var(--line)] p-4 hover:border-[var(--ink-900)]"
            >
              <input
                type="checkbox"
                checked={selectedProductIds.includes(product.id)}
                onChange={() => toggleProduct(product.id)}
                className="mt-1 h-4 w-4 accent-black"
              />
              <span>
                <span className="block text-sm font-medium">
                  {product.name}
                </span>
                <span className="mt-1 block text-xs text-[var(--ink-500)]">
                  {product.brandName || product.subcategory || "Product"}
                </span>
              </span>
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={savingProducts}
          className="mt-6 border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {savingProducts ? (
            <Spinner label="Saving" />
          ) : (
            "Save assigned products"
          )}
        </button>
      </form>
    </main>
  );
};

export default AdminSections;
