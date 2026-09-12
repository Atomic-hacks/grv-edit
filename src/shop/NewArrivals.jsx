import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import FilterDrawer from "../component/ui/FilterDrawer";
import ListingToolbar from "../component/ui/ListingToolbar";
import { emptyFilters, filterProducts } from "../data/listing";
import { formatPrice, getProductImages } from "../lib/productHelpers";
import { fetchProducts } from "../lib/apiClient";
import { useAsync } from "../lib/useAsync";
import { useCart } from "../context/CartContext";

const NewArrivals = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const {
    data: products,
    loading,
    error,
  } = useAsync(() => fetchProducts({}), []);
  const baseProducts = (products || []).filter((product) => product.isNew);
  const arrivals = filterProducts(baseProducts, appliedFilters);

  return (
    <main className="min-h-screen bg-white px-1.5 pb-20">
      <div className="px-4 py-16 md:px-12">
        <AnimatedPageTitle title="New Arrivals" />
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-700">
          The latest pieces, selected as they arrive.
        </p>
      </div>
      <ListingToolbar
        label="NEW ARRIVALS"
        leftContent={
          <span className="text-sm font-semibold text-gray-500">LATEST</span>
        }
        onFilter={() => setIsFilterOpen(true)}
        activeFilterCount={Object.values(appliedFilters).flat().length}
      />
      {error && (
        <p className="px-4 text-sm text-red-600 md:px-12">
          Couldn't load new arrivals.
        </p>
      )}
      {loading ? (
        <ProductGridSkeleton />
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
    </main>
  );
};

export default NewArrivals;
