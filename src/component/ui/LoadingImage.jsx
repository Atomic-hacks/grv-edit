import React, { useEffect, useRef, useState } from "react";
import { getOptimizedImageUrl } from "../../lib/imageHelpers";

const LoadingImage = ({
  src,
  alt = "",
  className = "",
  wrapperClassName = "",
  width = 800,
  loading = "lazy",
}) => {
  const [loadedSrc, setLoadedSrc] = useState(null);
  const imageRef = useRef(null);
  const isLoaded = loadedSrc === src;

  useEffect(() => {
    setLoadedSrc(null);
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {!isLoaded && (
        <div className="absolute inset-0 z-10 animate-pulse bg-gray-200" />
      )}
      <img
        ref={imageRef}
        src={getOptimizedImageUrl(src, width)}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoadedSrc(src)}
        onError={() => setLoadedSrc(src)}
        className={`transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        } ${className}`}
      />
    </div>
  );
};

export default LoadingImage;
