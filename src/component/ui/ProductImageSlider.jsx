import React, { useEffect, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";

const SWIPE_THRESHOLD = 60;

const ProductImageSlider = ({ images = [], alt = "" }) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Reset to the first image when the image set changes (e.g. new variant selected)
  useEffect(() => {
    setIndex(0);
    setDirection(0);
  }, [images]);

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
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <Motion.img
          key={images[index]}
          src={images[index]}
          alt={alt}
          custom={direction}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          initial={{ x: direction >= 0 ? "100%" : "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction >= 0 ? "-100%" : "100%", opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full cursor-grab object-cover active:cursor-grabbing"
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
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