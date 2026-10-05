import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { getOptimizedImageUrl } from "../../lib/imageHelpers";

const SWIPE_THRESHOLD = 60;

const ProductImageSlider = ({ images = [], alt = "" }) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loadedImages, setLoadedImages] = useState({});
  const imageRef = useRef(null);
  const imageSetKey = images.join("|");

  // Reset to the first image when the image set changes (e.g. new variant
  // selected) — but loadedImages is a per-URL cache, not per-set state, so
  // it's never wiped here. Two variants commonly share the same fallback
  // photo (product.imageUrl when a variant has none of its own); wiping the
  // cache on every switch meant that shared URL's <img> — already loaded,
  // never remounted since its key (the URL) didn't change — could never
  // fire onLoad again, leaving it stuck at opacity-0 under a skeleton that
  // never turns off.
  useEffect(() => {
    setIndex(0);
    setDirection(0);
  }, [imageSetKey]);

  const activeImage = images[index];
  const isLoaded = loadedImages[activeImage];

  // Before paint, not after — see LoadingImage for why.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setLoadedImages((current) => ({ ...current, [activeImage]: true }));
    }
  }, [activeImage]);

  if (images.length === 0) return null;

  const goTo = (nextIndex, dir) => {
    if (nextIndex < 0 || nextIndex >= images.length) return;
    setDirection(dir);
    setIndex(nextIndex);
  };

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      goTo(index + 1, 1);
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      goTo(index - 1, -1);
    }
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-gray-50">
      {!isLoaded && (
        <div className="absolute inset-0 z-20 animate-pulse bg-gray-200" />
      )}
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <Motion.img
          ref={imageRef}
          key={activeImage}
          src={getOptimizedImageUrl(activeImage, 1200)}
          alt={alt}
          onLoad={() =>
            setLoadedImages((current) => ({ ...current, [activeImage]: true }))
          }
          onError={() =>
            setLoadedImages((current) => ({ ...current, [activeImage]: true }))
          }
          custom={direction}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          initial={{ x: direction >= 0 ? "100%" : "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction >= 0 ? "-100%" : "100%", opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-0 h-full w-full cursor-grab object-cover transition-opacity duration-300 active:cursor-grabbing ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading={index === 0 ? "eager" : "lazy"}
          draggable={false}
        />
      </AnimatePresence>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1, -1)}
            disabled={index === 0}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/30 text-white backdrop-blur-sm transition-opacity disabled:opacity-0"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M9 2.5L4 7l5 4.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1, 1)}
            disabled={index === images.length - 1}
            aria-label="Next image"
            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/30 text-white backdrop-blur-sm transition-opacity disabled:opacity-0"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M5 2.5l5 4.5-5 4.5" />
            </svg>
          </button>

          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {images.map((image, i) => (
              <button
                key={image}
                type="button"
                onClick={() => goTo(i, i > index ? 1 : -1)}
                aria-label={`Go to image ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductImageSlider;
