import React, { useState } from "react";
import { useRequireAuthAction } from "../auth/useRequireAuthAction";
import { useWishlist } from "../../context/WishlistContext";
import Spinner from "./Spinner";

const HeartIcon = ({ filled }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const WishlistButton = ({ product, className = "", icon = "heart" }) => {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const requireAuthAction = useRequireAuthAction();
  const [pending, setPending] = useState(false);
  const saved = isWishlisted(product.id);

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    requireAuthAction(async () => {
      setPending(true);
      try {
        await toggleWishlist(product);
      } finally {
        setPending(false);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      className={`flex h-10 w-10 items-center justify-center  text-black shadow-sm transition disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? (
        <Spinner />
      ) : icon === "close" ? (
        <CloseIcon />
      ) : (
        <HeartIcon filled={saved} className="hover:scale-110 transition-transform duration-300" />
      )}
    </button>
  );
};

export default WishlistButton;
