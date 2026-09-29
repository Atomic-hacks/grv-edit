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
  const variantImages = (selected?.images || []).filter(Boolean);
  const modelImages = (product?.modelImages || []).filter(Boolean);
  // A variant with photos of its own should visibly change the moment its
  // colour is picked, so its photos lead; the shared product photo only
  // leads when this particular variant has none of its own, and otherwise
  // trails along as an extra angle instead of hiding the switch at index 0.
  const productImages =
    variantImages.length > 0
      ? [...variantImages, product?.imageUrl]
      : [product?.imageUrl];
  const ordered = productImages.filter(Boolean);
  if (modelImages.length === 0) return ordered;
  // Every caller already treats images[1] as "the hover shot" — putting the
  // model photo there means the hover-swap becomes product photo -> model
  // photo automatically, with no change needed at any call site. Model
  // photos are product-wide (not per colour), so they show regardless of
  // which variant is selected.
  return [
    ordered[0],
    modelImages[0],
    ...ordered.slice(1),
    ...modelImages.slice(1),
  ].filter(Boolean);
};

// The single most useful category for "more like this" queries: a
// subcategory (it has a parent) is more specific than a bare major
// category, so it's preferred when a product has both.
export const getLeafCategory = (product) => {
  const categories = product?.categories || [];
  return (
    categories.find((category) => category.parentId) || categories[0] || null
  );
};
