import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatPrice, getProductImages } from "./lib/productHelpers";
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
  const [selectedVariantId, setSelectedVariantId] = useState(null);
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
    setSelectedVariantId(defaultVariant?.id ?? null);
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
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) || variants[0];
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
    variantId: selectedVariantId,
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

  return (
    <main className="min-h-screen bg-white pb-20">
      <div className="px-6 py-6 text-xs text-gray-500 md:px-12">
        HOME / {product.categoryId.toUpperCase()} /{" "}
        {product.subcategory.toUpperCase()}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
        <div className="h-[70vh] lg:h-[85vh]">
          <ProductImageSlider images={images} alt={product.name} />
        </div>
        <section className="flex flex-col px-8 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
            {product.subcategory}
          </p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold">{product.name}</h1>
            <WishlistButton
              product={product}
              className="shrink-0 border border-gray-200"
            />
          </div>
          <p className="mt-2 text-lg">{formatPrice(product.basePrice)}</p>
          <p className="mt-8 text-sm leading-relaxed text-gray-600">
            {product.description}
          </p>
          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold">Choose a variant</p>
            {variants.length === 0 ? (
              <p className="text-sm text-gray-500">
                No variants available yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`border px-4 py-2 text-left text-sm ${selectedVariant?.id === variant.id ? "border-black bg-black text-white" : "border-gray-300"}`}
                  >
                    <span className="block">
                      {variant.color} / {variant.size}
                    </span>
                    {!isVariantInStock(variant) && (
                      <span className="mt-1 block text-xs">Out of stock</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedVariant && (
            <>
              {selectedVariantInStock ? (
                <button
                  type="button"
                  disabled={!selectedVariantId || addingToCart}
                  onClick={handleAddToCart}
                  aria-busy={addingToCart}
                  className="mt-8 inline-flex w-full items-center justify-center bg-black py-4 text-sm font-semibold text-white hover:bg-(--color-accent-orange) disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {addingToCart ? <Spinner label="Adding" /> : "ADD TO CART"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    selectedVariantWaitlisted ||
                    !waitlistLoaded ||
                    waitlistPending
                  }
                  onClick={() =>
                    requireAuthAction(async () => {
                      setWaitlistError(null);
                      setWaitlistPending(true);
                      try {
                        await createAuthenticatedRequest(session)(
                          "/api/waitlist",
                          {
                            method: "POST",
                            body: JSON.stringify({
                              variantId: selectedVariant.id,
                            }),
                          },
                        );
                        await queryClient.invalidateQueries({
                          queryKey: ["waitlist", user.id],
                        });
                      } catch (requestError) {
                        setWaitlistError(
                          requestError.message ||
                            "Could not join the waitlist.",
                        );
                      } finally {
                        setWaitlistPending(false);
                      }
                    })
                  }
                  className="mt-8 w-full border border-black py-4 text-sm font-semibold hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {selectedVariantWaitlisted
                    ? "You're on the waitlist"
                    : waitlistLoaded
                      ? "Join Waitlist"
                      : "Checking waitlist..."}
                </button>
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
      <section className="px-1.5 py-16">
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
                <span>{formatPrice(item.basePrice)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};

export default ProductDetail;
