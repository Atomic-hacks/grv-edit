import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const imageKeys = [
  ["hero", "Shop hero"],
  ["brands-section", "Brands feature"],
  ["department-men", "Men department"],
  ["department-women", "Women department"],
  ["department-accessories", "Accessories department"],
  ["department-brands", "Brands department"],
  ["department-footwear", "Footwear department"],
  ["department-athletics", "Athletics department"],
  ["department-apparel", "Apparel department"],
  ["brand-northline", "Northline brand"],
  ["brand-atelier-zero", "Atelier Zero brand"],
  ["brand-common-form", "Common Form brand"],
  ["collection-men", "Men collection"],
  ["collection-women", "Women collection"],
  ["collection-bags", "Bags collection"],
  ["collection-athletics", "Athletics collection"],
  ["collection-lifestyle", "Lifestyle collection"],
];

const AdminSiteImages = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});
  const [uploadingKey, setUploadingKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState("");

  const imagesQuery = useQuery({
    queryKey: ["admin", "site-images"],
    queryFn: () => request("/api/site-images"),
    enabled: Boolean(session),
  });
  const images = imagesQuery.data || {};

  const getValue = (key) => drafts[key] ?? images[key] ?? "";

  const upload = async (key, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingKey(key);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await request("/api/admin/upload-image", {
        method: "POST",
        body,
      });
      setDrafts((current) => ({ ...current, [key]: result.url }));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploadingKey(null);
      event.target.value = "";
    }
  };

  const save = async (key) => {
    const imageUrl = getValue(key);
    if (!imageUrl) return;
    setSavingKey(key);
    setError("");
    try {
      await request(`/api/admin/site-images/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ imageUrl }),
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "site-images"],
      });
      await queryClient.invalidateQueries({ queryKey: ["site-images"] });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-black pb-6">
        <Link
          to="/admin"
          className="text-xs uppercase tracking-[0.2em] text-gray-500"
        >
          Admin
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Site images</h1>
        <p className="mt-3 max-w-xl text-sm text-gray-600">
          Update the imagery used across the Shop and catalogue pages.
        </p>
      </div>
      {(error || imagesQuery.error?.message) && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error || imagesQuery.error.message}
        </div>
      )}
      {imagesQuery.isPending ? (
        <Spinner
          label="Loading site images"
          className="mt-8 text-sm text-gray-500"
        />
      ) : (
        <div className="mt-8 divide-y divide-gray-200 border-t border-black">
          {imageKeys.map(([key, label]) => {
            const value = getValue(key);
            const dirty = drafts[key] !== undefined;
            return (
              <section
                key={key}
                className="grid gap-5 py-6 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <h2 className="font-medium">{label}</h2>
                  <p className="mt-1 text-xs text-gray-500">{key}</p>
                </div>
                <div className="flex min-w-0 items-center gap-4">
                  <div className="h-24 w-32 shrink-0 overflow-hidden bg-gray-100">
                    {value && (
                      <img
                        src={value}
                        alt={label}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="min-w-0 truncate text-xs text-gray-500">
                    {value || "No image configured"}
                  </p>
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <label className="cursor-pointer border border-gray-300 px-3 py-2 text-sm hover:border-black">
                    {uploadingKey === key ? (
                      <Spinner label="Uploading" />
                    ) : (
                      "Upload"
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => upload(key, event)}
                      disabled={uploadingKey !== null || savingKey !== null}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => save(key)}
                    disabled={!dirty || savingKey !== null}
                    className="border border-black bg-black px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingKey === key ? <Spinner label="Saving" /> : "Save"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default AdminSiteImages;
