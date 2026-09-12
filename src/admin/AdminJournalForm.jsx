import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  published: false,
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const AdminJournalForm = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { session } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isEditing) return undefined;

    let cancelled = false;
    request(`/api/admin/journal/${id}`)
      .then((post) => {
        if (cancelled) return;
        setForm({
          title: post.title || "",
          slug: post.slug || "",
          excerpt: post.excerpt || "",
          content: post.content || "",
          coverImage: post.coverImage || "",
          published: Boolean(post.published),
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

  const updateField = (event) => {
    const { name, type, value, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "title" && !slugManuallyEdited
        ? { slug: slugify(value) }
        : {}),
    }));
  };

  const updateSlug = (event) => {
    setSlugManuallyEdited(true);
    setForm((current) => ({ ...current, slug: event.target.value }));
  };

  const uploadCoverImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await request("/api/admin/upload-image", {
        method: "POST",
        body,
      });
      if (!result.url) throw new Error("Image upload returned no URL");
      setForm((current) => ({ ...current, coverImage: result.url }));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  };

  const savePost = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const post = await request(
        isEditing ? `/api/admin/journal/${id}` : "/api/admin/journal",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(form),
        },
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "journal"] });
      navigate(`/admin/journal/${post.id}/edit`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-20">
        <Spinner
          label="Loading journal post"
          className="text-sm text-gray-500"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-black pb-6">
        <Link
          to="/admin/journal"
          className="text-xs uppercase tracking-[0.2em] text-gray-500"
        >
          Journal
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">
          {isEditing ? "Edit post" : "New post"}
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

      <form onSubmit={savePost} className="mt-8 space-y-8">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Title</span>
            <input
              required
              name="title"
              value={form.title}
              onChange={updateField}
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Slug</span>
            <input
              required
              name="slug"
              value={form.slug}
              onChange={updateSlug}
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Excerpt</span>
            <textarea
              required
              name="excerpt"
              value={form.excerpt}
              onChange={updateField}
              rows={3}
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Content</span>
            <textarea
              required
              name="content"
              value={form.content}
              onChange={updateField}
              rows={14}
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Cover image</span>
            <input
              type="file"
              accept="image/*"
              onChange={uploadCoverImage}
              disabled={imageUploading}
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
            />
            {imageUploading && (
              <span className="mt-2 block text-xs text-gray-500">
                <Spinner
                  label="Uploading image"
                  className="text-xs text-gray-500"
                />
              </span>
            )}
          </label>
        </div>

        {form.coverImage && (
          <div>
            <p className="mb-2 text-sm font-medium">Cover preview</p>
            <img
              src={form.coverImage}
              alt="Cover preview"
              className="h-48 w-full object-cover md:w-80"
            />
          </div>
        )}

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="published"
            checked={form.published}
            onChange={updateField}
          />
          Published
        </label>

        <div className="flex gap-4 border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={saving || imageUploading}
            className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Spinner label="Saving" /> : "Save post"}
          </button>
          <Link to="/admin/journal" className="px-5 py-3 text-sm underline">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
};

export default AdminJournalForm;
