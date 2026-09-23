import React, { useLayoutEffect, useRef, useState } from "react";
import { motion as Motion } from "framer-motion";
import { getOptimizedImageUrl } from "../../lib/imageHelpers";

const POSITION_PATTERN = /\b(static|relative|absolute|fixed|sticky)\b/;

// The deliberate, editorial reveal — used for hero shots, department tiles,
// brand banners: places where a slow clip-path sweep reads as intentional
// rather than a loading state. Kept off the product grid (Card.jsx has its
// own lightweight fade), where a dozen-plus instances animating at once
// would cost more than it's worth.
const RevealImage = ({
  src,
  alt = "",
  className = "",
  revealDuration = 2.1,
  ease = [0.8, 0, 0.3, 1],
  width = 1200,
  loading = "lazy",
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imageRef = useRef(null);
  const hasPosition = POSITION_PATTERN.test(className);
  const wrapperClasses =
    `${hasPosition ? "" : "relative"} overflow-hidden ${className}`.trim();

  // Checked before paint, not after: an already-cached image (revisiting a
  // page, a remounted tile) should never flash its skeleton.
  useLayoutEffect(() => {
    setIsLoaded(false);
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setIsLoaded(true);
  }, [src]);

  return (
    <div className={wrapperClasses}>
      <Motion.div
        className="absolute inset-0"
        initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
        transition={{ duration: revealDuration, ease }}
      >
        {!isLoaded && <div className="skeleton absolute inset-0 z-20" />}
        <div className="pointer-events-none absolute inset-0 z-50 bg-linear-to-b from-black/60 via-black/5 to-black/75" />
        <img
          ref={imageRef}
          src={getOptimizedImageUrl(src, width)}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading={loading}
          draggable={false}
        />
      </Motion.div>
    </div>
  );
};

export default RevealImage;
