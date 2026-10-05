import React, { useEffect } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { formatPrice } from "../../lib/productHelpers";
import LoadingImage from "../ui/LoadingImage";

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const drawerVariants = {
  hidden: { x: "100%" },
  visible: { x: 0 },
};

const getItemStock = (product) =>
  product?.variants?.find((variant) => variant.id === product.variantId)?.stock;

const CartDrawer = () => {
  const {
    isCartOpen,
    closeCart,
    cartItems,
    updateQty,
    removeFromCart,
    subtotal,
  } = useCart();

  useEffect(() => {
    if (!isCartOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        closeCart();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isCartOpen, closeCart]);

  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [isCartOpen]);

  return (
    <AnimatePresence>
      {isCartOpen && (
        <Motion.div
          className="fixed inset-0 z-50"
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <Motion.button
            type="button"
            aria-label="Close Goody Bag"
            className="absolute inset-0 bg-black/40"
            variants={overlayVariants}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={closeCart}
          />
          <Motion.div
            className="absolute right-0 top-0 flex h-full w-full flex-col bg-white text-[var(--ink-900)] shadow-[-8px_0_40px_rgba(0,0,0,0.12)] sm:max-w-md md:max-w-lg"
            variants={drawerVariants}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em]">
                Your Goody Bag
                {cartItems.length > 0 && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-[var(--ink-500)]">
                    {cartItems.length}
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close Goody Bag"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-500)] transition-colors hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {cartItems.length === 0 && (
                <div className="flex flex-col items-start gap-3 py-10">
                  <p className="section-title">Your Goody Bag is empty</p>
                  <p className="meta-text">
                    Pieces you add will be kept here while you browse.
                  </p>
                  <Link
                    to="/shop"
                    onClick={closeCart}
                    className="mt-2 border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
                  >
                    Start shopping
                  </Link>
                </div>
              )}
              {cartItems.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="h-28 w-21 shrink-0 overflow-hidden bg-[var(--surface-muted)]">
                    <LoadingImage
                      src={item.product.image}
                      alt={item.product.name}
                      width={240}
                      className="w-full h-full object-cover"
                      wrapperClassName="w-full h-full"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        {item.product.brandName && (
                          <p className="truncate text-[13px] font-semibold">
                            {item.product.brandName}
                          </p>
                        )}
                        <p
                          className={`truncate text-[13px] ${
                            item.product.brandName
                              ? "text-[var(--ink-500)]"
                              : "font-semibold"
                          }`}
                        >
                          {item.product.name}
                        </p>
                        <p className="meta-text mt-0.5">
                          {formatPrice(item.product.price)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="shrink-0 text-[11px] uppercase tracking-[0.1em] text-[var(--ink-300)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      {(() => {
                        const stock = getItemStock(item.product);
                        const atStockLimit =
                          Number.isFinite(stock) && item.qty >= stock;
                        return (
                          <div className="flex items-center border border-[var(--line)]">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              className="h-10 w-10 text-sm transition-colors hover:bg-[var(--surface-muted)]"
                              onClick={() => updateQty(item.id, item.qty - 1)}
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-[13px] font-semibold">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              className="h-10 w-10 text-sm transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--ink-300)] disabled:hover:bg-transparent"
                              onClick={() => updateQty(item.id, item.qty + 1)}
                              disabled={atStockLimit}
                              aria-label={
                                atStockLimit
                                  ? `Only ${stock} available`
                                  : "Increase quantity"
                              }
                            >
                              +
                            </button>
                          </div>
                        );
                      })()}
                      <p className="text-[13px] font-semibold">
                        {formatPrice(item.product.price * item.qty)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--line)] px-6 py-5">
              <div className="flex items-center justify-between text-[13px] font-semibold">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <p className="meta-text mt-1">
                Shipping and discounts are calculated at checkout.
              </p>
              <Link
                to="/checkout"
                onClick={closeCart}
                className={`mt-4 block w-full bg-[var(--ink-900)] py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-(--color-accent-orange) ${
                  cartItems.length === 0 ? "pointer-events-none opacity-40" : ""
                }`}
                aria-disabled={cartItems.length === 0}
              >
                Proceed to Checkout
              </Link>
              {cartItems.length > 0 && (
                <Link
                  to="/cart"
                  onClick={closeCart}
                  className="mt-3 block text-center text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
                >
                  View full bag
                </Link>
              )}
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
