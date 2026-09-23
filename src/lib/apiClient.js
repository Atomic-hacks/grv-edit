const jsonOrThrow = async (response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || `Request failed (${response.status})`);
    // Carry the machine-readable parts through. A caller that needs to react
    // to a specific failure (an unverified email at checkout, say) should not
    // have to pattern-match on English prose.
    error.status = response.status;
    if (body.code) error.code = body.code;
    throw error;
  }
  return response.json();
};

export const createAuthenticatedRequest =
  (session) =>
  async (url, options = {}) => {
    const isMultipart =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(isMultipart ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${session?.access_token || ""}`,
        ...options.headers,
      },
    });
    return jsonOrThrow(response);
  };

// Filter params accept a single value or an array; arrays are sent as
// repeated params, which the API ORs together within a filter and ANDs
// across filters.
const appendValues = (searchParams, key, value) => {
  if (value === undefined || value === null || value === "") return;
  for (const entry of Array.isArray(value) ? value : [value]) {
    if (entry !== undefined && entry !== null && entry !== "") {
      searchParams.append(key, String(entry));
    }
  }
};

export const buildProductParams = ({
  gender,
  categoryId,
  subcategory,
  styleTag,
  brandId,
  tag,
  size,
  color,
  inStock,
  minPrice,
  maxPrice,
  sort,
  query,
  page,
  pageSize,
  archived,
} = {}) => {
  const searchParams = new URLSearchParams();
  appendValues(searchParams, "gender", gender);
  appendValues(searchParams, "category", categoryId);
  appendValues(searchParams, "subcategory", subcategory);
  appendValues(searchParams, "style", styleTag);
  appendValues(searchParams, "brand", brandId);
  appendValues(searchParams, "tag", tag);
  appendValues(searchParams, "size", size);
  appendValues(searchParams, "color", color);
  if (inStock) searchParams.set("inStock", "true");
  if (minPrice !== undefined && minPrice !== null && minPrice !== "")
    searchParams.set("minPrice", String(minPrice));
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== "")
    searchParams.set("maxPrice", String(maxPrice));
  if (sort) searchParams.set("sort", sort);
  if (query) searchParams.set("q", query);
  if (page) searchParams.set("page", String(page));
  if (pageSize) searchParams.set("pageSize", String(pageSize));
  if (archived !== undefined) searchParams.set("archived", String(archived));
  return searchParams;
};

// Returns the full envelope ({ items, total, page, pageSize }) for listing
// pages that need result counts or pagination.
export const fetchProductPage = async (options = {}) =>
  jsonOrThrow(
    await fetch(`/api/products?${buildProductParams(options).toString()}`),
  );

// Mirrors the old getProducts({...}) filter shape from data/products.js.
export const fetchProducts = async (options = {}) => {
  const { items } = await fetchProductPage(options);
  return items;
};

// Available filter values derived from the live catalogue, narrowed by
// whatever filters are already applied.
export const fetchProductFilters = async (options = {}) =>
  jsonOrThrow(
    await fetch(
      `/api/products/filters?${buildProductParams(options).toString()}`,
    ),
  );

export const searchProducts = (query) => fetchProducts({ query, pageSize: 6 });

export const fetchNewArrivals = async () => {
  const { items } = await jsonOrThrow(
    await fetch("/api/products/new-arrivals"),
  );
  return items;
};

export const fetchSection = async (slug) => {
  const response = await fetch(`/api/sections/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  return jsonOrThrow(response);
};

export const fetchHomepageSections = async () =>
  jsonOrThrow(await fetch("/api/sections/homepage"));

export const fetchProductById = async (id) => {
  const response = await fetch(`/api/products/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  return jsonOrThrow(response);
};

export const fetchCategories = async () =>
  jsonOrThrow(await fetch("/api/categories"));

export const fetchBrands = async () => jsonOrThrow(await fetch("/api/brands"));

export const fetchSiteImages = async () =>
  jsonOrThrow(await fetch("/api/site-images"));

export const fetchBrandBySlug = async (slug) => {
  const response = await fetch(`/api/brands/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  return jsonOrThrow(response);
};
