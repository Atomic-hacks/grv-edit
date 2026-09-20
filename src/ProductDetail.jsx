import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProductImages } from "./lib/productHelpers";
import { fetchProductById, fetchProducts } from "./lib/apiClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCart } from "./context/CartContext";
import { useAuth } from "./context/AuthContext";
import { useRequireAuthAction } from "./component/auth/useRequireAuthAction";
import { createAuthenticatedRequest } from "./lib/apiClient";
import ProductImageSlider from "./component/ui/ProductImageSlider";
import LoadingImage from "./component/ui/LoadingImage";
import { ProductDetailSkeleton } from "./component/ui/LoadingSkeletons";
import WishlistButton from "./component/ui/WishlistButton";
import Spinner from "./component/ui/Spinner";
import DiscountPrice from "./component/ui/DiscountPrice";

const COLOR_SWATCHES = {
  black: "#111111",
  white: "#ffffff",
  grey: "#9ca3af",
  gray: "#9ca3af",
  blue: "#2563eb",
  navy: "#1e3a8a",
  red: "#dc2626",
  green: "#16a34a",
  brown: "#92400e",
  beige: "#d6c3a5",
  cream: "#f5f5dc",
  yellow: "#eab308",
  orange: "#ea580c",
  pink: "#ec4899",
  purple: "#9333ea",
};

const getColorSwatch = (color) => {
  const normalizedColor = color.trim().toLowerCase();
  const colorValue = COLOR_SWATCHES[normalizedColor];
  const supportsCssColor =
    normalizedColor.startsWith("#") ||
    normalizedColor.startsWith("rgb") ||
    normalizedColor.startsWith("hsl");

  return colorValue || (supportsCssColor ? normalizedColor : "#d1d5db");
};

const ProductDetail = () => {
  const { id } = useParams();
  const {
    data: product,
    isPending: loading,
    error,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProductById(id),
    enabled: Boolean(id),
  });
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { addToCart } = useCart();
  const { user, session } = useAuth();
  const requireAuthAction = useRequireAuthAction();
  const [waitlistPending, setWaitlistPending] = useState(false);
  const [waitlistError, setWaitlistError] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const queryClient = useQueryClient();
  const waitlistQuery = useQuery({
    queryKey: ["waitlist", user?.id],
    queryFn: () => createAuthenticatedRequest(session)("/api/waitlist"),
    enabled: Boolean(product && user && session),
  });
  const waitlistedVariantIds = new Set(
    (waitlistQuery.data || [])
      .filter(
        (entry) => entry.status === "WAITING" || entry.status === "NOTIFIED",
      )
      .map((entry) => entry.variantId),
  );
  const waitlistLoaded =
    !user || waitlistQuery.isSuccess || Boolean(waitlistQuery.error);

  // product now arrives asynchronously, so the default variant can't be
  // picked at useState-init time — it has to react once product loads.
  useEffect(() => {
    const variants = product?.variants || [];
    const defaultVariant =
      variants.length === 1
        ? variants[0]
        : variants.find((variant) => variant.stock > 0);
    setSelectedColor(defaultVariant?.color ?? "");
    setSelectedSize(defaultVariant?.size ?? "");
  }, [product]);

  useEffect(() => {
    if (waitlistQuery.error) setWaitlistError("Could not load your waitlist.");
  }, [waitlistQuery.error]);

  const { data: moreProductsData } = useQuery({
    queryKey: ["products", { categoryId: product?.categoryId }],
    queryFn: () => fetchProducts({ categoryId: product.categoryId }),
    enabled: Boolean(product?.categoryId),
  });

  if (loading) return <ProductDetailSkeleton />;
  if (error)
    return (
      <main className="min-h-screen px-8 py-20">
        Couldn't load this product.
      </main>
    );
  if (!product)
    return <main className="min-h-screen px-8 py-20">Product not found.</main>;

  const variants = product.variants || [];
  const colors = Array.from(
    new Set(variants.map((variant) => variant.color).filter(Boolean)),
  );
  const sizes = Array.from(
    new Set(variants.map((variant) => variant.size).filter(Boolean)),
  );
  const sizesForSelectedColor = selectedColor
    ? new Set(
        variants
          .filter((variant) => variant.color === selectedColor)
          .map((variant) => variant.size),
      )
    : new Set(sizes);
  const selectedVariant =
    variants.find(
      (variant) =>
        variant.color === selectedColor && variant.size === selectedSize,
    ) || null;
  const isVariantInStock = (variant) => Boolean(variant?.stock > 0);
  const selectedVariantInStock = isVariantInStock(selectedVariant);
  const selectedVariantWaitlisted = Boolean(
    selectedVariant && waitlistedVariantIds.has(selectedVariant.id),
  );
  const images = getProductImages(product, selectedVariant?.id);
  const moreProducts = (moreProductsData || [])
    .filter((item) => item.id !== product.id)
    .slice(0, 4);
  const cartProduct = {
    ...product,
    variantId: selectedVariant?.id,
    price: product.basePrice,
    image: images[0],
    hoverImage: images[1] || images[0],
  };

  const handleAddToCart = async () => {
    if (addingToCart) return;
    setAddingToCart(true);
    try {
      addToCart(cartProduct, 1);
    } finally {
      window.setTimeout(() => setAddingToCart(false), 300);
    }
  };

  const joinWaitlist = async () => {
    if (!selectedVariant || selectedVariantWaitlisted) return;
    setWaitlistError(null);
    setWaitlistPending(true);
    try {
      await createAuthenticatedRequest(session)("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ variantId: selectedVariant.id }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["waitlist", user.id],
      });
    } catch (requestError) {
      setWaitlistError(requestError.message || "Could not join the waitlist.");
    } finally {
      setWaitlistPending(false);
    }
  };

  // brand relation may not be present on every product depending on data;
  // fall back to the product name as the heading if there's no brand.
  const brandName = product.brand?.name;
  // no "isNewArrival" field exists on Product yet — this reads a flag if one
  // gets added later (e.g. from the New Arrivals work), and safely no-ops
  // (hides the label) until then rather than showing it on every product.
  const isNewArrival = product.isNewArrival ?? false;
  const hasStructuredDetails =
    (product.highlights && product.highlights.length > 0) ||
    Boolean(product.composition);
  const breadcrumbParts = [
    product.categoryId ? `${product.categoryId} Home` : null,
    brandName,
    product.subcategory,
    product.name,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-white pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_600px]">
        <div className="h-[70vh] lg:h-[85vh]">
          <ProductImageSlider images={images} alt={product.name} />
        </div>
        <section className="flex flex-col px-8 py-8">
          {isNewArrival && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
              New Season
            </p>
          )}
          <div className="mt-1 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">
                {brandName || product.name}
              </h1>
              {brandName && (
                <p className="mt-1 text-sm text-gray-600">{product.name}</p>
              )}
            </div>
            <WishlistButton
              product={product}
              className="shrink-0 border border-gray-200"
            />
          </div>
          <DiscountPrice
            basePrice={product.basePrice}
            discountPercent={product.discountPercent}
            className="mt-2 items-start text-xl"
            discountTone="red"
          />
          {!brandName && (
            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              {product.description}
            </p>
          )}
          <div className="mt-4">
            {variants.length === 0 ? (
              <p className="text-sm text-gray-500">
                No variants available yet.
              </p>
            ) : (
              <div className="grid  gap-4 md:gap-6 ">
                <fieldset className="text-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <legend className="block font-medium">Color</legend>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => {
                      const selected = selectedColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Select ${color}`}
                          title={color}
                          aria-pressed={selected}
                          onClick={() => {
                            const matchingSizes = variants
                              .filter((variant) => variant.color === color)
                              .map((variant) => variant.size);
                            setSelectedColor(color);
                            setSelectedSize(
                              matchingSizes.includes(selectedSize)
                                ? selectedSize
                                : matchingSizes[0] || "",
                            );
                          }}
                          className={`h-10 w-10 border transition-all ${
                            selected
                              ? "border-black ring-2 ring-black ring-offset-2"
                              : "border-gray-300 hover:border-black"
                          }`}
                          style={{ backgroundColor: getColorSwatch(color) }}
                        />
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="text-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <legend className="block font-medium">Size</legend>
                    <Link
                      to="/size-guide"
                      className="text-xs font-semibold underline underline-offset-2"
                    >
                      Size guide
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => {
                      const unavailable =
                        Boolean(selectedColor) &&
                        !sizesForSelectedColor.has(size);
                      const selected = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          aria-label={`Select size ${size}`}
                          aria-pressed={selected}
                          disabled={unavailable}
                          onClick={() => setSelectedSize(size)}
                          className={`min-h-10 min-w-12 border px-3 py-2 text-sm transition-colors ${
                            unavailable
                              ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                              : selected
                                ? "border-black bg-black text-white"
                                : "border-gray-300 bg-white text-gray-700 hover:border-black"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}
          </div>
          {selectedVariant && (
            <>
              <button
                type="button"
                disabled={!selectedVariantInStock || addingToCart}
                onClick={handleAddToCart}
                aria-busy={addingToCart}
                className="mt-8 inline-flex w-full items-center justify-center bg-black py-4 text-sm font-semibold text-white hover:bg-(--color-accent-orange) disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {addingToCart ? <Spinner label="Adding" /> : "ADD TO GOODY BAG"}
              </button>
              {!selectedVariantInStock && (
                <p className="mt-3 text-sm text-gray-600">
                  Sorry, this product is out of stock. Would you like{" "}
                  <button
                    type="button"
                    disabled={
                      selectedVariantWaitlisted ||
                      !waitlistLoaded ||
                      waitlistPending
                    }
                    onClick={() => requireAuthAction(joinWaitlist)}
                    className="font-medium text-black underline underline-offset-2 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    Join the waitlist
                  </button>{" "}
                  ?
                </p>
              )}
              <p className="mt-4 text-xs text-gray-500">
                SKU: {selectedVariant.sku} · Size: {selectedVariant.size}
              </p>
              {waitlistError && (
                <p className="mt-2 text-xs text-red-600">{waitlistError}</p>
              )}
            </>
          )}
        </section>
      </div>

      {breadcrumbParts.length > 0 && (
        <nav className="px-6 pt-6 text-xs text-gray-500 md:px-12">
          {breadcrumbParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-2">&gt;</span>}
              {part}
            </span>
          ))}
        </nav>
      )}

      <section className="  max-w-3xl  px-6 py-6 md:px-12 items-center">
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold uppercase tracking-widest"
          aria-expanded={detailsOpen}
        >
          The Details
          <span className="text-lg leading-none">
            {detailsOpen ? "−" : "+"}
          </span>
        </button>
        {detailsOpen && (
          <div className="mt-6">
            {hasStructuredDetails ? (
              <div className="grid gap-8 md:grid-cols-2">
                {product.highlights?.length > 0 && (
                  <div>
                    <h3 className="font-semibold">Highlights</h3>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
                      {product.highlights.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {product.composition && (
                  <div>
                    <h3 className="font-semibold">Composition</h3>
                    <div className="mt-3 space-y-1 text-sm text-gray-600 whitespace-pre-line">
                      {product.composition}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
                {product.description}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="px-1.5 py-16 max-w-360 mx-auto">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-3xl font-semibold">More from this category</h2>
          <Link
            to={`/men?category=${product.categoryId}`}
            className="text-sm font-semibold underline"
          >
            VIEW CATEGORY
          </Link>
        </div>
        <div className="product-grid">
          {moreProducts.map((item) => (
            <Link
              key={item.id}
              to={`/product/${item.id}`}
              className="group relative"
            >
              <LoadingImage
                src={getProductImages(item)[0]}
                alt={item.name}
                width={600}
                className="aspect-3/4 w-full object-cover"
                wrapperClassName="aspect-3/4 w-full"
              />
              <WishlistButton
                product={item}
                className="absolute right-3 top-3"
              />
              <div className="mt-3 flex justify-between text-sm font-semibold">
                <span>{item.name}</span>
                <DiscountPrice
                  basePrice={item.basePrice}
                  discountPercent={item.discountPercent}
                  className="items-end text-right"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};

export default ProductDetail;
