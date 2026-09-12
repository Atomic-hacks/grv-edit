import React, { useEffect, useRef, useState } from "react";
import { motion as Motion } from "framer-motion";
import { getOptimizedImageUrl } from "../../lib/imageHelpers";

const POSITION_PATTERN = /\b(static|relative|absolute|fixed|sticky)\b/;

const RevealImage = ({
  src,
  alt = "",
  className = "",
  revealDuration = 2.1,
  ease = [0.8, 0, 0.3, 1],
  width = 1200,
  loading = "lazy",
}) => {
  const [loadedSrc, setLoadedSrc] = useState(null);
  const imageRef = useRef(null);
  const isLoaded = loadedSrc === src;
  const hasPosition = POSITION_PATTERN.test(className);
  const wrapperClasses =
    `${hasPosition ? "" : "relative"} overflow-hidden ${className}`.trim();

  useEffect(() => {
    setLoadedSrc(null);
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);

  return (
    <div className={wrapperClasses}>
      <Motion.div
        className="absolute inset-0"
        initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
        transition={{ duration: revealDuration, ease }}
      >
        {!isLoaded && (
          <div className="absolute inset-0 z-20 animate-pulse bg-gray-200" />
        )}
        <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-b from-black/60 via-black/5 to-black/75" />
        <img
          ref={imageRef}
          src={getOptimizedImageUrl(src, width)}
          alt={alt}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setLoadedSrc(src)}
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
