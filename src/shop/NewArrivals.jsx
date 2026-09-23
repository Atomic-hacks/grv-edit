import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import FilterDrawer from "../component/ui/FilterDrawer";
import ListingToolbar from "../component/ui/ListingToolbar";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import ErrorState from "../component/ui/ErrorState";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import {
  buildFilterChips,
  emptyFilters,
  filterProducts,
  removeFilterValue,
  sortProducts,
} from "../data/listing";
import { formatPrice, getProductImages } from "../lib/productHelpers";
import DiscountPrice from "../component/ui/DiscountPrice";
import { fetchNewArrivals } from "../lib/apiClient";
import { useAsync } from "../lib/useAsync";
import { useCart } from "../context/CartContext";

const NewArrivals = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [sort, setSort] = useState("");
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const {
    data: products,
    loading,
    error,
    refetch,
  } = useAsync(() => fetchNewArrivals(), []);
  const baseProducts = products || [];
  const arrivals = sortProducts(
    filterProducts(baseProducts, appliedFilters),
    sort,
  );

  const chips = buildFilterChips(appliedFilters, (key, value) =>
    setAppliedFilters((current) => removeFilterValue(current, key, value)),
  );

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-24">
      <Breadcrumbs
        className="pt-4"
        items={[{ label: "Home", to: "/" }, { label: "New arrivals" }]}
      />
      <div className="pb-8 pt-6 md:pb-10 md:pt-8">
        <AnimatedPageTitle
          title="New Arrivals"
          subtitle="The latest pieces, selected as they arrive."
        />
      </div>
      <ListingToolbar
        sort={sort}
        onSortChange={setSort}
        onClearFilters={() => setAppliedFilters(emptyFilters())}
        leftContent={
          <span className="meta-text">
            {arrivals.length} {arrivals.length === 1 ? "product" : "products"}
          </span>
        }
        onFilter={() => setIsFilterOpen(true)}
        activeFilterCount={Object.values(appliedFilters).flat().length}
        chips={chips}
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
          <p className="meta-text max-w-sm">
            Try removing a filter to see the rest of the new arrivals.
          </p>
        </div>
      ) : (
        <div className="product-grid">
          {arrivals.map((item) => {
            const images = getProductImages(item);
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/product/${item.id}`)}
              >
                <Card
                  img={images[0]}
                  hoverImg={images[1] || images[0]}
                  alt={item.name}
                  title={item.name}
                  product={item}
                  category={item.subcategory}
                  details={item.gender}
                  badge="NEW"
                  price={formatPrice(item.basePrice)}
                  onQuickAdd={() =>
                    addToCart(
                      {
                        ...item,
                        price: item.basePrice,
                        image: images[0],
                        hoverImage: images[1] || images[0],
                      },
                      1,
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      )}
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        products={baseProducts}
        appliedFilters={appliedFilters}
        onApply={(filters) => {
          setAppliedFilters(filters);
          setIsFilterOpen(false);
        }}
      />
      <RecentlyViewedRail />
      </div>
      <StoreSupport promises={false} help={false} />
    </main>
  );
};

export default NewArrivals;
