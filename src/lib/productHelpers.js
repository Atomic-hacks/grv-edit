export const formatPrice = (value) => `$${value.toFixed(2)}`;

export const getProductImages = (product, variantId) => {
  const selected =
    product?.variants?.find((item) => item.id === variantId) ||
    product?.variants?.[0];
  return [product?.imageUrl, ...(selected?.images || [])].filter(Boolean);
};
