import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Card from "../component/ui/Card";
import {
  ProductGridSkeleton,
  ProductDetailSkeleton,
} from "../component/ui/LoadingSkeletons";
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
import { fetchBrandBySlug, fetchProducts } from "../lib/apiClient";
import { useAsync } from "../lib/useAsync";
import { useCart } from "../context/CartContext";

const BrandCatalogue = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [sort, setSort] = useState("");
  const {
    data: brand,
    loading: brandLoading,
    error: brandError,
    refetch: refetchBrand,
  } = useAsync(() => fetchBrandBySlug(slug), [slug]);
  const { data: brandProductsData, loading: productsLoading } = useAsync(
    () => (brand ? fetchProducts({ brandId: brand.id }) : Promise.resolve([])),
    [brand],
  );
  const brandProducts = brandProductsData || [];
  const visibleProducts = sortProducts(
    filterProducts(brandProducts, appliedFilters),
    sort,
  );

  const chips = buildFilterChips(appliedFilters, (key, value) =>
    setAppliedFilters((current) => removeFilterValue(current, key, value)),
  );

  if (brandLoading) return <ProductDetailSkeleton />;
  if (brandError)
    return (
      <div className="page-shell min-h-screen">
        <ErrorState
          title="Couldn't load this brand"
          message="Something went wrong on our end. Give it another try."
          onRetry={refetchBrand}
          secondaryTo="/brands"
          secondaryLabel="All brands"
        />
      </div>
    );
  if (!brand)
    return (
      <div className="page-shell min-h-screen">
        <ErrorState
          tone="not-found"
          title="Brand not found"
          message="This label may have been renamed or is no longer stocked."
          secondaryTo="/brands"
          secondaryLabel="All brands"
        />
      </div>
    );

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-24">
      <Breadcrumbs
        className="pt-4"
        items={[
          { label: "Home", to: "/" },
          { label: "Brands", to: "/brands" },
          { label: brand.name },
        ]}
      />
      <div className="relative pb-8 pt-6 md:pb-10 md:pt-8">
        <AnimatedPageTitle title={brand.name} subtitle={brand.description} />
      </div>
      <ListingToolbar
        sort={sort}
        onSortChange={setSort}
        onClearFilters={() => setAppliedFilters(emptyFilters())}
        leftContent={
          <span className="meta-text">
            {visibleProducts.length}{" "}
            {visibleProducts.length === 1 ? "product" : "products"}
          </span>
        }
        onFilter={() => setIsFilterOpen(true)}
        activeFilterCount={Object.values(appliedFilters).flat().length}
        chips={chips}
      />
      {productsLoading ? (
        <ProductGridSkeleton />
      ) : visibleProducts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="section-title">No products match these filters</p>
          <p className="meta-text max-w-sm">
            Try removing a filter to see everything from {brand.name}.
          </p>
        </div>
      ) : (
        <div className="product-grid">
          {visibleProducts.map((item) => {
            const images = getProductImages(item);
            return (
              <div
                key={item.id}
                className="relative group"
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
                  badge={item.isNew ? "NEW" : undefined}
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
        products={brandProducts}
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

export default BrandCatalogue;
