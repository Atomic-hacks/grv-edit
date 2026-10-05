// Editable page sections for Home, Shop, Departments and category landing
// pages. One generic model (ContentSection) covers every block — hero,
// banner, tile grid, bento collage, product rail, brand grid — so adding a
// "Nigerian Styles" or "Seasonal" section is an admin action, not a code
// change. See prisma/schema.prisma for the field-by-layout breakdown.
import { prisma } from "../../server/prisma.js";
import { requireRole } from "../../server/requireRole.js";
import { recordAdminAction } from "../../server/auditLog.js";
import {
  productInclude,
  serializeProduct,
  NEW_PRODUCT_WINDOW_MS,
  loadCategoryTree,
  collectSubtreeIds,
} from "../../server/catalog.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const CONTENT_PAGES = ["HOME", "SHOP", "DEPARTMENTS", "CATEGORY"];
export const CONTENT_LAYOUTS = ["HERO", "BANNER", "TILES", "BENTO", "PRODUCTS", "BRANDS"];
const MEDIA_TYPES = ["IMAGE", "VIDEO"];
const PRODUCT_SOURCES = ["NEW_ARRIVALS", "FEATURED", "CATEGORY", "BRAND"];
const MAX_TILES = 12;
const CONTENT_ROLES = ["ADMIN"];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// These URLs end up as <a href>, <img src> and <video src> on public pages.
// Only site-relative paths and http(s) URLs are allowed — anything else
// (javascript:, data:, protocol-relative //evil.com) would be a stored XSS
// or open-redirect vector via the admin panel.
export const isSafeUrl = (value) => {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (url.startsWith("/")) return !url.startsWith("//") && !url.startsWith("/\\");
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const optionalText = (value, max = 2000) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
};

const optionalUrl = (value, field) => {
  if (value === undefined) return { value: undefined };
  const text = optionalText(value, 2048);
  if (text === null) return { value: null };
  if (!isSafeUrl(text)) {
    return { error: `${field} must be a site path starting with "/" or an http(s) URL` };
  }
  return { value: text };
};

const parseItems = (raw) => {
  if (!Array.isArray(raw)) return { error: "items must be a list of tiles" };
  if (raw.length === 0) return { error: "Add at least one tile" };
  if (raw.length > MAX_TILES) return { error: `A section can have at most ${MAX_TILES} tiles` };
  const items = [];
  for (const [index, item] of raw.entries()) {
    const title = optionalText(item?.title, 120);
    if (!title) return { error: `Tile ${index + 1} needs a title` };
    if (!isSafeUrl(item?.url)) return { error: `Tile ${index + 1} needs a valid link` };
    if (!isSafeUrl(item?.imageUrl)) return { error: `Tile ${index + 1} needs an image` };
    items.push({ title, url: item.url.trim(), imageUrl: item.imageUrl.trim() });
  }
  return { items };
};

// A link that goes nowhere shows shoppers a "page not found" — and nothing
// else warns the admin, because a section only *links* to a page, it never
// creates one. Pages exist for: the fixed storefront pages below, every
// category (at its full nested path), every brand, and individual products
// and journal posts. Anything else is rejected at save time with a message
// that says how to fix it.
const STATIC_PAGES = new Set([
  "/", "/shop", "/shop-by", "/shop/new-arrivals", "/brands", "/catalogues",
  "/archive", "/about", "/contact", "/journal", "/size-guide", "/privacy-policy",
  "/faq", "/wishlist", "/cart", "/account", "/login", "/signup",
]);

const checkLink = async (url, label, lookups) => {
  if (!url || /^https?:\/\//i.test(url)) return null; // external links can't be checked
  const path = url.split(/[?#]/)[0].replace(/(.)\/+$/, "$1");
  if (STATIC_PAGES.has(path)) return null;
  if (path.startsWith("/product/") || path.startsWith("/journal/")) return null;

  const { categoryPaths, brandKeys } = await lookups();
  if (path.startsWith("/brands/")) {
    return brandKeys.has(path.slice("/brands/".length))
      ? null
      : `${label} points to ${path}, but there is no brand with that name. Check Admin → Brands for the exact slug.`;
  }
  if (categoryPaths.has(path)) return null;
  return `${label} points to ${path}, but no page exists there. A section can't create a page — add a category with the slug "${path.split("/").filter(Boolean).pop() || ""}" in Admin → Categories first (or link to an existing page).`;
};

// Validates the merged (existing + incoming) section as a whole, since most
// rules depend on the layout ("a PRODUCTS section needs a source").
const validateSection = async (section) => {
  let cached;
  const lookups = async () =>
    (cached ||= (async () => {
      const [tree, brands] = await Promise.all([
        loadCategoryTree(),
        prisma.brand.findMany({ select: { id: true, slug: true } }),
      ]);
      const byId = new Map(tree.all.map((category) => [category.id, category]));
      const categoryPaths = new Set();
      for (const category of tree.all) {
        const slugs = [];
        for (let node = category; node; node = node.parentId ? byId.get(node.parentId) : null) {
          slugs.unshift(node.slug);
        }
        categoryPaths.add(`/${slugs.join("/")}`);
      }
      return { categoryPaths, brandKeys: new Set(brands.flatMap((b) => [b.slug, b.id])) };
    })());

  if (!CONTENT_PAGES.includes(section.page)) return "Choose which page this appears on";
  if (!CONTENT_LAYOUTS.includes(section.layout)) return "Choose a layout";
  if (!section.title) return "Title is required";

  if (section.page === "CATEGORY") {
    if (!section.categoryId) return "Choose which category page this appears on";
    const category = await prisma.category.findUnique({
      where: { id: section.categoryId },
      select: { id: true },
    });
    if (!category) return "That category no longer exists";
  }

  if (Boolean(section.ctaLabel) !== Boolean(section.ctaUrl)) {
    return "A call to action needs both button text and a link";
  }

  if (section.layout === "HERO" || section.layout === "BANNER") {
    if (section.mediaType === "VIDEO" && !section.videoUrl) return "Upload or link a video";
    if (section.mediaType === "IMAGE" && !section.imageUrl) return "Upload or link an image";
  }

  if (section.layout === "TILES" || section.layout === "BENTO") {
    const parsed = parseItems(section.items);
    if (parsed.error) return parsed.error;
  }

  if (section.layout === "PRODUCTS") {
    if (!PRODUCT_SOURCES.includes(section.productSource)) {
      return "Choose which products this section shows";
    }
    if (section.productSource === "CATEGORY") {
      if (!section.sourceCategoryId) return "Choose the category to pull products from";
      const exists = await prisma.category.findUnique({
        where: { id: section.sourceCategoryId },
        select: { id: true },
      });
      if (!exists) return "That category no longer exists";
    }
    if (section.productSource === "BRAND") {
      if (!section.sourceBrandId) return "Choose the brand to pull products from";
      const exists = await prisma.brand.findUnique({
        where: { id: section.sourceBrandId },
        select: { id: true },
      });
      if (!exists) return "That brand no longer exists";
    }
  }

  // Only links on sections that will actually be shown are checked, so a
  // hidden draft can still be saved while its target page is being set up.
  if (section.active !== false) {
    const ctaProblem = await checkLink(section.ctaUrl, "The button link", lookups);
    if (ctaProblem) return ctaProblem;
    if (Array.isArray(section.items)) {
      for (const [index, item] of section.items.entries()) {
        const problem = await checkLink(item?.url, `Tile ${index + 1} ("${item?.title || ""}")`, lookups);
        if (problem) return problem;
      }
    }
  }

  return null;
};

// Turns a request body into Prisma data. Unknown fields are ignored; only
// fields present in the body are touched, so updates can be partial.
const sectionDataFrom = (body) => {
  const data = {};
  if (body.page !== undefined) data.page = body.page;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
  if (body.layout !== undefined) data.layout = body.layout;
  for (const field of ["eyebrow", "ctaLabel"]) {
    const value = optionalText(body[field], 120);
    if (value !== undefined) data[field] = value;
  }
  const title = optionalText(body.title, 200);
  if (title !== undefined) data.title = title || "";
  const description = optionalText(body.description, 2000);
  if (description !== undefined) data.description = description;

  for (const field of ["ctaUrl", "imageUrl", "videoUrl"]) {
    const parsed = optionalUrl(body[field], field);
    if (parsed.error) return { error: parsed.error };
    if (parsed.value !== undefined) data[field] = parsed.value;
  }

  if (body.mediaType !== undefined) {
    if (!MEDIA_TYPES.includes(body.mediaType)) return { error: "Choose image or video" };
    data.mediaType = body.mediaType;
  }
  if (body.items !== undefined) {
    if (body.items === null) data.items = null;
    else {
      const parsed = parseItems(body.items);
      if (parsed.error) return { error: parsed.error };
      data.items = parsed.items;
    }
  }
  if (body.productSource !== undefined) data.productSource = body.productSource || null;
  if (body.sourceCategoryId !== undefined) data.sourceCategoryId = body.sourceCategoryId || null;
  if (body.sourceBrandId !== undefined) data.sourceBrandId = body.sourceBrandId || null;
  if (body.productLimit !== undefined) {
    const limit = Number(body.productLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 24) {
      return { error: "Show between 1 and 24 products" };
    }
    data.productLimit = limit;
  }
  if (body.active !== undefined) data.active = Boolean(body.active);
  return { data };
};

// Fields that only make sense for one layout are cleared when the layout
// doesn't use them, so a section switched from PRODUCTS to BANNER doesn't
// keep a dangling product source around.
const normalizeForLayout = (section) => {
  const out = { ...section };
  if (out.page !== "CATEGORY") out.categoryId = null;
  if (out.layout !== "TILES" && out.layout !== "BENTO") out.items = null;
  if (out.layout !== "PRODUCTS") {
    out.productSource = null;
    out.sourceCategoryId = null;
    out.sourceBrandId = null;
  } else {
    if (out.productSource !== "CATEGORY") out.sourceCategoryId = null;
    if (out.productSource !== "BRAND") out.sourceBrandId = null;
  }
  return out;
};

const PERSISTED_FIELDS = [
  "page", "categoryId", "layout", "eyebrow", "title", "description",
  "ctaLabel", "ctaUrl", "mediaType", "imageUrl", "videoUrl", "items",
  "productSource", "sourceCategoryId", "sourceBrandId", "productLimit", "active",
];
const pickPersisted = (section) =>
  Object.fromEntries(PERSISTED_FIELDS.map((field) => [field, section[field] ?? null]));

// ---------------------------------------------------------------------------
// Public: resolved sections for one page
// ---------------------------------------------------------------------------

const categoryHref = (tree, categoryId) => {
  const byId = new Map(tree.all.map((category) => [category.id, category]));
  const slugs = [];
  let current = byId.get(categoryId);
  while (current) {
    slugs.unshift(current.slug);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return slugs.length ? `/${slugs.join("/")}` : null;
};

const loadSectionProducts = async (section, tree) => {
  const where = { archived: false };
  if (section.productSource === "NEW_ARRIVALS") {
    where.createdAt = { gte: new Date(Date.now() - NEW_PRODUCT_WINDOW_MS) };
  } else if (section.productSource === "FEATURED") {
    where.featured = true;
  } else if (section.productSource === "CATEGORY") {
    if (!section.sourceCategoryId) return [];
    const ids = collectSubtreeIds(tree.childrenOf, section.sourceCategoryId);
    where.categories = { some: { categoryId: { in: ids } } };
  } else if (section.productSource === "BRAND") {
    if (!section.sourceBrandId) return [];
    where.brandId = section.sourceBrandId;
  } else {
    return [];
  }
  const products = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: section.productLimit || 12,
  });
  return products.map(serializeProduct);
};

// Where a product rail's "View all" goes when the admin hasn't set their own.
const defaultViewAllUrl = (section, tree) => {
  if (section.productSource === "NEW_ARRIVALS") return "/shop/new-arrivals";
  if (section.productSource === "CATEGORY" && section.sourceCategoryId) {
    return categoryHref(tree, section.sourceCategoryId);
  }
  if (section.productSource === "BRAND" && section.sourceBrandId) {
    const brand = tree.brandsById?.get(section.sourceBrandId);
    return brand ? `/brands/${brand.slug}` : "/brands";
  }
  return null;
};

const resolveSection = async (section, tree, brandsCache) => {
  const base = {
    id: section.id,
    layout: section.layout,
    eyebrow: section.eyebrow,
    title: section.title,
    description: section.description,
    ctaLabel: section.ctaLabel,
    ctaUrl: section.ctaUrl,
    mediaType: section.mediaType,
    imageUrl: section.imageUrl,
    videoUrl: section.videoUrl,
  };
  if (section.layout === "TILES" || section.layout === "BENTO") {
    return { ...base, items: Array.isArray(section.items) ? section.items : [] };
  }
  if (section.layout === "PRODUCTS") {
    const products = await loadSectionProducts(section, tree);
    return {
      ...base,
      products,
      viewAllUrl: section.ctaUrl || defaultViewAllUrl(section, tree),
      viewAllLabel: section.ctaLabel || "View all",
    };
  }
  if (section.layout === "BRANDS") {
    return { ...base, brands: await brandsCache() };
  }
  return base;
};

export const listPublicContentSections = async (url) => {
  const page = url.searchParams.get("page");
  if (!CONTENT_PAGES.includes(page)) {
    return jsonResponse({ error: "Unknown page" }, 400);
  }
  const where = { page, active: true };
  if (page === "CATEGORY") {
    const categoryId = url.searchParams.get("categoryId");
    if (!categoryId) return jsonResponse({ error: "categoryId is required" }, 400);
    where.categoryId = categoryId;
  }

  const sections = await prisma.contentSection.findMany({
    where,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  if (sections.length === 0) return jsonResponse([]);

  const tree = await loadCategoryTree();
  const brandsForLinks = await prisma.brand.findMany({
    select: { id: true, slug: true },
  });
  tree.brandsById = new Map(brandsForLinks.map((brand) => [brand.id, brand]));
  let brandsPromise;
  const brandsCache = () =>
    (brandsPromise ||= prisma.brand.findMany({
      select: { id: true, name: true, slug: true, logo: true },
      orderBy: { name: "asc" },
    }));

  const resolved = await Promise.all(
    sections.map((section) => resolveSection(section, tree, brandsCache)),
  );
  // A product rail with nothing to show is hidden rather than rendered as
  // an empty box — e.g. "New arrivals" during a quiet month.
  // Likewise a brand grid before any brand exists.
  return jsonResponse(
    resolved.filter((section) => {
      if (section.layout === "PRODUCTS") return section.products.length > 0;
      if (section.layout === "BRANDS") return section.brands.length > 0;
      return true;
    }),
  );
};

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

const adminSectionInclude = {
  category: { select: { id: true, name: true } },
  sourceCategory: { select: { id: true, name: true } },
  sourceBrand: { select: { id: true, name: true } },
};

const listAdminContentSections = async (request) => {
  const guard = await requireRole(request, CONTENT_ROLES);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const sections = await prisma.contentSection.findMany({
    include: adminSectionInclude,
    orderBy: [{ page: "asc" }, { categoryId: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
  return jsonResponse(sections);
};

const createAdminContentSection = async (request) => {
  const guard = await requireRole(request, CONTENT_ROLES);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const parsed = sectionDataFrom(await request.json().catch(() => ({})));
  if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
  const candidate = normalizeForLayout({ mediaType: "IMAGE", active: true, productLimit: 12, ...parsed.data });
  const error = await validateSection(candidate);
  if (error) return jsonResponse({ error }, 400);

  // New sections go to the end of their page.
  const last = await prisma.contentSection.findFirst({
    where: { page: candidate.page, categoryId: candidate.categoryId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const section = await prisma.contentSection.create({
    data: { ...pickPersisted(candidate), position: (last?.position ?? -1) + 1 },
    include: adminSectionInclude,
  });
  await recordAdminAction({
    actorId: guard.user.id,
    action: "content_section.create",
    entityType: "ContentSection",
    entityId: section.id,
    newState: pickPersisted(section),
  });
  return jsonResponse(section, 201);
};

const updateAdminContentSection = async (request, id) => {
  const guard = await requireRole(request, CONTENT_ROLES);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const existing = await prisma.contentSection.findUnique({ where: { id } });
  if (!existing) return jsonResponse({ error: "Section not found" }, 404);

  const parsed = sectionDataFrom(await request.json().catch(() => ({})));
  if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
  const candidate = normalizeForLayout({ ...existing, ...parsed.data });
  const error = await validateSection(candidate);
  if (error) return jsonResponse({ error }, 400);

  // Moving a section to a different page puts it at the end there.
  const movedPage =
    candidate.page !== existing.page || candidate.categoryId !== existing.categoryId;
  let position = existing.position;
  if (movedPage) {
    const last = await prisma.contentSection.findFirst({
      where: { page: candidate.page, categoryId: candidate.categoryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = (last?.position ?? -1) + 1;
  }

  const section = await prisma.contentSection.update({
    where: { id },
    data: { ...pickPersisted(candidate), position },
    include: adminSectionInclude,
  });
  await recordAdminAction({
    actorId: guard.user.id,
    action: "content_section.update",
    entityType: "ContentSection",
    entityId: id,
    previousState: pickPersisted(existing),
    newState: pickPersisted(section),
  });
  return jsonResponse(section);
};

const deleteAdminContentSection = async (request, id) => {
  const guard = await requireRole(request, CONTENT_ROLES);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);
  const existing = await prisma.contentSection.findUnique({ where: { id } });
  if (!existing) return jsonResponse({ error: "Section not found" }, 404);
  await prisma.contentSection.delete({ where: { id } });
  await recordAdminAction({
    actorId: guard.user.id,
    action: "content_section.delete",
    entityType: "ContentSection",
    entityId: id,
    previousState: pickPersisted(existing),
  });
  return jsonResponse({ deleted: true, id });
};

// Body: { ids: [...] } — the full, new order of one page's sections.
const reorderAdminContentSections = async (request) => {
  const guard = await requireRole(request, CONTENT_ROLES);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];
  if (ids.length === 0) return jsonResponse({ error: "ids is required" }, 400);

  const sections = await prisma.contentSection.findMany({
    where: { id: { in: ids } },
    select: { id: true, page: true, categoryId: true },
  });
  if (sections.length !== ids.length) {
    return jsonResponse({ error: "Some sections no longer exist — refresh and try again" }, 409);
  }
  const pageKeys = new Set(sections.map((section) => `${section.page}:${section.categoryId ?? ""}`));
  if (pageKeys.size !== 1) {
    return jsonResponse({ error: "Sections can only be reordered within one page" }, 400);
  }

  await prisma.$transaction(
    ids.map((id, position) =>
      prisma.contentSection.update({ where: { id }, data: { position } }),
    ),
  );
  await recordAdminAction({
    actorId: guard.user.id,
    action: "content_section.reorder",
    entityType: "ContentSection",
    entityId: [...pageKeys][0],
    newState: { ids },
  });
  return jsonResponse({ reordered: true });
};

export const handleAdminContentSectionRequest = async (request, segments) => {
  const id = segments[3] ? decodeURIComponent(segments[3]) : null;
  if (request.method === "GET" && !id) return listAdminContentSections(request);
  if (request.method === "POST" && id === "reorder") return reorderAdminContentSections(request);
  if (request.method === "POST" && !id) return createAdminContentSection(request);
  if (request.method === "PUT" && id) return updateAdminContentSection(request, id);
  if (request.method === "DELETE" && id) return deleteAdminContentSection(request, id);
  return jsonResponse({ error: "Method not allowed" }, 405);
};

// Exported for tests.
export { validateSection, sectionDataFrom, normalizeForLayout };
