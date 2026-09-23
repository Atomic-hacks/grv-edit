import React from "react";

// Skeletons mirror the real components they stand in for — same aspect
// ratios, same text-line positions — so nothing jumps when data lands.
const SkeletonBlock = ({ className = "" }) => (
  <div className={`skeleton ${className}`} />
);

export const ProductGridSkeleton = ({ count = 10 }) => (
  <div className="product-grid" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="w-full">
        <SkeletonBlock className="aspect-3/4 w-full" />
        <div className="space-y-2 pt-3">
          <SkeletonBlock className="h-2.5 w-1/3" />
          <SkeletonBlock className="h-3 w-2/3" />
          <SkeletonBlock className="h-3 w-1/2" />
          <SkeletonBlock className="h-3 w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

export const BrandGridSkeleton = ({ count = 8 }) => (
  <div
    className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 md:gap-y-14 lg:grid-cols-4"
    aria-hidden="true"
  >
    {Array.from({ length: count }, (_, index) => (
      <div key={index}>
        <SkeletonBlock className="aspect-3/4 w-full" />
        <SkeletonBlock className="mt-3 h-3 w-1/2" />
        <SkeletonBlock className="mt-2 h-3 w-4/5" />
      </div>
    ))}
  </div>
);

export const HorizontalSkeleton = ({ count = 4 }) => (
  <div className="flex gap-3 overflow-hidden" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="min-w-[78vw] sm:min-w-[42vw] lg:min-w-[24vw]">
        <SkeletonBlock className="aspect-3/4 w-full" />
        <SkeletonBlock className="mt-3 h-3 w-2/3" />
      </div>
    ))}
  </div>
);

export const ProductDetailSkeleton = () => (
  <main className="min-h-screen pb-20">
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px]">
      <SkeletonBlock className="h-[65vh] w-full lg:h-[85vh]" />
      <div className="space-y-5 px-[var(--gutter)] py-10">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-7 w-2/3" />
        <SkeletonBlock className="h-4 w-1/2" />
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-13 w-full" />
      </div>
    </div>
  </main>
);
