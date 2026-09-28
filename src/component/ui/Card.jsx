import React, { useLayoutEffect, useRef, useState } from "react";
import WishlistButton from "./WishlistButton";
import { getOptimizedImageUrl } from "../../lib/imageHelpers";
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
  product,
}) => {
  const primaryImage = img || "/img/short.png";
  const secondaryImage = hoverImg || "/img/sweatshirt.png";
  const [loadedImages, setLoadedImages] = useState({});
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

  // The label line above the name: a badge wins, otherwise the taxonomy the
  // shopper filtered by. Keeps every card's first line doing the same job.
  const eyebrow = badge || category || details;
  const brandName = product?.brandName;

  return (
    <div className="group w-full">
      {/* Image. 3:4 portrait is the ratio every product photo should be shot
          or cropped to before upload — it's what every product card, the
          wishlist grid and the brand/department tiles use, so a mismatched
          photo is the one that stands out. object-top (rather than the
          default center) keeps the crop anchored to the top of the frame,
          which is where the garment/model starts in nearly every shot GRV
          uses — so a photo that's slightly taller or shorter than 3:4 still
          crops at the hem/background instead of randomly slicing through a
          head or logo. */}
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
          className={`h-full w-full object-cover object-top transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-0 transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] group-hover:opacity-100"
          />
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
