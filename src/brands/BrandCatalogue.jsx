import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../component/ui/Card";
import {
  ProductGridSkeleton,
  ProductDetailSkeleton,
} from "../component/ui/LoadingSkeletons";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import FilterDrawer from "../component/ui/FilterDrawer";
import ListingToolbar from "../component/ui/ListingToolbar";
import { emptyFilters, filterProducts } from "../data/listing";
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
  const {
    data: brand,
    loading: brandLoading,
    error: brandError,
  } = useAsync(() => fetchBrandBySlug(slug), [slug]);
  const { data: brandProductsData, loading: productsLoading } = useAsync(
    () => (brand ? fetchProducts({ brandId: brand.id }) : Promise.resolve([])),
    [brand],
  );
  const brandProducts = brandProductsData || [];
  const visibleProducts = filterProducts(brandProducts, appliedFilters);

  if (brandLoading) return <ProductDetailSkeleton />;
  if (brandError)
    return (
      <div className="min-h-screen px-8 py-20">Couldn't load this brand.</div>
    );
  if (!brand)
    return <div className="min-h-screen px-8 py-20">Brand not found.</div>;

  return (
    <main className="min-h-screen bg-white px-1.5 pb-20 sm:px-4 lg:px-1.5">
      <div className="relative py-16">
        <AnimatedPageTitle title={brand.name} />
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-700">
          {brand.description}
        </p>
      </div>
      <ListingToolbar
        label={brand.name.toUpperCase()}
        leftContent={
          <span className="text-sm font-semibold text-gray-500">
            {visibleProducts.length} PRODUCTS
          </span>
        }
        onFilter={() => setIsFilterOpen(true)}
        activeFilterCount={Object.values(appliedFilters).flat().length}
      />
      {productsLoading ? (
        <ProductGridSkeleton />
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
    </main>
  );
};

export default BrandCatalogue;
