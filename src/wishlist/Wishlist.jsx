import React from "react";
import { Link } from "react-router-dom";
import RequireAuth from "../component/auth/RequireAuth";
import WishlistButton from "../component/ui/WishlistButton";
import LoadingImage from "../component/ui/LoadingImage";
import Spinner from "../component/ui/Spinner";
import { useWishlist } from "../context/WishlistContext";
import { formatPrice, getProductImages } from "../lib/productHelpers";

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
            {items.map((item) => {
              const product = item.product;
              const image = getProductImages(product)[0];
              return (
                <article key={item.productId} className="group">
                  <div className="relative aspect-3/4 overflow-hidden bg-gray-100">
                    <Link to={`/product/${item.productId}`}>
                      <LoadingImage
                        src={image}
                        alt={product.name}
                        width={600}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        wrapperClassName="h-full w-full"
                      />
                    </Link>
                    <WishlistButton
                      product={product}
                      className="absolute right-3 top-3"
                    />
                  </div>
                  <Link
                    to={`/product/${item.productId}`}
                    className="mt-3 block"
                  >
                    <div className="flex justify-between gap-3 text-sm font-semibold">
                      <span>{product.name}</span>
                      <span>{formatPrice(product.basePrice)}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {product.brand?.name}
                    </p>
                  </Link>
                </article>
              );
            })}
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
