import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest, fetchCategories } from "../lib/apiClient";
import { uploadMedia } from "../lib/uploadMedia";
import { getCategoryHref, getCategoryPath } from "../lib/categoryTree";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import InlineNotice from "../component/ui/InlineNotice";
import SubmitButton from "../component/ui/SubmitButton";
import Spinner from "../component/ui/Spinner";
import LinkPicker from "./LinkPicker";
import ListToolbar from "../component/admin/ListToolbar";

const PAGES = [
  { value: "HOME", label: "Home", href: "/" },
  { value: "SHOP", label: "Shop", href: "/shop" },
  { value: "DEPARTMENTS", label: "Departments", href: "/catalogues" },
  { value: "CATEGORY", label: "A category page" },
];

const LAYOUTS = [
  { value: "HERO", label: "Hero", help: "Full-screen image or video with title, description and button. A page shows its first visible hero." },
  { value: "BANNER", label: "Banner", help: "Wide image or video block with text and a button." },
  { value: "TILES", label: "Tile grid", help: "Grid of linked image tiles — departments, brands, edits." },
  { value: "BENTO", label: "Collage", help: "Asymmetric collage of linked image tiles." },
  { value: "PRODUCTS", label: "Product rail", help: "Scrolling row of products from a source you pick." },
  { value: "BRANDS", label: "Brand grid", help: "Every brand, kept up to date automatically." },
];

const PRODUCT_SOURCES = [
  { value: "NEW_ARRIVALS", label: "New arrivals (last 30 days)" },
  { value: "FEATURED", label: "Featured products" },
  { value: "CATEGORY", label: "A category" },
  { value: "BRAND", label: "A brand" },
];

const BLANK = {
  id: null,
  page: "SHOP",
  categoryId: "",
  layout: "BANNER",
  eyebrow: "",
  title: "",
  description: "",
  ctaLabel: "",
  ctaUrl: "",
  ctaNewCategory: null,
  mediaType: "IMAGE",
  imageUrl: "",
  videoUrl: "",
  items: [],
  productSource: "NEW_ARRIVALS",
  sourceCategoryId: "",
  sourceBrandId: "",
  productLimit: 12,
  active: true,
};

const inputClass =
  "mt-1.5 w-full border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ink-900)]";

const layoutLabel = (value) => LAYOUTS.find((layout) => layout.value === value)?.label || value;

const Field = ({ label, hint, children }) => (
  <label className="block text-sm">
    <span className="font-medium">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-[var(--ink-500)]">{hint}</span>}
  </label>
);

const MediaPreview = ({ url, video }) =>
  url ? (
    video ? (
      <video src={url} muted playsInline className="mt-2 h-28 w-full bg-black object-cover" />
    ) : (
      <img src={url} alt="" className="mt-2 h-28 w-full object-cover" />
    )
  ) : null;

const sectionThumb = (section) =>
  section.imageUrl || (Array.isArray(section.items) ? section.items[0]?.imageUrl : null);

const AdminContentSections = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [busyId, setBusyId] = useState("");

  const sectionsQuery = useQuery({
    queryKey: ["admin", "content-sections"],
    queryFn: () => request("/api/admin/content-sections"),
    enabled: Boolean(session),
  });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const brandsQuery = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: () => request("/api/admin/brands"),
    enabled: Boolean(session),
  });
  const sections = sectionsQuery.data || [];
  const categories = useMemo(() => categoriesQuery.data || [], [categoriesQuery.data]);
  const brands = brandsQuery.data || [];

  // "Men › Footwear", not just "Footwear" — the same name can exist under
  // several parents, so a bare name would be ambiguous in a picker.
  const categoryOptions = useMemo(
    () =>
      categories
        .map((category) => ({
          id: category.id,
          label: getCategoryPath(categories, category.id).map((c) => c.name).join(" › "),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categories],
  );
  const categoryLabel = (id) => categoryOptions.find((option) => option.id === id)?.label || "Unknown category";

  // Sections grouped by where they appear, in display order.
  const groups = useMemo(() => {
    const byKey = new Map();
    for (const section of sections) {
      const key = `${section.page}:${section.categoryId || ""}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(section);
    }
    const order = PAGES.map((page) => page.value);
    return [...byKey.entries()]
      .map(([key, items]) => {
        const { page, categoryId } = items[0];
        const pageInfo = PAGES.find((p) => p.value === page);
        return {
          key,
          page,
          title: page === "CATEGORY" ? `Category: ${categoryLabel(categoryId)}` : pageInfo.label,
          href: page === "CATEGORY" ? getCategoryHref(categories, categoryId) : pageInfo.href,
          items: [...items].sort((a, b) => a.position - b.position),
        };
      })
      .sort((a, b) => order.indexOf(a.page) - order.indexOf(b.page) || a.title.localeCompare(b.title));
    // categoryLabel/categories are derived from the same query data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, categories, categoryOptions]);

  // Search + page filter. Each row keeps its index in the full, ordered list,
  // so the ↑/↓ buttons still move the right section while a filter is on.
  const [sectionQuery, setSectionQuery] = useState("");
  const [pageFilter, setPageFilter] = useState("");
  const sectionNeedle = sectionQuery.trim().toLowerCase();
  const visibleGroups = groups
    .filter((group) => !pageFilter || group.page === pageFilter)
    .map((group) => ({
      ...group,
      shown: group.items
        .map((section, index) => ({ section, index }))
        .filter(
          ({ section }) =>
            !sectionNeedle ||
            `${section.title} ${section.eyebrow || ""} ${section.layout} ${group.title}`.toLowerCase().includes(sectionNeedle),
        ),
    }))
    .filter((group) => group.shown.length > 0);
  const shownCount = visibleGroups.reduce((sum, group) => sum + group.shown.length, 0);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const clearMessages = () => {
    setError("");
    setNotice("");
  };
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "content-sections"] });
    await queryClient.invalidateQueries({ queryKey: ["content-sections"] });
  };

  const startNew = (page = "SHOP", categoryId = "") => {
    clearMessages();
    setForm({ ...BLANK, page, categoryId });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const edit = (section) => {
    clearMessages();
    setForm({
      ...BLANK,
      ...Object.fromEntries(Object.entries(section).map(([key, value]) => [key, value ?? ""])),
      productSource: section.productSource || "NEW_ARRIVALS",
      productLimit: section.productLimit || 12,
      active: section.active,
      items: Array.isArray(section.items) ? section.items : [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const payload = () => {
    const usesMedia = form.layout === "HERO" || form.layout === "BANNER";
    const usesTiles = form.layout === "TILES" || form.layout === "BENTO";
    return {
      page: form.page,
      categoryId: form.page === "CATEGORY" ? form.categoryId || null : null,
      layout: form.layout,
      eyebrow: form.eyebrow,
      title: form.title,
      description: form.description,
      ctaLabel: form.ctaLabel,
      ctaUrl: form.ctaUrl,
      mediaType: form.mediaType,
      imageUrl: usesMedia ? form.imageUrl : null,
      videoUrl: usesMedia && form.mediaType === "VIDEO" ? form.videoUrl : null,
      items: usesTiles ? form.items : null,
      productSource: form.layout === "PRODUCTS" ? form.productSource : null,
      sourceCategoryId: form.sourceCategoryId || null,
      sourceBrandId: form.sourceBrandId || null,
      productLimit: Number(form.productLimit) || 12,
      active: form.active,
    };
  };

  // Creates the category a link asked for and returns the URL it lives at.
  const createCategoryFor = async (pending) => {
    const created = await request("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name: pending.name.trim(), parentId: pending.parentId || null }),
    });
    const parentPath = pending.parentId ? getCategoryHref(categories, pending.parentId) : "";
    return `${parentPath}/${created.slug}`;
  };

  const save = async (event) => {
    event.preventDefault();
    clearMessages();
    setSaving(true);
    try {
      const body = payload();
      let createdAny = false;
      if (form.ctaNewCategory?.name?.trim()) {
        body.ctaUrl = await createCategoryFor(form.ctaNewCategory);
        createdAny = true;
      }
      if (body.items) {
        const items = [];
        for (const { newCategory, ...tile } of body.items) {
          if (newCategory?.name?.trim()) {
            tile.url = await createCategoryFor(newCategory);
            createdAny = true;
          }
          items.push(tile);
        }
        body.items = items;
      }
      if (createdAny) await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await request(
        form.id ? `/api/admin/content-sections/${form.id}` : "/api/admin/content-sections",
        { method: form.id ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      await refresh();
      setNotice(form.id ? `"${form.title}" updated.` : `"${form.title}" created.`);
      setForm(BLANK);
    } catch (saveError) {
      setError(saveError.message || "Could not save this section.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (section) => {
    clearMessages();
    setBusyId(section.id);
    try {
      await request(`/api/admin/content-sections/${section.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !section.active }),
      });
      await refresh();
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusyId("");
    }
  };

  const remove = async (section) => {
    if (!window.confirm(`Delete "${section.title}"? This can't be undone — hiding it is reversible.`)) return;
    clearMessages();
    setBusyId(section.id);
    try {
      await request(`/api/admin/content-sections/${section.id}`, { method: "DELETE" });
      await refresh();
      if (form.id === section.id) setForm(BLANK);
      setNotice(`"${section.title}" deleted.`);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusyId("");
    }
  };

  const move = async (group, index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= group.items.length) return;
    const ids = group.items.map((section) => section.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    clearMessages();
    setBusyId(group.items[index].id);
    try {
      await request("/api/admin/content-sections/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      await refresh();
    } catch (moveError) {
      setError(moveError.message);
    } finally {
      setBusyId("");
    }
  };

  const upload = async (event, onUrl, key) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    clearMessages();
    setUploading(key);
    try {
      onUrl(await uploadMedia(request, file));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading("");
    }
  };

  const updateTile = (index, field, value) =>
    set("items", form.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  const moveTile = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.items.length) return;
    const items = [...form.items];
    [items[index], items[target]] = [items[target], items[index]];
    set("items", items);
  };

  const layoutHelp = LAYOUTS.find((layout) => layout.value === form.layout)?.help;
  const usesMedia = form.layout === "HERO" || form.layout === "BANNER";
  const usesTiles = form.layout === "TILES" || form.layout === "BENTO";

  return (
    <main className="max-w-6xl py-10 md:py-14">
      <AdminPageHeader
        title="Page Sections"
        subtitle="Everything on Home, Shop, Departments and category landing pages — what shows, in what order. Changes go live within about a minute."
        count={sectionsQuery.isPending ? undefined : `${sections.length} sections`}
      />

      {error && <InlineNotice tone="error" className="mt-6">{error}</InlineNotice>}
      {notice && <InlineNotice tone="success" className="mt-6">{notice}</InlineNotice>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Sections, grouped by page */}
        <div className="order-2 space-y-10 lg:order-1">
          {sectionsQuery.isPending ? (
            <Spinner label="Loading sections" className="text-sm text-[var(--ink-500)]" />
          ) : groups.length === 0 ? (
            <p className="meta-text">No sections yet — create the first one with the form.</p>
          ) : (
            <>
              <ListToolbar
                controls={{
                  query: sectionQuery,
                  setQuery: setSectionQuery,
                  sorts: [{ value: "order", label: "Page order" }],
                  sortKey: "order",
                  matched: shownCount,
                  total: sections.length,
                }}
                placeholder="Search sections by title or type"
                noun="sections"
              >
                <label className="flex items-center gap-2 text-[12px] text-[var(--ink-500)]">
                  Page
                  <select
                    value={pageFilter}
                    onChange={(event) => setPageFilter(event.target.value)}
                    className="border border-[var(--line)] bg-white px-3 py-2.5 text-[13px] text-[var(--ink-900)] outline-none focus:border-[var(--ink-900)]"
                  >
                    <option value="">All pages</option>
                    {PAGES.map((page) => <option key={page.value} value={page.value}>{page.label}</option>)}
                  </select>
                </label>
              </ListToolbar>
              {visibleGroups.length === 0 && <p className="meta-text">No sections match.</p>}
              {visibleGroups.map((group) => (
              <section key={group.key}>
                <div className="flex items-baseline justify-between gap-3 border-b border-[var(--ink-900)] pb-2">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em]">{group.title}</h2>
                  <div className="flex gap-4 text-[11px] font-semibold">
                    {group.href && (
                      <a href={group.href} target="_blank" rel="noreferrer" className="text-[var(--ink-500)] underline underline-offset-4 hover:text-[var(--ink-900)]">
                        View page
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => startNew(group.page, group.items[0].categoryId || "")}
                      className="underline underline-offset-4"
                    >
                      + Add here
                    </button>
                  </div>
                </div>
                <ol className="divide-y divide-[var(--line)]">
                  {group.shown.map(({ section, index }) => (
                    <li key={section.id} className={`flex items-center gap-3 py-3 ${section.active ? "" : "opacity-55"}`}>
                      <div className="h-12 w-16 shrink-0 overflow-hidden bg-[var(--surface-muted)]">
                        {sectionThumb(section) && (
                          <img src={sectionThumb(section)} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{section.title}</p>
                        <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)]">
                          {layoutLabel(section.layout)}
                          {section.mediaType === "VIDEO" && (section.layout === "HERO" || section.layout === "BANNER") ? " · video" : ""}
                          {section.active ? "" : " · hidden"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold">
                        <button type="button" aria-label="Move up" disabled={busyId === section.id || index === 0} onClick={() => move(group, index, -1)} className="border border-[var(--line)] px-2 py-1 hover:border-[var(--ink-900)] disabled:opacity-30">↑</button>
                        <button type="button" aria-label="Move down" disabled={busyId === section.id || index === group.items.length - 1} onClick={() => move(group, index, 1)} className="border border-[var(--line)] px-2 py-1 hover:border-[var(--ink-900)] disabled:opacity-30">↓</button>
                        <button type="button" disabled={busyId === section.id} onClick={() => toggleActive(section)} className="ml-2 underline underline-offset-4">
                          {section.active ? "Hide" : "Show"}
                        </button>
                        <button type="button" onClick={() => edit(section)} className="ml-2 underline underline-offset-4">Edit</button>
                        <button type="button" disabled={busyId === section.id} onClick={() => remove(section)} className="ml-2 text-red-700 underline underline-offset-4">Delete</button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              ))}
            </>
          )}
        </div>

        {/* Create / edit */}
        <form onSubmit={save} className="order-1 h-fit space-y-5 border border-[var(--line)] p-6 lg:sticky lg:top-6 lg:order-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
              {form.id ? "Edit section" : "New section"}
            </h2>
            {form.id && (
              <button type="button" onClick={() => startNew()} className="text-xs underline">Cancel</button>
            )}
          </div>

          <Field label="Appears on">
            <select value={form.page} onChange={(event) => set("page", event.target.value)} className={`${inputClass} bg-white`}>
              {PAGES.map((page) => <option key={page.value} value={page.value}>{page.label}</option>)}
            </select>
          </Field>
          {form.page === "CATEGORY" && (
            <Field label="Which category page">
              <select required value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)} className={`${inputClass} bg-white`}>
                <option value="">Choose a category</option>
                {categoryOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </Field>
          )}

          <Field label="Layout" hint={layoutHelp}>
            <select value={form.layout} onChange={(event) => set("layout", event.target.value)} className={`${inputClass} bg-white`}>
              {LAYOUTS.map((layout) => <option key={layout.value} value={layout.value}>{layout.label}</option>)}
            </select>
          </Field>

          <Field label="Title">
            <input required value={form.title} onChange={(event) => set("title", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Eyebrow" hint="Optional small line above the title, e.g. “Just in”.">
            <input value={form.eyebrow} onChange={(event) => set("eyebrow", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={form.description} onChange={(event) => set("description", event.target.value)} className={inputClass} />
          </Field>

          {usesMedia && (
            <div className="space-y-4 border-t border-[var(--line)] pt-4">
              <div className="flex gap-4 text-sm">
                {["IMAGE", "VIDEO"].map((type) => (
                  <label key={type} className="flex items-center gap-2">
                    <input type="radio" name="mediaType" checked={form.mediaType === type} onChange={() => set("mediaType", type)} className="accent-(--color-accent-orange)" />
                    {type === "IMAGE" ? "Image" : "Video"}
                  </label>
                ))}
              </div>
              {form.mediaType === "VIDEO" && (
                <Field label="Video" hint="MP4 under 100MB. It's compressed and resized for each visitor automatically.">
                  <input value={form.videoUrl} onChange={(event) => set("videoUrl", event.target.value)} placeholder="Upload below, or paste a URL" className={inputClass} />
                  <input type="file" accept="video/*" disabled={Boolean(uploading)} onChange={(event) => upload(event, (url) => set("videoUrl", url), "video")} className="mt-2 block w-full text-xs" />
                  {uploading === "video" && <Spinner label="Uploading video" className="mt-2 text-xs text-[var(--ink-500)]" />}
                  <MediaPreview url={form.videoUrl} video />
                </Field>
              )}
              <Field
                label={form.mediaType === "VIDEO" ? "Poster image (optional)" : "Image"}
                hint={form.mediaType === "VIDEO" ? "Shown while the video loads, and to visitors who've turned off motion. Leave empty to use the video's first frame." : undefined}
              >
                <input value={form.imageUrl} onChange={(event) => set("imageUrl", event.target.value)} placeholder="Upload below, or paste a URL" className={inputClass} />
                <input type="file" accept="image/*" disabled={Boolean(uploading)} onChange={(event) => upload(event, (url) => set("imageUrl", url), "image")} className="mt-2 block w-full text-xs" />
                {uploading === "image" && <Spinner label="Uploading image" className="mt-2 text-xs text-[var(--ink-500)]" />}
                <MediaPreview url={form.imageUrl} />
              </Field>
            </div>
          )}

          {usesTiles && (
            <div className="space-y-3 border-t border-[var(--line)] pt-4">
              <div className="flex items-center justify-between text-sm font-medium">
                Tiles ({form.items.length})
                <button type="button" onClick={() => set("items", [...form.items, { title: "", url: "", imageUrl: "" }])} className="text-xs underline">+ Add tile</button>
              </div>
              {form.items.map((tile, index) => (
                <div key={index} className="space-y-2 border border-[var(--line)] p-3">
                  <div className="flex gap-3">
                    <div className="h-16 w-14 shrink-0 bg-[var(--surface-muted)]">
                      {tile.imageUrl && <img src={tile.imageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input required placeholder="Title" value={tile.title} onChange={(event) => updateTile(index, "title", event.target.value)} className="w-full border border-[var(--line)] px-2 py-1.5 text-sm" />
                      <LinkPicker
                        value={tile.url}
                        onChange={(url) => updateTile(index, "url", url)}
                        pending={tile.newCategory || null}
                        onPendingChange={(newCategory) => updateTile(index, "newCategory", newCategory)}
                        categories={categories}
                        categoryOptions={categoryOptions}
                        brands={brands}
                      />
                    </div>
                  </div>
                  <input required placeholder="Image URL" value={tile.imageUrl} onChange={(event) => updateTile(index, "imageUrl", event.target.value)} className="w-full border border-[var(--line)] px-2 py-1.5 text-xs" />
                  <input type="file" accept="image/*" disabled={Boolean(uploading)} onChange={(event) => upload(event, (url) => updateTile(index, "imageUrl", url), `tile-${index}`)} className="block w-full text-xs" />
                  {uploading === `tile-${index}` && <Spinner label="Uploading" className="text-xs text-[var(--ink-500)]" />}
                  <div className="flex gap-3 text-xs">
                    <button type="button" onClick={() => moveTile(index, -1)} disabled={index === 0} className="underline disabled:opacity-30">Move up</button>
                    <button type="button" onClick={() => moveTile(index, 1)} disabled={index === form.items.length - 1} className="underline disabled:opacity-30">Move down</button>
                    <button type="button" onClick={() => set("items", form.items.filter((_, i) => i !== index))} className="ml-auto text-red-700 underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {form.layout === "PRODUCTS" && (
            <div className="space-y-4 border-t border-[var(--line)] pt-4">
              <Field label="Products from">
                <select value={form.productSource} onChange={(event) => set("productSource", event.target.value)} className={`${inputClass} bg-white`}>
                  {PRODUCT_SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                </select>
              </Field>
              {form.productSource === "CATEGORY" && (
                <Field label="Category" hint="Includes everything nested under it.">
                  <select required value={form.sourceCategoryId} onChange={(event) => set("sourceCategoryId", event.target.value)} className={`${inputClass} bg-white`}>
                    <option value="">Choose a category</option>
                    {categoryOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </Field>
              )}
              {form.productSource === "BRAND" && (
                <Field label="Brand">
                  <select required value={form.sourceBrandId} onChange={(event) => set("sourceBrandId", event.target.value)} className={`${inputClass} bg-white`}>
                    <option value="">Choose a brand</option>
                    {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="How many products">
                <input type="number" min="1" max="24" value={form.productLimit} onChange={(event) => set("productLimit", event.target.value)} className={`${inputClass} w-24`} />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4">
            <Field label="Button text">
              <input value={form.ctaLabel} onChange={(event) => set("ctaLabel", event.target.value)} placeholder="Shop now" className={inputClass} />
            </Field>
            <Field label="Button link">
              <LinkPicker
                value={form.ctaUrl}
                onChange={(url) => set("ctaUrl", url)}
                pending={form.ctaNewCategory || null}
                onPendingChange={(pending) => set("ctaNewCategory", pending)}
                categories={categories}
                categoryOptions={categoryOptions}
                brands={brands}
              />
            </Field>
          </div>
          {form.layout === "PRODUCTS" && (
            <p className="-mt-3 text-xs text-[var(--ink-500)]">Leave both empty to link to the source automatically.</p>
          )}

          <label className="flex items-center gap-2 border-t border-[var(--line)] pt-4 text-sm">
            <input type="checkbox" checked={form.active} onChange={(event) => set("active", event.target.checked)} className="h-4 w-4 accent-(--color-accent-orange)" />
            Visible on the storefront
          </label>

          <SubmitButton type="submit" loading={saving} loadingLabel="Saving" disabled={Boolean(uploading)} className="w-full">
            {form.id ? "Save changes" : "Create section"}
          </SubmitButton>
        </form>
      </div>
    </main>
  );
};

export default AdminContentSections;
