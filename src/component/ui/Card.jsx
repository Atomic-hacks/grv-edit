import React, { useEffect, useRef, useState } from "react";
import WishlistButton from "./WishlistButton";
import { getOptimizedImageUrl } from "../../lib/imageHelpers";
import Spinner from "./Spinner";

const Card = ({
  img,
  hoverImg,
  alt,
  price,
  title,
  category,
  details,
  badge,
  onQuickAdd,
  product,
}) => {
  const primaryImage = img || "/img/short.png";
  const secondaryImage = hoverImg || "/img/sweatshirt.png";
  const [loadedImages, setLoadedImages] = useState({});
  const [quickAddPending, setQuickAddPending] = useState(false);
  const primaryImageRef = useRef(null);
  const secondaryImageRef = useRef(null);

  useEffect(() => {
    const nextLoadedImages = {};
    if (
      primaryImageRef.current?.complete &&
      primaryImageRef.current.naturalWidth > 0
    ) {
      nextLoadedImages[primaryImage] = true;
    }
    if (
      secondaryImageRef.current?.complete &&
      secondaryImageRef.current.naturalWidth > 0
    ) {
      nextLoadedImages[secondaryImage] = true;
    }
    setLoadedImages(nextLoadedImages);
  }, [primaryImage, secondaryImage]);

  const markImageLoaded = (source) => {
    setLoadedImages((current) => ({ ...current, [source]: true }));
  };
  const imagesLoaded = loadedImages[primaryImage];

  const handleQuickAdd = async (event) => {
    event.stopPropagation();
    if (quickAddPending) return;
    setQuickAddPending(true);
    try {
      await onQuickAdd?.();
    } finally {
      window.setTimeout(() => setQuickAddPending(false), 300);
    }
  };

  return (
    <div className="group mb-8 w-full">
      {/* Image Container */}
      <div className="relative aspect-3/4 w-full overflow-hidden bg-[#f0f0f0]">
        {!imagesLoaded && (
          <div className="absolute inset-0 z-20 animate-pulse bg-gray-200" />
        )}
        {badge && (
          <span className="absolute left-3 top-3 z-10 bg-(--color-accent-orange) px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-white">
            {badge}
          </span>
        )}
        {product && (
          <WishlistButton
            product={product}
            className="absolute right-3 top-3 z-30"
          />
        )}
        <img
          ref={primaryImageRef}
          src={getOptimizedImageUrl(primaryImage, 600)}
          alt={alt || title}
          loading="lazy"
          decoding="async"
          onLoad={() => markImageLoaded(primaryImage)}
          onError={() => markImageLoaded(primaryImage)}
          className={`h-full w-full object-cover object-center transition-[transform,opacity] duration-700 ease-out group-hover:scale-[1.03] group-hover:opacity-0 ${
            loadedImages[primaryImage] ? "opacity-100" : "opacity-0"
          }`}
        />
        <img
          ref={secondaryImageRef}
          src={getOptimizedImageUrl(secondaryImage, 600)}
          alt={alt || title}
          loading="lazy"
          decoding="async"
          onLoad={() => markImageLoaded(secondaryImage)}
          onError={() => markImageLoaded(secondaryImage)}
          className={`absolute inset-0 h-full w-full object-cover object-center opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:scale-[1.03] group-hover:opacity-100 ${
            loadedImages[secondaryImage] ? "" : "pointer-events-none"
          }`}
        />

        {/* Button - shows on card hover, icon rotates on button hover */}
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={quickAddPending}
          aria-busy={quickAddPending}
          className="absolute bottom-3 right-3 flex w-36 items-center justify-between border border-white bg-black px-3 py-2 text-white opacity-0 transition-all duration-300 group-hover:opacity-100 hover:px-4 group/button disabled:cursor-wait disabled:opacity-80 sm:bottom-5 sm:right-5 sm:w-40 sm:px-4"
        >
          {quickAddPending ? <Spinner label="Adding" /> : <p>Quick Add</p>}
          {!quickAddPending && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 transition-transform duration-300 group-hover/button:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Text Section */}
      <div className="flex w-full items-start justify-between gap-3 pt-3">
        <div className="min-w-0">
          <p className="min-h-10 wrap-break-word text-sm font-semibold leading-tight text-neutral-800 sm:text-base">
            {title}
          </p>
          {(category || details) && (
            <p className="mt-1 text-xs text-neutral-500">
              {[category, details].filter(Boolean).join(" / ")}
            </p>
          )}
        </div>
        <p className="shrink-0 text-sm font-semibold text-neutral-800 sm:text-base">
          {price}
        </p>
      </div>
    </div>
  );
};

export default Card;
