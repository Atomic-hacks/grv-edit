import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RequireAuth from "../component/auth/RequireAuth";
import WishlistButton from "../component/ui/WishlistButton";
import Spinner from "../component/ui/Spinner";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import { useWishlist } from "../context/WishlistContext";
import { useCart } from "../context/CartContext";
import { getOptimizedImageUrl } from "../lib/imageHelpers";
import DiscountPrice from "../component/ui/DiscountPrice";

const WishlistCard = ({ item }) => {
  const { addToCart } = useCart();
  const product = item.product;
  const firstVariant = product.variants?.[0];
  const [selectedVariantId, setSelectedVariantId] = useState(
    firstVariant?.id || "",
  );
  const [imageLoaded, setImageLoaded] = useState(false);
  const selectedVariant = product.variants?.find(
    (variant) => variant.id === selectedVariantId,
  );
  const image = selectedVariant?.images?.[0] || product.imageUrl;

  useEffect(() => {
    setImageLoaded(!image);
  }, [image]);

  return (
    <article className="group">
      <div className="relative aspect-3/4 overflow-hidden bg-[var(--surface-muted)]">
        {!imageLoaded && image && (
          <div className="skeleton absolute inset-0 z-10" />
        )}
        {image ? (
          <Link to={`/product/${item.productId}`}>
            <img
              src={getOptimizedImageUrl(image, 600)}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
              className={`h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.03] ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </Link>
        ) : (
          <Link
            to={`/product/${item.productId}`}
            className="flex h-full items-center justify-center text-xs uppercase tracking-[0.14em] text-[var(--ink-300)]"
          >
            Image unavailable
          </Link>
        )}
        <WishlistButton
          product={product}
          icon="close"
          className="absolute right-1 top-1 z-20"
        />
      </div>
      <div className="pt-3">
        {product.isNew && <p className="eyebrow">New Season</p>}
        {product.brand?.name && (
          <p className="mt-1 truncate text-xs font-semibold sm:text-[13px]">
            {product.brand.name}
          </p>
        )}
        <Link
          to={`/product/${item.productId}`}
          className="mt-0.5 line-clamp-2 block text-xs leading-snug text-[var(--ink-500)] sm:text-[13px]"
        >
          {product.name}
        </Link>
        <DiscountPrice
          basePrice={product.basePrice}
          discountPercent={product.discountPercent}
          align="start"
          className="mt-1.5 text-xs font-semibold sm:text-[13px]"
        />
        <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)]">
          Variant
          <select
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="mt-2 w-full border border-[var(--line)] bg-white px-3 py-3 text-[13px] normal-case tracking-normal text-[var(--ink-900)] outline-none transition-colors focus:border-[var(--ink-900)]"
            disabled={!product.variants?.length}
          >
            {!product.variants?.length && (
              <option>No variants available</option>
            )}
            {product.variants?.map((variant) => (
              <option
                key={variant.id}
                value={variant.id}
                disabled={variant.stock < 1}
              >
                {variant.color} / {variant.size}
                {variant.stock < 1 ? " (Sold out)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!selectedVariant || selectedVariant.stock < 1}
          onClick={() =>
            addToCart(
              {
                ...product,
                variantId: selectedVariantId,
                price: product.basePrice,
              },
              1,
            )
          }
          className="mt-3 w-full bg-[var(--ink-900)] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-(--color-accent-orange) disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--ink-500)]"
        >
          Add to bag
        </button>
      </div>
    </article>
  );
};

const WishlistBrandRow = ({ item }) => (
  <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-4">
    <Link
      to={`/brands/${item.brand.id}`}
      className="min-w-0 truncate text-sm font-semibold text-[var(--ink-900)] hover:text-[var(--ink-500)]"
    >
      {item.brand.name}
    </Link>
    <WishlistButton brand={item.brand} icon="close" />
  </div>
);

const WishlistContent = () => {
  const { items, loading } = useWishlist();
  const productItems = items.filter((item) => item.productId);
  const brandItems = items.filter((item) => item.brandId);
  const isEmpty = productItems.length === 0 && brandItems.length === 0;

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-16 pt-10 md:pt-14">
        <p className="eyebrow">Saved pieces</p>
        <h1 className="display-title mt-2">Wishlist</h1>
        {loading ? (
          <Spinner
            label="Loading wishlist"
            className="mt-12 text-sm text-gray-500"
          />
        ) : isEmpty ? (
          <div className="mt-10 flex flex-col items-start gap-3 border-t border-[var(--line)] pt-10">
            <p className="section-title">Nothing saved yet</p>
            <p className="meta-text">
              Tap the heart on any piece — or follow a brand — to keep it here.
            </p>
            <Link
              to="/shop"
              className="mt-3 inline-flex border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
            >
              Explore the shop
            </Link>
          </div>
        ) : (
          <>
            {productItems.length > 0 && (
              <div className="mt-10 product-grid">
                {productItems.map((item) => (
                  <WishlistCard key={item.productId} item={item} />
                ))}
              </div>
            )}
            {brandItems.length > 0 && (
              <section className={productItems.length > 0 ? "mt-16 border-t border-[var(--line)] pt-10" : "mt-10"}>
                <h2 className="section-title">Followed brands</h2>
                <div className="mt-4 max-w-lg divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {brandItems.map((item) => (
                    <WishlistBrandRow key={item.brandId} item={item} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <RecentlyViewedRail />
      </div>
      <StoreSupport promises={false} help={false} newsletter={false} />
    </main>
  );
};

const Wishlist = () => (
  <RequireAuth>
    <WishlistContent />
  </RequireAuth>
);

export default Wishlist;
