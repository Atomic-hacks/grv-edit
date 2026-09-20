import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const departments = [
  { value: "men", label: "Men", gender: "men", categoryId: "apparel" },
  { value: "women", label: "Women", gender: "women", categoryId: "apparel" },
  {
    value: "accessories",
    label: "Accessories",
    gender: "unisex",
    categoryId: "accessories",
  },
];

const emptyForm = {
  name: "",
  description: "",
  brandId: "",
  department: "men",
  subcategoryId: "",
  basePrice: "",
  discountPercent: "",
  imageUrl: "",
  archived: false,
};

const emptyVariantForm = {
  color: "",
  size: "",
  sku: "",
  stock: "10",
  imageUrl: "",
};

const AdminProductForm = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { session } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [brands, setBrands] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [filterTypes, setFilterTypes] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [variants, setVariants] = useState([]);
  const [variantForm, setVariantForm] = useState(emptyVariantForm);
  const [stockDrafts, setStockDrafts] = useState({});
  const [variantSavingId, setVariantSavingId] = useState(null);
  const [variantAction, setVariantAction] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      request("/api/brands"),
      request("/api/admin/subcategories"),
      request("/api/tags"),
      request("/api/filter-types"),
      isEditing ? request(`/api/admin/products/${id}`) : Promise.resolve(null),
    ])
      .then(
        ([brandData, subcategoryData, tagData, filterTypeData, product]) => {
          if (cancelled) return;
          setBrands(brandData);
          setSubcategories(subcategoryData);
          setTags(tagData);
          setFilterTypes(filterTypeData);
          if (product) {
            const department =
              product.categoryId === "accessories"
                ? "accessories"
                : product.gender === "women"
                  ? "women"
                  : "men";
            setForm({
              name: product.name,
              description: product.description,
              brandId: product.brandId,
              department,
              subcategoryId: product.subcategoryId || "",
              basePrice: String(product.basePrice),
              discountPercent:
                product.discountPercent === null ||
                product.discountPercent === undefined
                  ? ""
                  : String(product.discountPercent),
              imageUrl: product.imageUrl || "",
              archived: Boolean(product.archived),
            });
            setSelectedTagIds(product.tags.map((tag) => tag.id));
            setVariants(product.variants || []);
            setStockDrafts(
              Object.fromEntries(
                (product.variants || []).map((variant) => [
                  variant.id,
                  String(variant.stock),
                ]),
              ),
            );
          }
        },
      )
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

  const selectedDepartment = departments.find(
    (department) => department.value === form.department,
  );
  const filteredSubcategories = useMemo(
    () =>
      subcategories.filter(
        (subcategory) =>
          subcategory.categoryId === selectedDepartment?.categoryId,
      ),
    [selectedDepartment?.categoryId, subcategories],
  );
  const canArchive =
    isEditing &&
    variants.length > 0 &&
    variants.every((variant) => variant.stock === 0);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "department") {
        const nextDepartment = departments.find((item) => item.value === value);
        const nextSubcategories = subcategories.filter(
          (subcategory) =>
            subcategory.categoryId === nextDepartment?.categoryId,
        );
        next.subcategoryId = nextSubcategories.some(
          (subcategory) => subcategory.id === current.subcategoryId,
        )
          ? current.subcategoryId
          : "";
      }
      return next;
    });
  };

  const uploadMainImage = async (event) => {
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
      current.includes(tagId)
        ? current.filter((idValue) => idValue !== tagId)
        : [...current, tagId],
    );
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        description: form.description,
        brandId: form.brandId,
        categoryId: selectedDepartment.categoryId,
        subcategoryId: form.subcategoryId,
        gender: selectedDepartment.gender,
        basePrice: form.basePrice,
        discountPercent:
          form.discountPercent === "" ? null : form.discountPercent,
        imageUrl: form.imageUrl,
        archived: form.archived,
      };
      const product = await request(
        isEditing ? `/api/admin/products/${id}` : "/api/admin/products",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      await request(`/api/admin/products/${product.id}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tagIds: selectedTagIds }),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      navigate("/admin/products");
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
      const variant = await request(`/api/admin/products/${id}/variants`, {
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
      setStockDrafts((current) => ({
        ...current,
        [savedVariant.id]: String(savedVariant.stock),
      }));
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
      const updatedVariant = await request(
        `/api/admin/variants/${variant.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ stock }),
        },
      );
      setVariants((current) =>
        current.map((currentVariant) =>
          currentVariant.id === updatedVariant.id
            ? updatedVariant
            : currentVariant,
        ),
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
      setVariants((current) =>
        current.filter((variant) => variant.id !== variantId),
      );
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

  const tagsByType = (slug) =>
    tags.filter((tag) => tag.filterType?.slug === slug);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-20">
        <Spinner label="Loading product" className="text-sm text-gray-500" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-black pb-6">
        <Link
          to="/admin/products"
          className="text-xs uppercase tracking-[0.2em] text-gray-500"
        >
          Products
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">
          {isEditing ? "Edit product" : "New product"}
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

      <form onSubmit={saveProduct} className="mt-8 space-y-8">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Name</span>
            <input
              required
              name="name"
              value={form.name}
              onChange={updateField}
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Brand</span>
            <select
              required
              name="brandId"
              value={form.brandId}
              onChange={updateField}
              className="w-full border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
            >
              <option value="">Select a brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
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
              rows={5}
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Department</span>
            <select
              required
              name="department"
              value={form.department}
              onChange={updateField}
              className="w-full border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
            >
              {departments.map((department) => (
                <option key={department.value} value={department.value}>
                  {department.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Subcategory</span>
            <select
              required
              name="subcategoryId"
              value={form.subcategoryId}
              onChange={updateField}
              className="w-full border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
            >
              <option value="">Select a subcategory</option>
              {filteredSubcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
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
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
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
              className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Main product image</span>
            <input
              type="file"
              accept="image/*"
              onChange={uploadMainImage}
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

        {form.imageUrl && (
          <div>
            <p className="mb-2 text-sm font-medium">Image preview</p>
            <img
              src={form.imageUrl}
              alt="Product preview"
              className="h-40 w-32 object-cover"
            />
          </div>
        )}

        <fieldset>
          <legend className="text-sm font-medium">Tags</legend>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {filterTypes.map((filterType) => (
              <div key={filterType.id}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                  {filterType.name}
                </h2>
                <div className="mt-3 space-y-2">
                  {tagsByType(filterType.slug).map((tag) => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 text-sm"
                    >
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

        {isEditing && (
          <label className="flex items-start gap-3 border-t border-gray-200 pt-6 text-sm">
            <input
              type="checkbox"
              name="archived"
              checked={form.archived}
              disabled={!canArchive && !form.archived}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  archived: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 accent-black"
            />
            <span>
              <span className="block font-medium">Archive this product</span>
              <span className="mt-1 block text-gray-500">
                Archive is only available when every variant is sold out.
              </span>
            </span>
          </label>
        )}

        <div className="flex gap-4 border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Spinner label="Saving" /> : "Save product"}
          </button>
          <Link to="/admin/products" className="px-5 py-3 text-sm underline">
            Cancel
          </Link>
        </div>
      </form>

      {isEditing && (
        <section className="mt-12 border-t border-black pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold">Variants</h2>
            <p className="text-sm text-gray-500">
              {variants.length} variant{variants.length === 1 ? "" : "s"}
            </p>
          </div>

          <form
            onSubmit={createVariant}
            className="mt-6 grid gap-3 border-b border-gray-200 pb-6 md:grid-cols-[1fr_0.8fr_1fr_0.7fr_1.4fr_auto] md:items-end"
          >
            {[
              ["color", "Color"],
              ["size", "Size"],
              ["sku", "SKU"],
            ].map(([name, label]) => (
              <label key={name} className="text-sm">
                <span className="mb-2 block font-medium">{label}</span>
                <input
                  required
                  name={name}
                  value={variantForm[name]}
                  onChange={updateVariantField}
                  className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
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
                className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
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
                className="w-full border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
              />
            </label>
            <button
              type="submit"
              disabled={variantSavingId === "new"}
              className="border border-black bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {variantSavingId === "new" ? (
                <Spinner label="Saving" />
              ) : (
                "Add variant"
              )}
            </button>
          </form>

          <div className="mt-6 space-y-2 border-t border-black pt-2">
            {variants.map((variant) => (
              <details key={variant.id} className="border-b border-gray-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm marker:hidden">
                  <span className="min-w-0">
                    <span className="font-medium">
                      {variant.color} / {variant.size}
                    </span>
                    <span className="ml-3 font-mono text-xs text-gray-500">
                      {variant.sku}
                    </span>
                  </span>
                  <span className="shrink-0 text-gray-600">
                    {variant.stock} in stock
                  </span>
                </summary>
                <div className="grid gap-5 border-t border-gray-100 py-5 md:grid-cols-[auto_1fr]">
                  {variant.images?.[0] ? (
                    <img
                      src={variant.images[0]}
                      alt=""
                      className="h-28 w-24 object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-24 items-center justify-center bg-gray-100 text-center text-xs text-gray-400">
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
                          setStockDrafts((current) => ({
                            ...current,
                            [variant.id]: event.target.value,
                          }))
                        }
                        onBlur={() => saveVariantStock(variant)}
                        className="w-24 border border-gray-300 px-2 py-2"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => saveVariantStock(variant)}
                      disabled={variantSavingId === variant.id}
                      className="text-sm underline disabled:opacity-50"
                    >
                      {variantSavingId === variant.id &&
                      variantAction === "saving" ? (
                        <Spinner label="Saving" />
                      ) : (
                        "Save stock"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVariant(variant.id)}
                      disabled={variantSavingId === variant.id}
                      className="text-sm text-red-700 underline disabled:opacity-50"
                    >
                      {variantSavingId === variant.id &&
                      variantAction === "deleting" ? (
                        <Spinner label="Deleting" />
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default AdminProductForm;
