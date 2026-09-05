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
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
          className="border border-black px-3 py-2 text-sm hover:bg-black hover:text-white"
        >
          &larr;
        </button>
        <button
          type="button"
          aria-label="Next items"
          onClick={() => move(1)}
          className="border border-black px-3 py-2 text-sm hover:bg-black hover:text-white"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
};

export default HorizontalCarousel;
