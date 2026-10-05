import React, { useRef } from "react";

const HorizontalCarousel = ({ children, className = "" }) => {
  const trackRef = useRef(null);

  const move = (direction) => {
    trackRef.current?.scrollBy({
      left: direction * trackRef.current.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={trackRef}
        className="rail-scroll flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 sm:gap-3"
      >
        {React.Children.map(children, (child) => (
          <div className="min-w-[78vw] snap-start sm:min-w-[42vw] lg:min-w-[24vw]">
            {child}
          </div>
        ))}
      </div>
      <div className="mt-4 hidden justify-end gap-2 md:flex">
        <button
          type="button"
          aria-label="Previous items"
          onClick={() => move(-1)}
          className="flex h-9 w-9 items-center justify-center border border-[var(--line)] text-sm transition-colors hover:border-[var(--ink-900)] hover:bg-[var(--ink-900)] hover:text-white"
        >
          &larr;
        </button>
        <button
          type="button"
          aria-label="Next items"
          onClick={() => move(1)}
          className="flex h-9 w-9 items-center justify-center border border-[var(--line)] text-sm transition-colors hover:border-[var(--ink-900)] hover:bg-[var(--ink-900)] hover:text-white"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
};

export default HorizontalCarousel;
