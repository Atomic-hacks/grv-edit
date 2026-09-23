export const filterGroups = [
  { key: "gender", label: "Gender" },
  { key: "categoryId", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
  { key: "styleTags", label: "Style" },
  { key: "brandId", label: "Brand" },
];

export const emptyFilters = () =>
  filterGroups.reduce((filters, group) => {
    filters[group.key] = [];
    return filters;
  }, {});

// categories is optional — only needed by callers that want the styleTags
// branch narrowed to one category's declared vocabulary (pass the fetched
// /api/categories list; no more static import).
export const getFilterValues = (items, key, categoryId, categories = []) => {
  if (key === "styleTags" && categoryId) {
    return (
      categories.find((category) => category.id === categoryId)?.styleTags || []
    );
  }
  return [
    ...new Set(
      items.flatMap((item) => {
        const value = item[key];
        return Array.isArray(value) ? value : value ? [value] : [];
      }),
    ),
  ].sort();
};

export const filterProducts = (items, filters) =>
  items.filter((product) =>
    Object.entries(filters).every(([key, values]) => {
      if (!values.length) return true;
      const productValues = Array.isArray(product[key])
        ? product[key]
        : [product[key]];
      return values.some((value) =>
        productValues.some(
          (item) => String(item).toLowerCase() === String(value).toLowerCase(),
        ),
      );
    }),
  );

// Client-side equivalent of the API's sort options, for listing pages that
// already hold their full result set in memory (brand pages, new arrivals).
// Keys match PRODUCT_SORT_ORDERS in src/api/routes.js so the sort control
// behaves identically wherever it appears.
const effectivePrice = (product) =>
  product.basePrice * (1 - (product.discountPercent ?? 0) / 100);

export const sortProducts = (items, sort) => {
  if (!sort) return items;
  const sorted = [...items];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    case "price-desc":
      return sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "newest":
      return sorted.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
    case "oldest":
      return sorted.sort(
        (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      );
    default:
      return sorted;
  }
};

const formatFilterLabel = (value) =>
  String(value)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

// Turns an applied-filter object into the chip list the toolbar renders, so
// every listing page describes its active filters in the same words and in
// the same order. `onRemove(key, value)` gets the group key and the single
// value to drop; the page decides how that is persisted (state or URL).
export const buildFilterChips = (filters, onRemove, labelFor) =>
  filterGroups.flatMap((group) =>
    (filters?.[group.key] || []).map((value) => ({
      id: `${group.key}:${value}`,
      label: labelFor?.(group.key, value) ?? formatFilterLabel(value),
      onRemove: () => onRemove(group.key, value),
    })),
  );

// Removes one value from one group without disturbing the rest.
export const removeFilterValue = (filters, key, value) => ({
  ...filters,
  [key]: (filters[key] || []).filter((item) => item !== value),
});
