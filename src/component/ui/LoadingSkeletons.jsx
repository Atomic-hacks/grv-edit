import React from "react";

const SkeletonBlock = ({ className = "" }) => (
  <div
    className={`animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 ${className}`}
  />
);

export const ProductGridSkeleton = ({ count = 8 }) => (
  <div className="product-grid" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="mb-8 w-full animate-fade-in-up">
        <SkeletonBlock className="aspect-3/4 w-full" />
        <div className="flex items-start justify-between gap-3 pt-3">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
          <SkeletonBlock className="h-4 w-12" />
        </div>
      </div>
    ))}
  </div>
);

export const BrandGridSkeleton = ({ count = 6 }) => (
  <div
    className="grid grid-cols-1 gap-x-4 gap-y-12 pb-20 md:grid-cols-2 lg:grid-cols-3"
    aria-hidden="true"
  >
    {Array.from({ length: count }, (_, index) => (
      <div key={index}>
        <SkeletonBlock className="aspect-3/4 w-full" />
        <SkeletonBlock className="mt-4 h-6 w-1/2" />
        <SkeletonBlock className="mt-3 h-4 w-4/5" />
      </div>
    ))}
  </div>
);

export const HorizontalSkeleton = ({ count = 4 }) => (
  <div className="flex gap-2 overflow-hidden" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="min-w-[72vw] md:min-w-[30vw]">
        <SkeletonBlock className="aspect-3/4 w-full" />
        <SkeletonBlock className="mt-3 h-4 w-2/3" />
      </div>
    ))}
  </div>
);

export const ProductDetailSkeleton = () => (
  <main className="min-h-screen px-4 py-12 md:px-12">
    <div className="grid gap-10 lg:grid-cols-2">
      <SkeletonBlock className="aspect-3/4 w-full" />
      <div className="space-y-6 py-4">
        <SkeletonBlock className="h-10 w-3/4" />
        <SkeletonBlock className="h-6 w-24" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
    </div>
  </main>
);
