import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const emptyForm = {
  name: "",
  slug: "",
  logo: "",
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const AdminBrandForm = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { session } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isEditing) return undefined;

    let cancelled = false;
    request("/api/admin/brands")
      .then((brands) => {
        const brand = brands.find((item) => item.id === id);
        if (!brand) throw new Error("Brand not found");
        if (cancelled) return;
        setForm({
          name: brand.name || "",
          slug: brand.slug || "",
          logo: brand.logo || "",
        });
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEditing, request]);

  const updateName = (event) => {
    const name = event.target.value;
    setForm((current) => ({
      ...current,
      name,
      ...(slugManuallyEdited ? {} : { slug: slugify(name) }),
    }));
  };

  const updateSlug = (event) => {
    setSlugManuallyEdited(true);
    setForm((current) => ({ ...current, slug: event.target.value }));
  };

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await request("/api/admin/upload-image", {
        method: "POST",
        body,
      });
      if (!result.url) throw new Error("Image upload returned no URL");
      setForm((current) => ({ ...current, logo: result.url }));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setLogoUploading(false);
      event.target.value = "";
    }
  };

  const saveBrand = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const brand = await request(
        isEditing ? `/api/admin/brands/${id}` : "/api/admin/brands",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(form),
        },
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
      navigate(`/admin/brands/${brand.id}/edit`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <Spinner label="Loading brand" className="text-sm text-[var(--ink-500)]" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-[var(--ink-900)] pb-6">
        <Link
          to="/admin/brands"
          className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
        >
          Brands
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">
          {isEditing ? "Edit brand" : "New brand"}
        </h1>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <form onSubmit={saveBrand} className="mt-8 space-y-8">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Name</span>
            <input
              required
              name="name"
              value={form.name}
              onChange={updateName}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Slug</span>
            <input
              required
              name="slug"
              value={form.slug}
              onChange={updateSlug}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Logo</span>
            <input
              type="file"
              accept="image/*"
              onChange={uploadLogo}
              disabled={logoUploading}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
            {logoUploading && (
              <span className="mt-2 block text-xs text-[var(--ink-500)]">
                <Spinner
                  label="Uploading image"
                  className="text-xs text-[var(--ink-500)]"
                />
              </span>
            )}
          </label>
        </div>

        {form.logo && (
          <div>
            <p className="mb-2 text-sm font-medium">Logo preview</p>
            <img
              src={form.logo}
              alt="Logo preview"
              className="h-32 w-32 object-contain"
            />
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving || logoUploading}
            className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink-900)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Spinner label="Saving" /> : "Save brand"}
          </button>
          <Link
            to="/admin/brands"
            className="border border-[var(--line)] px-5 py-3 text-sm font-medium transition-colors hover:border-[var(--ink-900)]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
};

export default AdminBrandForm;
