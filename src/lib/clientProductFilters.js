// Client-side versions of the storefront's three filters (Brand,
// Subcategory, Price) for the pages that already hold their full, small
// product set in memory — new arrivals and a single brand's catalogue.
// Category pages filter server-side instead (see CategoryPage).
export const emptyClientFilters = () => ({
  brand: [],
  subcategory: [],
  minPrice: "",
  maxPrice: "",
});

// The categories a product is filed under directly, minus top-level ones
// ("Men", "Footwear") — on these mixed pages the useful split is by the
// specific kind of thing (Sneakers, Shirts), not by department.
const specificCategories = (product) =>
  (product.categories || []).filter((category) => category.parentId);

export const applyClientFilters = (products, filters) =>
  products.filter((product) => {
    if (filters.brand.length && !filters.brand.includes(product.brandId)) return false;
    if (filters.subcategory.length) {
      const slugs = specificCategories(product).map((category) => category.slug);
      if (!filters.subcategory.some((slug) => slugs.includes(slug))) return false;
    }
    if (filters.minPrice && product.basePrice < Number(filters.minPrice)) return false;
    if (filters.maxPrice && product.basePrice > Number(filters.maxPrice)) return false;
    return true;
  });

// Same shape the server's /api/products/filters returns, so FilterDrawer
// doesn't care which kind of page it's on. Each facet is counted with its
// own filter left out (but the others applied), matching the server.
export const buildClientFacets = (products, filters = emptyClientFilters()) => {
  const tally = (entries) => {
    const counts = new Map();
    for (const { value, label } of entries) {
      if (!value) continue;
      const existing = counts.get(value);
      if (existing) existing.count += 1;
      else counts.set(value, { value, label: label ?? value, count: 1 });
    }
    return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label));
  };
  const withoutBrand = applyClientFilters(products, { ...filters, brand: [] });
  const withoutSubcategory = applyClientFilters(products, { ...filters, subcategory: [] });
  const prices = products.map((product) => product.basePrice).filter(Number.isFinite);
  return {
    brands: tally(withoutBrand.map((p) => ({ value: p.brandId, label: p.brandName }))),
    subcategories: tally(
      withoutSubcategory.flatMap((p) =>
        // Count each product once per subcategory even if listed twice.
        [...new Map(specificCategories(p).map((c) => [c.slug, c])).values()].map((c) => ({
          value: c.slug,
          label: c.name,
        })),
      ),
    ),
    price: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
  };
};

export const countActiveClientFilters = (filters) =>
  filters.brand.length +
  filters.subcategory.length +
  (filters.minPrice ? 1 : 0) +
  (filters.maxPrice ? 1 : 0);
