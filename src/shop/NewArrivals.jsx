import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import FilterDrawer from "../component/ui/FilterDrawer";
import ListingToolbar from "../component/ui/ListingToolbar";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import ErrorState from "../component/ui/ErrorState";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import { getProductImages } from "../lib/productHelpers";
import { fetchNewArrivals } from "../lib/apiClient";
import { useAsync } from "../lib/useAsync";
import { useCart } from "../context/CartContext";

import {
  emptyClientFilters,
  applyClientFilters,
  buildClientFacets,
  countActiveClientFilters,
} from "../lib/clientProductFilters";

const NewArrivals = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(emptyClientFilters);
  const { addToCart } = useCart();
  const { data: products, loading, error, refetch } = useAsync(() => fetchNewArrivals(), []);
  const baseProducts = useMemo(() => products || [], [products]);
  const arrivals = useMemo(() => applyClientFilters(baseProducts, appliedFilters), [baseProducts, appliedFilters]);
  const facets = useMemo(() => buildClientFacets(baseProducts), [baseProducts]);

  const activeFilterCount = countActiveClientFilters(appliedFilters);

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-24">
        <Breadcrumbs className="pt-4" items={[{ label: "Home", to: "/" }, { label: "New arrivals" }]} />
        <div className="pb-8 pt-6 md:pb-10 md:pt-8">
          <AnimatedPageTitle title="New Arrivals" subtitle="The latest pieces, selected as they arrive." />
        </div>
        <ListingToolbar
          onClearFilters={activeFilterCount > 0 ? () => setAppliedFilters(emptyClientFilters()) : undefined}
          leftContent={
            <span className="meta-text">{arrivals.length} {arrivals.length === 1 ? "product" : "products"}</span>
          }
          onFilter={() => setIsFilterOpen(true)}
          activeFilterCount={activeFilterCount}
        />
        {error ? (
          <ErrorState
            title="Couldn't load new arrivals"
            message="Something went wrong on our end — your connection is fine."
            onRetry={refetch}
          />
        ) : loading ? (
          <ProductGridSkeleton />
        ) : arrivals.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="section-title">Nothing matches these filters</p>
            <p className="meta-text max-w-sm">Try removing a filter to see the rest of the new arrivals.</p>
          </div>
        ) : (
          <div className="product-grid">
            {arrivals.map((item) => {
              const images = getProductImages(item);
              return (
                <Link key={item.id} to={`/product/${item.id}`}>
                  <Card
                    img={images[0]}
                    hoverImg={images[1] || images[0]}
                    alt={item.name}
                    title={item.name}
                    product={item}
                    category={item.subcategory}
                    badge="NEW"
                    onQuickAdd={() =>
                      addToCart(
                        { ...item, price: item.basePrice, image: images[0], hoverImage: images[1] || images[0] },
                        1,
                      )
                    }
                  />
                </Link>
              );
            })}
          </div>
        )}
        <FilterDrawer
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          appliedFilters={appliedFilters}
          onApply={(filters) => {
            setAppliedFilters(filters);
            setIsFilterOpen(false);
          }}
          facets={facets}
        />
        <RecentlyViewedRail />
      </div>
      <StoreSupport promises={false} help={false} />
    </main>
  );
};

export default NewArrivals;
