import React from "react";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import LoadingImage from "../component/ui/LoadingImage";
import { BrandGridSkeleton } from "../component/ui/LoadingSkeletons";
import ErrorState from "../component/ui/ErrorState";
import { fetchBrands } from "../lib/apiClient";
import { useAsync } from "../lib/useAsync";

const Brands = () => {
  const {
    data: brands,
    loading,
    error,
    refetch,
  } = useAsync(() => fetchBrands(), []);

  return (
    <div className="page-shell min-h-screen bg-white pb-24">
      <div className="relative pb-8 pt-10 md:pb-12 md:pt-14">
        <AnimatedPageTitle
          title="Brands"
          subtitle="Explore the labels behind our curated collection."
        />
      </div>

      {error ? (
        <ErrorState
          title="Couldn't load brands"
          message="Something went wrong on our end — your connection is fine."
          onRetry={refetch}
        />
      ) : loading ? (
        <BrandGridSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 md:gap-y-14 lg:grid-cols-4">
          {(brands || []).map((brand) => (
            <Link key={brand.id} to={`/brands/${brand.id}`} className="group">
              <div className="aspect-3/4 overflow-hidden bg-[var(--surface-muted)]">
                <LoadingImage
                  src={brand.logo}
                  alt={brand.name}
                  width={800}
                  className="h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                  wrapperClassName="h-full w-full"
                />
              </div>
              <div className="pt-3">
                <h2 className="text-[13px] font-semibold text-[var(--ink-900)]">
                  {brand.name}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--ink-500)]">
                  {brand.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Brands;
