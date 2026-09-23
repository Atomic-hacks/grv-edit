import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useRequireAuthAction } from "../component/auth/useRequireAuthAction";
import { formatPrice } from "../lib/productHelpers";
import { fetchProducts } from "../lib/apiClient";
import LoadingImage from "../component/ui/LoadingImage";
import ProductRail from "../component/section/ProductRail";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";

const getItemStock = (product) =>
  product?.variants?.find((variant) => variant.id === product.variantId)?.stock;

const getItemVariant = (product) =>
  product?.variants?.find((variant) => variant.id === product.variantId);

const CartLine = ({ item }) => {
  const { updateQty, removeFromCart } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const requireAuthAction = useRequireAuthAction();
  const product = item.product;
  const variant = getItemVariant(product);
  const stock = getItemStock(product);
  const atStockLimit = Number.isFinite(stock) && item.qty >= stock;
  const saved = isWishlisted(product.id);

  // Moving to wishlist is one action from the shopper's point of view, so it
  // saves and clears the line together rather than making them do both.
  const moveToWishlist = () =>
    requireAuthAction(async () => {
      if (!saved) await toggleWishlist(product);
      removeFromCart(item.id);
    });

  return (
    <article className="flex gap-4 border-b border-[var(--line)] py-6 sm:gap-6">
      <Link
        to={`/product/${product.id}`}
        className="h-32 w-24 shrink-0 overflow-hidden bg-[var(--surface-muted)] sm:h-40 sm:w-30"
      >
        <LoadingImage
          src={product.image}
          alt={product.name}
          width={320}
          className="h-full w-full object-cover"
          wrapperClassName="h-full w-full"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {product.brandName && (
              <Link
                to={`/product/${product.id}`}
                className="block truncate text-[13px] font-semibold"
              >
                {product.brandName}
              </Link>
            )}
            <Link
              to={`/product/${product.id}`}
              className={`block truncate text-[13px] ${
                product.brandName
                  ? "text-[var(--ink-500)]"
                  : "font-semibold text-[var(--ink-900)]"
              }`}
            >
              {product.name}
            </Link>
            {/* Low stock is the one piece of urgency worth showing: it is a
                fact about the bag, not a marketing line. */}
            {Number.isFinite(stock) && stock > 0 && stock <= 3 && (
              <p className="mt-2 inline-block border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[var(--ink-700)]">
                Last {stock} left
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className="text-[13px] font-semibold">
              {formatPrice(product.price * item.qty)}
            </p>
            <button
              type="button"
              onClick={() => removeFromCart(item.id)}
              aria-label={`Remove ${product.name} from bag`}
              className="text-[var(--ink-300)] transition-colors hover:text-[var(--ink-900)]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            {variant && (
              <div>
                <p className="eyebrow">Size</p>
                <p className="mt-1 flex items-baseline gap-2 text-[13px]">
                  {variant.size}
                  {/* Changing size means choosing a different variant, which
                      lives on the product page — so we send them there rather
                      than half-rebuilding the picker here. */}
                  <Link
                    to={`/product/${product.id}`}
                    className="text-[11px] text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
                  >
                    Change
                  </Link>
                </p>
              </div>
            )}
            <div>
              <p className="eyebrow">Quantity</p>
              <div className="mt-1 flex items-center border border-[var(--line)]">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  className="h-10 w-10 text-sm transition-colors hover:bg-[var(--surface-muted)]"
                  onClick={() => updateQty(item.id, item.qty - 1)}
                >
                  −
                </button>
                <span className="w-9 text-center text-[13px] font-semibold">
                  {item.qty}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty(item.id, item.qty + 1)}
                  disabled={atStockLimit}
                  aria-label={
                    atStockLimit
                      ? `Only ${stock} available`
                      : "Increase quantity"
                  }
                  className="h-10 w-10 text-sm transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--ink-300)] disabled:hover:bg-transparent"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={moveToWishlist}
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] transition-colors hover:text-[var(--ink-900)]"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
            </svg>
            Move to wishlist
          </button>
        </div>
      </div>
    </article>
  );
};

// Nudges the shopper back to pieces they already saved. Only appears when
// there is actually something saved.
const WishlistReminder = () => {
  const { items } = useWishlist();
  if (items.length === 0) return null;

  return (
    <section className="page-shell border-t border-[var(--line)] py-12 text-center">
      <p className="eyebrow">From your wishlist</p>
      <h2 className="section-title mt-1.5">
        {items.length === 1
          ? "One saved piece is waiting"
          : `${items.length} saved pieces are waiting`}
      </h2>
      <Link
        to="/wishlist"
        className="mt-5 inline-block border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
      >
        Go to wishlist
      </Link>
    </section>
  );
};

const CartPage = () => {
  const { cartItems, subtotal, itemCount, addToCart } = useCart();

  // Cross-sell is anchored to what is already in the bag: the category of the
  // first line, not a generic "popular now" feed.
  const anchorCategoryId = cartItems[0]?.product?.categoryId;
  const { data: suggestedData, isPending: suggestionsLoading } = useQuery({
    queryKey: ["products", { categoryId: anchorCategoryId }],
    queryFn: () => fetchProducts({ categoryId: anchorCategoryId }),
    enabled: Boolean(anchorCategoryId),
  });
  const inBagIds = new Set(cartItems.map((item) => item.product.id));
  const suggestions = (suggestedData || [])
    .filter((product) => !inBagIds.has(product.id))
    .slice(0, 12);

  return (
    <main className="min-h-screen bg-white pb-8">
      <div className="page-shell pt-10 md:pt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="display-title">Shopping Bag</h1>
          <Link
            to="/shop"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] underline underline-offset-4 transition-colors hover:text-(--color-accent-orange)"
          >
            Continue shopping
          </Link>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex flex-col items-start gap-3 border-t border-[var(--line)] py-16">
            <p className="section-title">Your Goody Bag is empty</p>
            <p className="meta-text max-w-sm">
              Pieces you add are kept here while you browse, on this device.
            </p>
            <Link
              to="/shop"
              className="mt-3 border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
            <div className="border-t border-[var(--line)]">
              {cartItems.map((item) => (
                <CartLine key={item.id} item={item} />
              ))}
            </div>

            {/* Summary follows the shopper down a long bag rather than sitting
                at the top where the total scrolls out of sight. */}
            <aside className="lg:sticky lg:top-[calc(var(--nav-h)+24px)] lg:self-start">
              <div className="border border-[var(--line)] p-6">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em]">
                  Summary
                </h2>
                <dl className="mt-5 space-y-3 text-[13px]">
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--ink-500)]">
                      Subtotal ({itemCount}{" "}
                      {itemCount === 1 ? "item" : "items"})
                    </dt>
                    <dd>{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--ink-500)]">Delivery</dt>
                    {/* Shipping is worked out from the address at checkout, so
                        the bag says so instead of showing a total that will
                        change. */}
                    <dd className="text-[var(--ink-500)]">
                      Calculated at checkout
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4 text-[13px] font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <Link
                  to="/checkout"
                  className="mt-6 block w-full bg-[var(--ink-900)] py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-(--color-accent-orange)"
                >
                  Go to checkout
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>

      <div className="page-shell">
        <ProductRail
          eyebrow="Goes with your bag"
          title="You might also want"
          products={suggestions}
          loading={Boolean(anchorCategoryId) && suggestionsLoading}
          onQuickAdd={(product, images) =>
            addToCart(
              {
                ...product,
                price: product.basePrice,
                image: images[0],
                hoverImage: images[1] || images[0],
              },
              1,
            )
          }
        />
      </div>

      <WishlistReminder />

      <div className="page-shell">
        <RecentlyViewedRail />
      </div>

      <StoreSupport promises help={false} />
    </main>
  );
};

export default CartPage;
