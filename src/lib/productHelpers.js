const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatPrice = (value) => nairaFormatter.format(Number(value));

export const getDiscountedPrice = (basePrice, discountPercent) =>
  Number(basePrice) * (1 - Number(discountPercent) / 100);

export const getProductImages = (product, variantId) => {
  const selected =
    product?.variants?.find((item) => item.id === variantId) ||
    product?.variants?.[0];
  return [product?.imageUrl, ...(selected?.images || [])].filter(Boolean);
};

// The single most useful category for "more like this" queries: a
// subcategory (it has a parent) is more specific than a bare major
// category, so it's preferred when a product has both.
export const getLeafCategory = (product) => {
  const categories = product?.categories || [];
  return categories.find((category) => category.parentId) || categories[0] || null;
};
