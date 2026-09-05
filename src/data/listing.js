import { categories, getProducts } from "./products";

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

export const getFilterValues = (items, key, categoryId) => {
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

export { getProducts };
