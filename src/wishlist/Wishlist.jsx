import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RequireAuth from "../component/auth/RequireAuth";
import WishlistButton from "../component/ui/WishlistButton";
import Spinner from "../component/ui/Spinner";
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
      <div className="relative aspect-3/4 overflow-hidden bg-gray-100">
        {!imageLoaded && image && (
          <div className="absolute inset-0 z-10 animate-pulse bg-gray-200" />
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
            className="flex h-full items-center justify-center text-xs uppercase tracking-[0.16em] text-gray-400"
          >
            Image unavailable
          </Link>
        )}
        <WishlistButton
          product={product}
          icon="close"
          className="absolute right-3 top-3 z-20"
        />
      </div>
      <div className="mt-4">
        {product.isNew && <p className="text-xs text-gray-500">New Season</p>}
        <p className="mt-1 font-semibold">{product.brand?.name}</p>
        <Link
          to={`/product/${item.productId}`}
          className="mt-1 block text-sm text-gray-700"
        >
          {product.name}
        </Link>
        <DiscountPrice
          basePrice={product.basePrice}
          discountPercent={product.discountPercent}
          className="mt-3 items-start font-semibold"
        />
        <label className="mt-4 block text-xs text-gray-500">
          Variant
          <select
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="mt-2 w-full border border-gray-300 bg-white px-3 py-3 text-sm text-black outline-none focus:border-black"
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
          className="mt-4 w-full bg-black px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
        >
          Add To Bag
        </button>
      </div>
    </article>
  );
};

const WishlistContent = () => {
  const { items, loading } = useWishlist();

  return (
    <main className="min-h-screen bg-white px-4 pb-20 pt-16 md:px-12 md:pt-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
          Saved pieces
        </p>
        <h1 className="mt-4 text-4xl font-semibold">Wishlist</h1>
        {loading ? (
          <Spinner
            label="Loading wishlist"
            className="mt-12 text-sm text-gray-500"
          />
        ) : items.length === 0 ? (
          <div className="mt-12 border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-600">
              You have not saved anything yet.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex bg-black px-6 py-3 text-sm font-medium text-white"
            >
              Explore the shop
            </Link>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-5">
            {items.map((item) => (
              <WishlistCard key={item.productId} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

const Wishlist = () => (
  <RequireAuth>
    <WishlistContent />
  </RequireAuth>
);

export default Wishlist;
