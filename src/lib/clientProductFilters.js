// Client-side filter/facet helpers for the two pages that already hold
// their full, small product set in memory (new arrivals, one brand's
// catalogue) rather than paging through the server. Category browsing uses
// server-side filtering instead — see CategoryPage.
export const emptyClientFilters = () => ({
  brand: [],
  size: [],
  color: [],
  style: [],
  minPrice: "",
  maxPrice: "",
});

export const applyClientFilters = (products, filters) =>
  products.filter((product) => {
    if (filters.brand.length && !filters.brand.includes(product.brandId)) return false;
    if (filters.style.length) {
      const slugs = (product.tags || []).map((tag) => tag.slug);
      if (!filters.style.some((value) => slugs.includes(value))) return false;
    }
    if (filters.size.length) {
      const sizes = (product.variants || []).map((variant) => variant.size);
      if (!filters.size.some((value) => sizes.includes(value))) return false;
    }
    if (filters.color.length) {
      const colors = (product.variants || []).map((variant) => variant.color?.toLowerCase());
      if (!filters.color.some((value) => colors.includes(value.toLowerCase()))) return false;
    }
    if (filters.minPrice && product.basePrice < Number(filters.minPrice)) return false;
    if (filters.maxPrice && product.basePrice > Number(filters.maxPrice)) return false;
    return true;
  });

export const buildClientFacets = (products) => {
  const tally = (values) => {
    const counts = new Map();
    for (const { value, label } of values) {
      if (!value) continue;
      const existing = counts.get(value);
      if (existing) existing.count += 1;
      else counts.set(value, { value, label: label ?? value, count: 1 });
    }
    return [...counts.values()];
  };
  return {
    brands: tally(products.map((p) => ({ value: p.brandId, label: p.brandName }))),
    styles: tally(
      products.flatMap((p) => (p.tags || []).map((tag) => ({ value: tag.slug, label: tag.name }))),
    ),
    sizes: tally(products.flatMap((p) => (p.variants || []).map((v) => ({ value: v.size })))),
    colors: tally(products.flatMap((p) => (p.variants || []).map((v) => ({ value: v.color })))),
  };
};

export const countActiveClientFilters = (filters) =>
  filters.brand.length +
  filters.size.length +
  filters.color.length +
  filters.style.length +
  (filters.minPrice ? 1 : 0) +
  (filters.maxPrice ? 1 : 0);
