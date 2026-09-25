import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { buildCategoryTree, getCategoryPath } from "../lib/categoryTree";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import InlineNotice from "../component/ui/InlineNotice";
import SubmitButton from "../component/ui/SubmitButton";
import Spinner from "../component/ui/Spinner";

const emptyForm = {
  name: "",
  description: "",
  brandId: "",
  basePrice: "",
  discountPercent: "",
  imageUrl: "",
  archived: false,
  featured: false,
};

const emptyVariantForm = { color: "", size: "", sku: "", stock: "10", imageUrl: "" };

/**
 * One continuous flow, on one page: details, which categories this belongs
 * to (with subcategories nested under each), tags, and variants — added
 * inline the moment the product exists, without leaving the page. The
 * product is only ever "half done" for the few seconds between the first
 * save and adding a variant, never because the admin got redirected
 * somewhere else and had to find their way back.
 */
// A category can nest arbitrarily deep (Men > Accessories > Jewelry), so
// this renders itself recursively — checking "Jewelry" works the same way
// at any depth as checking a major category.
const CategoryCheckboxRow = ({
  category,
  depth,
  selectedCategoryIds,
  toggleCategory,
  expandedCategoryIds,
  toggleExpandedCategory,
}) => {
  const isExpanded = expandedCategoryIds.has(category.id);
  const hasChildren = category.children.length > 0;
  return (
    <div className={depth === 0 ? "border-b border-[var(--line)] last:border-b-0" : ""}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ paddingLeft: 16 + depth * 24 }}>
        <input
          type="checkbox"
          checked={selectedCategoryIds.includes(category.id)}
          onChange={() => toggleCategory(category.id)}
          className="h-4 w-4 accent-(--color-accent-orange)"
        />
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleExpandedCategory(category.id)}
            className={`flex flex-1 items-center justify-between text-left ${depth === 0 ? "text-[14px] font-medium" : "text-[13px]"}`}
          >
            {category.name}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
              <path d="M2 3.5l3 3 3-3" />
            </svg>
          </button>
        ) : (
          <span className={depth === 0 ? "text-[14px] font-medium" : "text-[13px]"}>{category.name}</span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div className={depth === 0 ? "space-y-2 bg-[var(--surface-muted)] py-3" : "space-y-2 py-2"}>
          {category.children.map((child) => (
            <CategoryCheckboxRow
              key={child.id}
              category={child}
              depth={depth + 1}
              selectedCategoryIds={selectedCategoryIds}
              toggleCategory={toggleCategory}
              expandedCategoryIds={expandedCategoryIds}
              toggleExpandedCategory={toggleExpandedCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AdminProductForm = () => {
  const { id: routeId } = useParams();
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  // productId starts as whatever's in the URL (editing) and becomes set the
  // moment a brand-new product's first save succeeds — from that point on
  // this screen behaves identically whether you arrived via "New product"
  // or "Edit product".
  const [productId, setProductId] = useState(routeId || null);
  const isEditingExisting = Boolean(routeId);

  const [form, setForm] = useState(emptyForm);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(new Set());
  const [filterTypes, setFilterTypes] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [variants, setVariants] = useState([]);
  const [variantForm, setVariantForm] = useState(emptyVariantForm);
  const [stockDrafts, setStockDrafts] = useState({});
  const [variantSavingId, setVariantSavingId] = useState(null);
  const [variantAction, setVariantAction] = useState(null);
  const [loading, setLoading] = useState(isEditingExisting);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      request("/api/brands"),
      request("/api/admin/categories"),
      request("/api/filter-types"),
      request("/api/tags"),
      isEditingExisting ? request(`/api/admin/products/${routeId}`) : Promise.resolve(null),
    ])
      .then(([brandData, categoryData, filterTypeData, tagData, product]) => {
        if (cancelled) return;
        setBrands(brandData);
        setCategories(categoryData);
        setFilterTypes(filterTypeData);
        setTags(tagData);
        if (product) {
          setForm({
            name: product.name,
            description: product.description,
            brandId: product.brandId,
            basePrice: String(product.basePrice),
            discountPercent:
              product.discountPercent === null || product.discountPercent === undefined
                ? ""
                : String(product.discountPercent),
            imageUrl: product.imageUrl || "",
            archived: Boolean(product.archived),
            featured: Boolean(product.featured),
          });
          const productCategoryIds = product.categoryIds || [];
          setSelectedCategoryIds(productCategoryIds);
          // Reveal every selected category even when it's nested a few
          // levels deep, instead of it silently being checked but hidden.
          setExpandedCategoryIds(
            new Set(
              productCategoryIds.flatMap((categoryId) =>
                getCategoryPath(categoryData, categoryId).map((c) => c.id),
              ),
            ),
          );
          setSelectedTagIds(product.tags.map((tag) => tag.id));
          setVariants(product.variants || []);
          setStockDrafts(
            Object.fromEntries(
              (product.variants || []).map((variant) => [variant.id, String(variant.stock)]),
            ),
          );
        }
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
  }, [routeId, isEditingExisting, request]);

  const tree = buildCategoryTree(categories);
  const canArchive =
    Boolean(productId) && variants.length > 0 && variants.every((variant) => variant.stock === 0);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleCategory = (categoryId) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  };

  const toggleExpandedCategory = (categoryId) =>
    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });

  const uploadMainImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await request("/api/admin/upload-image", { method: "POST", body });
      if (!result.url) throw new Error("Image upload returned no URL");
      setForm((current) => ({ ...current, imageUrl: result.url }));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  };

  const toggleTag = (tagId) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId],
    );
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (selectedCategoryIds.length === 0) {
      setError("Pick at least one category — check where this product belongs below.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        brandId: form.brandId,
        categoryIds: selectedCategoryIds,
        basePrice: form.basePrice,
        discountPercent: form.discountPercent === "" ? null : form.discountPercent,
        imageUrl: form.imageUrl,
        archived: form.archived,
        featured: form.featured,
      };
      const product = await request(
        productId ? `/api/admin/products/${productId}` : "/api/admin/products",
        { method: productId ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      await request(`/api/admin/products/${product.id}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tagIds: selectedTagIds }),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      const wasNew = !productId;
      setProductId(product.id);
      setNotice(
        wasNew
          ? "Product created. Add variants below, or come back to this page any time."
          : "Changes saved.",
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateVariantField = (event) => {
    const { name, value } = event.target;
    setVariantForm((current) => ({ ...current, [name]: value }));
  };

  const createVariant = async (event) => {
    event.preventDefault();
    setVariantSavingId("new");
    setVariantAction("saving");
    setError("");
    try {
      const variant = await request(`/api/admin/products/${productId}/variants`, {
        method: "POST",
        body: JSON.stringify({
          color: variantForm.color,
          size: variantForm.size,
          sku: variantForm.sku,
          stock: Number(variantForm.stock),
        }),
      });
      const savedVariant = variantForm.imageUrl.trim()
        ? await request(`/api/admin/variants/${variant.id}/images`, {
            method: "POST",
            body: JSON.stringify({ url: variantForm.imageUrl.trim() }),
          })
        : variant;
      setVariants((current) => [...current, savedVariant]);
      setStockDrafts((current) => ({ ...current, [savedVariant.id]: String(savedVariant.stock) }));
      setVariantForm(emptyVariantForm);
    } catch (variantError) {
      setError(variantError.message);
    } finally {
      setVariantSavingId(null);
      setVariantAction(null);
    }
  };

  const saveVariantStock = async (variant) => {
    const stock = Number(stockDrafts[variant.id]);
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a non-negative integer");
      return;
    }
    if (stock === variant.stock) return;
    setVariantSavingId(variant.id);
    setVariantAction("saving");
    setError("");
    try {
      const updatedVariant = await request(`/api/admin/variants/${variant.id}`, {
        method: "PUT",
        body: JSON.stringify({ stock }),
      });
      setVariants((current) =>
        current.map((item) => (item.id === updatedVariant.id ? updatedVariant : item)),
      );
    } catch (variantError) {
      setError(variantError.message);
    } finally {
      setVariantSavingId(null);
      setVariantAction(null);
    }
  };

  const deleteVariant = async (variantId) => {
    setVariantSavingId(variantId);
    setVariantAction("deleting");
    setError("");
    try {
      await request(`/api/admin/variants/${variantId}`, { method: "DELETE" });
      setVariants((current) => current.filter((variant) => variant.id !== variantId));
      setStockDrafts((current) => {
        const next = { ...current };
        delete next[variantId];
        return next;
      });
    } catch (variantError) {
      setError(variantError.message);
    } finally {
      setVariantSavingId(null);
      setVariantAction(null);
    }
  };

  const tagsByType = (slug) => tags.filter((tag) => tag.filterType?.slug === slug);

  if (loading) {
    return (
      <main className="py-20">
        <Spinner label="Loading product" className="text-sm text-[var(--ink-500)]" />
      </main>
    );
  }

  return (
    <main className="max-w-4xl py-10 md:py-14">
      <AdminPageHeader
        title={productId ? "Edit product" : "New product"}
        backTo="/admin/products"
        backLabel="Products"
        actions={
          <Link
            to="/admin/products"
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-500)] underline underline-offset-4 hover:text-[var(--ink-900)]"
          >
            Done — back to products
          </Link>
        }
      />

      {error && <InlineNotice tone="error" className="mt-6">{error}</InlineNotice>}
      {notice && <InlineNotice tone="success" className="mt-6">{notice}</InlineNotice>}

      <form onSubmit={saveProduct} className="mt-8 space-y-8">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Name</span>
            <input
              required
              name="name"
              value={form.name}
              onChange={updateField}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Brand</span>
            <select
              required
              name="brandId"
              value={form.brandId}
              onChange={updateField}
              className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            >
              <option value="">Select a brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Description</span>
            <textarea
              required
              name="description"
              value={form.description}
              onChange={updateField}
              rows={4}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Base price</span>
            <input
              required
              min="0"
              step="0.01"
              type="number"
              name="basePrice"
              value={form.basePrice}
              onChange={updateField}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Discount %</span>
            <input
              min="0"
              max="100"
              step="0.01"
              type="number"
              name="discountPercent"
              value={form.discountPercent}
              onChange={updateField}
              placeholder="Optional"
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Main product image</span>
            <input
              type="file"
              accept="image/*"
              onChange={uploadMainImage}
              disabled={imageUploading}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
            {imageUploading && (
              <span className="mt-2 block">
                <Spinner label="Uploading image" className="text-xs text-[var(--ink-500)]" />
              </span>
            )}
          </label>
        </div>

        {form.imageUrl && (
          <div>
            <p className="mb-2 text-sm font-medium">Image preview</p>
            <img src={form.imageUrl} alt="Product preview" className="h-40 w-32 object-cover" />
          </div>
        )}

        {/* Where this belongs — a product can be in as many of these as
            apply. Checking "Bags" under Women and "Bags" under Accessories
            is two clicks, and it shows up browsing either. */}
        <fieldset className="border-t border-[var(--line)] pt-6">
          <legend className="text-sm font-medium">
            Categories <span className="font-normal text-[var(--ink-500)]">— pick every one that applies</span>
          </legend>
          <div className="mt-4 border border-[var(--line)]">
            {tree.map((major) => (
              <CategoryCheckboxRow
                key={major.id}
                category={major}
                depth={0}
                selectedCategoryIds={selectedCategoryIds}
                toggleCategory={toggleCategory}
                expandedCategoryIds={expandedCategoryIds}
                toggleExpandedCategory={toggleExpandedCategory}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--ink-500)]">
            Need a category that isn't here? <Link to="/admin/categories" className="underline">Add it</Link> — it'll show up here immediately.
          </p>
        </fieldset>

        <fieldset className="border-t border-[var(--line)] pt-6">
          <legend className="text-sm font-medium">
            Tags <span className="font-normal text-[var(--ink-500)]">— powers Mood, Occasion, Weather and Style discovery</span>
          </legend>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {filterTypes.map((filterType) => (
              <div key={filterType.id}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink-500)]">
                  {filterType.name}
                </h2>
                <div className="mt-3 space-y-2">
                  {tagsByType(filterType.slug).map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={() => toggleTag(tag.id)}
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-wrap gap-8 border-t border-[var(--line)] pt-6">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="featured"
              checked={form.featured}
              onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))}
              className="mt-1 h-4 w-4 accent-(--color-accent-orange)"
            />
            <span>
              <span className="block font-medium">Featured</span>
              <span className="mt-1 block text-[var(--ink-500)]">Editorial pick — shown in featured collections.</span>
            </span>
          </label>
          {productId && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="archived"
                checked={form.archived}
                disabled={!canArchive && !form.archived}
                onChange={(event) => setForm((current) => ({ ...current, archived: event.target.checked }))}
                className="mt-1 h-4 w-4 accent-black"
              />
              <span>
                <span className="block font-medium">Archive this product</span>
                <span className="mt-1 block text-[var(--ink-500)]">Only available when every variant is sold out.</span>
              </span>
            </label>
          )}
        </fieldset>

        <div className="flex gap-4 border-t border-[var(--line)] pt-6">
          <SubmitButton type="submit" loading={saving} loadingLabel="Saving">
            {productId ? "Save changes" : "Create product"}
          </SubmitButton>
        </div>
      </form>

      {/* Variants appear the instant the product exists — no save-and-
          reload trip required to reach them. */}
      {productId ? (
        <section className="mt-12 border-t border-[var(--ink-900)] pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold">Variants</h2>
            <p className="text-sm text-[var(--ink-500)]">
              {variants.length} variant{variants.length === 1 ? "" : "s"}
            </p>
          </div>

          <form onSubmit={createVariant} className="mt-6 grid gap-3 border-b border-[var(--line)] pb-6 md:grid-cols-[1fr_0.8fr_1fr_0.7fr_1.4fr_auto] md:items-end">
            {[["color", "Color"], ["size", "Size"], ["sku", "SKU"]].map(([name, label]) => (
              <label key={name} className="text-sm">
                <span className="mb-2 block font-medium">{label}</span>
                <input
                  required
                  name={name}
                  value={variantForm[name]}
                  onChange={updateVariantField}
                  className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
                />
              </label>
            ))}
            <label className="text-sm">
              <span className="mb-2 block font-medium">Stock</span>
              <input
                required
                min="0"
                step="1"
                type="number"
                name="stock"
                value={variantForm.stock}
                onChange={updateVariantField}
                className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
              />
            </label>
            <label className="text-sm">
              <span className="mb-2 block font-medium">Image URL</span>
              <input
                type="text"
                name="imageUrl"
                value={variantForm.imageUrl}
                onChange={updateVariantField}
                placeholder="https://..."
                className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
              />
            </label>
            <SubmitButton type="submit" loading={variantSavingId === "new"} loadingLabel="Saving">
              Add variant
            </SubmitButton>
          </form>

          <div className="mt-6 space-y-2 border-t border-[var(--ink-900)] pt-2">
            {variants.length === 0 && (
              <p className="py-6 text-sm text-[var(--ink-500)]">
                No variants yet — add at least one above (color, size and stock) before this product can be bought.
              </p>
            )}
            {variants.map((variant) => (
              <details key={variant.id} className="border-b border-[var(--line)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm marker:hidden">
                  <span className="min-w-0">
                    <span className="font-medium">{variant.color} / {variant.size}</span>
                    <span className="ml-3 font-mono text-xs text-[var(--ink-500)]">{variant.sku}</span>
                  </span>
                  <span className="shrink-0 text-[var(--ink-700)]">{variant.stock} in stock</span>
                </summary>
                <div className="grid gap-5 border-t border-[var(--line)] py-5 md:grid-cols-[auto_1fr]">
                  {variant.images?.[0] ? (
                    <img src={variant.images[0]} alt="" className="h-28 w-24 object-cover" />
                  ) : (
                    <div className="flex h-28 w-24 items-center justify-center bg-[var(--surface-muted)] text-center text-xs text-[var(--ink-300)]">
                      No image
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-4">
                    <label className="text-sm">
                      <span className="mb-2 block font-medium">Stock</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={stockDrafts[variant.id] ?? variant.stock}
                        onChange={(event) =>
                          setStockDrafts((current) => ({ ...current, [variant.id]: event.target.value }))
                        }
                        onBlur={() => saveVariantStock(variant)}
                        className="w-24 border border-[var(--line)] px-2 py-2"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => saveVariantStock(variant)}
                      disabled={variantSavingId === variant.id}
                      className="text-sm underline disabled:opacity-50"
                    >
                      {variantSavingId === variant.id && variantAction === "saving" ? <Spinner label="Saving" /> : "Save stock"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVariant(variant.id)}
                      disabled={variantSavingId === variant.id}
                      className="text-sm text-red-700 underline disabled:opacity-50"
                    >
                      {variantSavingId === variant.id && variantAction === "deleting" ? <Spinner label="Deleting" /> : "Delete"}
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : (
        <p className="mt-10 border-t border-[var(--line)] pt-6 text-sm text-[var(--ink-500)]">
          Save the product above to start adding variants — you'll stay right here.
        </p>
      )}
    </main>
  );
};

export default AdminProductForm;
