import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProductImages, getLeafCategory } from "./lib/productHelpers";
import {
  fetchBrandBySlug,
  fetchBrands,
  fetchProductById,
  fetchProducts,
} from "./lib/apiClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCart } from "./context/CartContext";
import { useAuth } from "./context/AuthContext";
import { useRequireAuthAction } from "./component/auth/useRequireAuthAction";
import { createAuthenticatedRequest } from "./lib/apiClient";
import { AnimatePresence, motion as Motion } from "framer-motion";
import ErrorState from "./component/ui/ErrorState";
import ProductImageSlider from "./component/ui/ProductImageSlider";
import ProductRail from "./component/section/ProductRail";
import BrandSpotlight from "./component/section/BrandSpotlight";
import BrandDiscoveryGrid from "./component/section/BrandDiscoveryGrid";
import RecentlyViewedRail from "./component/section/RecentlyViewedRail";
import StoreSupport from "./component/section/StoreSupport";
import { useRecentlyViewed } from "./context/RecentlyViewedContext";
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
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProductById(id),
    enabled: Boolean(id),
  });
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { addToCart } = useCart();
  const { recordView } = useRecentlyViewed();
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
    if (waitlistQuery.error) setWaitlistError("Couldn't check your waitlist status. Refresh the page to try again.");
  }, [waitlistQuery.error]);

  const leafCategory = getLeafCategory(product);
  const { data: moreProductsData } = useQuery({
    queryKey: ["products", { category: leafCategory?.slug }],
    queryFn: () => fetchProducts({ category: leafCategory.slug }),
    enabled: Boolean(leafCategory),
  });

  const { data: brandProductsData, isPending: brandProductsPending } = useQuery({
    queryKey: ["products", { brandId: product?.brandId }],
    queryFn: () => fetchProducts({ brandId: product.brandId }),
    enabled: Boolean(product?.brandId),
  });

  // The PDP's continuation varies by what there actually is to show: a
  // carousel needs enough siblings to be worth scrolling, a brand with too
  // few needs a single invitation instead, and a product with no brand at
  // all gets pointed at other labels rather than showing nothing.
  const hasBrandCarousel =
    Boolean(product?.brandId) &&
    !brandProductsPending &&
    (brandProductsData || []).filter((item) => item.id !== product.id).length >= 4;
  const { data: brandDetail } = useQuery({
    queryKey: ["brand", product?.brandId],
    queryFn: () => fetchBrandBySlug(product.brandId),
    enabled: Boolean(product?.brandId) && !hasBrandCarousel,
  });
  const { data: otherBrandsData } = useQuery({
    queryKey: ["brands"],
    queryFn: () => fetchBrands(),
    enabled: !product?.brandId,
    staleTime: 5 * 60 * 1000,
  });
  const otherBrands = (otherBrandsData || []).slice(0, 3);

  // Viewing a product is what builds the session's history. Recorded by id so
  // re-selecting a variant does not push a duplicate entry.
  useEffect(() => {
    if (product?.id) recordView(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (loading) return <ProductDetailSkeleton />;
  if (error)
    return (
      <main className="page-shell min-h-screen">
        <ErrorState
          title="Couldn't load this product"
          message="Something went wrong on our end. Give it another try."
          onRetry={refetch}
          retryPending={isRefetching}
          secondaryTo="/shop"
          secondaryLabel="Back to shop"
        />
      </main>
    );
  if (!product)
    return (
      <main className="page-shell min-h-screen">
        <ErrorState
          tone="not-found"
          title="Product not found"
          message="This piece may have sold out and been retired, or the link is out of date."
          secondaryTo="/shop"
          secondaryLabel="Back to shop"
        />
      </main>
    );

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
  const categoryProducts = (moreProductsData || []).filter(
    (item) => item.id !== product.id,
  );
  // Prefer the same subcategory, then fall back to the wider category, so a
  // pair of boots suggests boots before it suggests everything in Footwear.
  const similarProducts = [
    ...categoryProducts.filter(
      (item) => item.subcategory && item.subcategory === product.subcategory,
    ),
    ...categoryProducts.filter(
      (item) => !item.subcategory || item.subcategory !== product.subcategory,
    ),
  ].slice(0, 12);
  const brandProducts = (brandProductsData || [])
    .filter((item) => item.id !== product.id)
    .slice(0, 12);
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
      setWaitlistError(requestError.message || "Couldn't join the waitlist. Please try again.");
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
    ...(product.categories || []).map((category) => category.name),
    brandName,
    product.name,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-white pb-20">
      {breadcrumbParts.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="page-shell flex flex-wrap items-center gap-y-1 py-4 text-[11px] text-[var(--ink-500)]"
        >
          {breadcrumbParts.map((part, i) => (
            <span key={i} className="flex items-center">
              {i > 0 && (
                <span aria-hidden="true" className="mx-2 text-[var(--ink-300)]">
                  /
                </span>
              )}
              <span
                className={
                  i === breadcrumbParts.length - 1
                    ? "text-[var(--ink-900)]"
                    : "capitalize"
                }
              >
                {part}
              </span>
            </span>
          ))}
        </nav>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px] xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="h-[50vh] sm:h-[75vh] lg:h-[calc(100vh-var(--nav-h))]">
          <ProductImageSlider images={images} alt={product.name} />
        </div>
        {/* Detail column sticks alongside a tall gallery, so size, price and
            the add button stay in reach while the shopper scrolls images. */}
        <section className="flex flex-col px-[var(--gutter)] py-8 lg:sticky lg:top-[var(--nav-h)] lg:h-[calc(100vh-var(--nav-h))] lg:overflow-y-auto lg:py-10">
          {isNewArrival && <p className="eyebrow">New Season</p>}
          <div className="mt-1 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold leading-tight tracking-[-0.01em]">
                {brandName || product.name}
              </h1>
              {brandName && (
                <p className="mt-1.5 text-sm text-[var(--ink-500)]">
                  {product.name}
                </p>
              )}
            </div>
            <WishlistButton
              product={product}
              className="shrink-0 border border-[var(--line)] transition-colors hover:border-[var(--ink-900)]"
            />
          </div>
          <DiscountPrice
            basePrice={product.basePrice}
            discountPercent={product.discountPercent}
            align="start"
            className="mt-3 text-2xl font-semibold"
            discountTone="red"
          />
          {!brandName && (
            <p className="body-text mt-4 text-sm">{product.description}</p>
          )}
          <div className="mt-7">
            {variants.length === 0 ? (
              <p className="text-sm text-[var(--ink-500)]">
                No variants available yet.
              </p>
            ) : (
              <div className="grid gap-6">
                <fieldset className="text-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <legend className="eyebrow">
                      Colour{selectedColor ? `: ${selectedColor}` : ""}
                    </legend>
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
                          className={`h-9 w-9 border transition-all duration-200 ${
                            selected
                              ? "border-[var(--ink-900)] ring-1 ring-[var(--ink-900)] ring-offset-2"
                              : "border-[var(--line)] hover:border-[var(--ink-900)]"
                          }`}
                          style={{ backgroundColor: getColorSwatch(color) }}
                        />
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="text-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <legend className="eyebrow">Size</legend>
                    <Link
                      to="/size-guide"
                      className="text-[11px] font-semibold text-[var(--ink-700)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
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
                          className={`min-h-11 min-w-12 border px-3 text-[13px] transition-colors duration-200 ${
                            unavailable
                              ? "cursor-not-allowed border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-300)] line-through"
                              : selected
                                ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
                                : "border-[var(--line)] bg-white text-[var(--ink-700)] hover:border-[var(--ink-900)]"
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
                className="mt-8 inline-flex w-full items-center justify-center bg-[var(--ink-900)] py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-200 hover:bg-(--color-accent-orange) disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--ink-500)]"
              >
                {addingToCart ? <Spinner label="Adding" /> : "Add to Goody Bag"}
              </button>
              {!selectedVariantInStock && (
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-700)]">
                  Sorry, this product is out of stock. Would you like{" "}
                  <button
                    type="button"
                    disabled={
                      selectedVariantWaitlisted ||
                      !waitlistLoaded ||
                      waitlistPending
                    }
                    onClick={() => requireAuthAction(joinWaitlist)}
                    className="font-semibold text-[var(--ink-900)] underline underline-offset-4 transition-colors hover:text-(--color-accent-orange) disabled:cursor-not-allowed disabled:text-[var(--ink-300)]"
                  >
                    Join the waitlist
                  </button>{" "}
                  ?
                </p>
              )}
              <p className="meta-text mt-4">
                SKU {selectedVariant.sku} · Size {selectedVariant.size}
              </p>
              {waitlistError && (
                <p className="mt-2 text-xs text-red-700">{waitlistError}</p>
              )}
            </>
          )}
        </section>
      </div>

      <section className="page-shell">
        <div className="max-w-3xl border-t border-[var(--line)] py-1">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-4 py-5 text-left"
            aria-expanded={detailsOpen}
            aria-controls="product-details-panel"
          >
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">
              The Details
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
              className={`shrink-0 transition-transform duration-300 ${
                detailsOpen ? "rotate-180" : ""
              }`}
            >
              <path d="M2 4.5L6 8.5l4-4" />
            </svg>
          </button>
          <AnimatePresence initial={false}>
            {detailsOpen && (
              <Motion.div
                id="product-details-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pb-8">
                  {hasStructuredDetails ? (
                    <div className="grid gap-8 md:grid-cols-2">
                      {product.highlights?.length > 0 && (
                        <div>
                          <h3 className="eyebrow">Highlights</h3>
                          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--ink-700)]">
                            {product.highlights.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {product.composition && (
                        <div>
                          <h3 className="eyebrow">Composition</h3>
                          <div className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-[var(--ink-700)]">
                            {product.composition}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="body-text text-sm">{product.description}</p>
                  )}
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Continuation. Exactly one brand-facing section runs at a time —
          a carousel when there are enough siblings to scroll, a single
          banner invitation when there are a few, or a grid of other labels
          when the product carries no brand at all. Never more than one, and
          never a section propped up with too little to show. */}
      <div className="page-shell">
        {hasBrandCarousel && (
          <ProductRail
            eyebrow="More from the label"
            title={brandName}
            products={brandProducts}
            viewAllTo={`/brands/${product.brandId}`}
            viewAllLabel="All pieces"
            onQuickAdd={(item, itemImages) =>
              addToCart(
                {
                  ...item,
                  price: item.basePrice,
                  image: itemImages[0],
                  hoverImage: itemImages[1] || itemImages[0],
                },
                1,
              )
            }
          />
        )}
        {!hasBrandCarousel && brandDetail && (
          <BrandSpotlight brand={brandDetail} />
        )}
        {!product.brandId && otherBrands.length > 0 && (
          <BrandDiscoveryGrid brands={otherBrands} />
        )}

        <ProductRail
          eyebrow="Similar pieces"
          title="You may also like"
          className="border-t border-[var(--line)]"
          products={similarProducts}
          viewAllTo={leafCategory ? `/${leafCategory.slug}` : undefined}
          viewAllLabel="View category"
          onQuickAdd={(item, itemImages) =>
            addToCart(
              {
                ...item,
                price: item.basePrice,
                image: itemImages[0],
                hoverImage: itemImages[1] || itemImages[0],
              },
              1,
            )
          }
        />

        <RecentlyViewedRail
          excludeId={product.id}
          className="border-t border-[var(--line)]"
        />
      </div>

      <StoreSupport help={false} className="mt-4" />
    </main>
  );
};

export default ProductDetail;
