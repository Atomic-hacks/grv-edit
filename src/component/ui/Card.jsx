import React, { useLayoutEffect, useRef, useState } from "react";
import WishlistButton from "./WishlistButton";
import { getOptimizedImageUrl } from "../../lib/imageHelpers";
import Spinner from "./Spinner";
import DiscountPrice from "./DiscountPrice";

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

  // Before paint, not after — see LoadingImage for why.
  useLayoutEffect(() => {
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
  // Only cross-fade when there is genuinely a second shot to show. Fading to
  // a duplicate of the same image just made cards flicker on hover.
  const hasSecondImage = secondaryImage !== primaryImage;

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

  // The label line above the name: a badge wins, otherwise the taxonomy the
  // shopper filtered by. Keeps every card's first line doing the same job.
  const eyebrow = badge || category || details;
  const brandName = product?.brandName;

  return (
    <div className="group w-full">
      {/* Image */}
      <div className="relative aspect-3/4 w-full overflow-hidden bg-[var(--surface-muted)]">
        {!imagesLoaded && <div className="skeleton absolute inset-0 z-20" />}
        {badge && (
          <span className="absolute left-0 top-0 z-10 bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-900)]">
            {badge}
          </span>
        )}
        {product && (
          <WishlistButton
            product={product}
            className="absolute right-1 top-1 z-30"
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
          className={`h-full w-full object-cover object-center transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            hasSecondImage
              ? "group-hover:scale-[1.02] group-hover:opacity-0"
              : "group-hover:scale-[1.03]"
          } ${loadedImages[primaryImage] ? "opacity-100" : "opacity-0"}`}
        />
        {hasSecondImage && (
          <img
            ref={secondaryImageRef}
            src={getOptimizedImageUrl(secondaryImage, 600)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            onLoad={() => markImageLoaded(secondaryImage)}
            onError={() => markImageLoaded(secondaryImage)}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-0 transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] group-hover:opacity-100"
          />
        )}

        {/* Quick add. Slides up out of the image edge on pointer devices; on
            touch it stays put, where hover would otherwise make it
            unreachable. */}
        {onQuickAdd && (
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={quickAddPending}
            aria-busy={quickAddPending}
            aria-label={`Quick add ${title}`}
            className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-black/90 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-[transform,opacity,background-color] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black disabled:cursor-wait disabled:opacity-80 lg:translate-y-full lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100"
          >
            {quickAddPending ? <Spinner label="Adding" /> : "Quick add"}
          </button>
        )}
      </div>

      {/* Product information: eyebrow, brand, name, price — stacked and left
          aligned, so a grid or rail of cards scans as columns of the same
          fields. Every row below reserves its space whether or not this
          particular product has that field (a non-breaking space instead of
          nothing, a fixed two-line height for the title): without that, a
          badge-less, brand-less, short-titled card sits two lines shorter
          than its neighbour and the row reads as uneven. */}
      <div className="pt-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-500)]">
          {eyebrow || " "}
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-[var(--ink-900)] sm:text-[13px]">
          {brandName || " "}
        </p>
        <p
          className={`mt-0.5 line-clamp-2 min-h-[2.6em] text-xs leading-snug sm:text-[13px] ${
            brandName
              ? "text-[var(--ink-500)]"
              : "font-semibold text-[var(--ink-900)]"
          }`}
        >
          {title}
        </p>
        <DiscountPrice
          basePrice={product?.basePrice}
          discountPercent={product?.discountPercent}
          normalPrice={price}
          align="start"
          className="mt-1.5 text-xs font-semibold text-[var(--ink-900)] sm:text-[13px]"
        />
      </div>
    </div>
  );
};

export default Card;
