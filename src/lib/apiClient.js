const jsonOrThrow = async (response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
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

// Mirrors the old getProducts({...}) filter shape from data/products.js.
export const fetchProducts = async ({
  gender,
  categoryId,
  subcategory,
  styleTag,
  brandId,
  query,
  page,
  pageSize,
  archived,
} = {}) => {
  const searchParams = new URLSearchParams();
  if (gender) searchParams.set("gender", gender);
  if (categoryId) searchParams.set("category", categoryId);
  if (subcategory) searchParams.set("subcategory", subcategory);
  if (styleTag) searchParams.set("style", styleTag);
  if (brandId) searchParams.set("brand", brandId);
  if (query) searchParams.set("q", query);
  if (page) searchParams.set("page", String(page));
  if (pageSize) searchParams.set("pageSize", String(pageSize));
  if (archived !== undefined) searchParams.set("archived", String(archived));

  const { items } = await jsonOrThrow(
    await fetch(`/api/products?${searchParams.toString()}`),
  );
  return items;
};

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
