import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import FilterDrawer from "../component/ui/FilterDrawer";
import ListingToolbar from "../component/ui/ListingToolbar";
import { formatPrice, getProductImages } from "../lib/productHelpers";
import { fetchCategories, fetchProducts } from "../lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import { emptyFilters } from "../data/listing";
import { useCart } from "../context/CartContext";

const facetConfig = {
  men: { title: "Men", fixed: { gender: "men" } },
  women: { title: "Women", fixed: { gender: "women" } },
  accessories: { title: "Accessories", fixed: { categoryId: "accessories" } },
  athletics: { title: "Athletics", fixed: { categoryId: "athletics" } },
  lifestyle: { title: "Lifestyle", fixed: { styleTag: "Casual" } },
  footwear: { title: "Footwear", fixed: { categoryId: "footwear" } },
  archive: { title: "Archive", fixed: { archived: true } },
};

const GenderCatalogue = ({ facet }) => {
  const config = facetConfig[facet];
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const categoryId = searchParams.get("category") || "";
  const subcategory = searchParams.get("subcategory") || "";
  const styleTag = searchParams.get("style") || "";
  const gender = searchParams.get("gender") || "";
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories(),
  });
  const { data: baseProductsData, isPending: baseLoading } = useQuery({
    queryKey: ["products", config.fixed],
    queryFn: () => fetchProducts(config.fixed),
  });
  const baseProducts = useMemo(
    () => baseProductsData || [],
    [baseProductsData],
  );
  const effectiveCategoryId = config.fixed.categoryId || categoryId;
  const effectiveGender = config.fixed.gender || gender;
  const effectiveStyleTag = config.fixed.styleTag || styleTag;
  const visibleProductFilters = {
    ...config.fixed,
    categoryId: effectiveCategoryId || undefined,
    subcategory: subcategory || undefined,
    styleTag: effectiveStyleTag || undefined,
    gender: effectiveGender || undefined,
  };
  const {
    data: visibleProductsData,
    isPending: visibleLoading,
    error: visibleError,
  } = useQuery({
    queryKey: ["products", visibleProductFilters],
    queryFn: () => fetchProducts(visibleProductFilters),
  });
  const visibleProducts = visibleProductsData || [];
  const category = (categories || []).find(
    (item) => item.id === effectiveCategoryId,
  );
  const activeLabel = styleTag || subcategory || category?.name || "VIEW ALL";

  useEffect(() => {
    setAppliedFilters({
      ...emptyFilters(),
      ...(config.fixed.gender ? { gender: [config.fixed.gender] } : {}),
      ...(config.fixed.categoryId
        ? { categoryId: [config.fixed.categoryId] }
        : {}),
      ...(effectiveCategoryId ? { categoryId: [effectiveCategoryId] } : {}),
      ...(subcategory ? { subcategory: [subcategory] } : {}),
      ...(styleTag ? { styleTags: [styleTag] } : {}),
      ...(config.fixed.styleTag ? { styleTags: [config.fixed.styleTag] } : {}),
      ...(effectiveGender ? { gender: [effectiveGender] } : {}),
    });
  }, [
    config.fixed,
    effectiveCategoryId,
    effectiveGender,
    gender,
    styleTag,
    subcategory,
  ]);

  const facetOptions = useMemo(() => {
    const options = [
      {
        id: "all",
        label: "VIEW ALL",
        params: {},
        active: !categoryId && !subcategory && !styleTag && !gender,
      },
    ];
    if (facet === "men" || facet === "women") {
      (categories || []).forEach((item) => {
        options.push({
          id: item.id,
          label: item.name,
          params: { category: item.id },
          active: categoryId === item.id && !subcategory && !styleTag,
        });
        const subcategories = [
          ...new Set(
            baseProducts
              .filter((product) => product.categoryId === item.id)
              .map((product) => product.subcategory),
          ),
        ];
        subcategories.forEach((value) =>
          options.push({
            id: `${item.id}-${value}`,
            label: `  ${value}`,
            params: { category: item.id, subcategory: value.toLowerCase() },
            active:
              categoryId === item.id &&
              subcategory.toLowerCase() === value.toLowerCase(),
          }),
        );
      });
    } else {
      const genders = [
        ...new Set(
          baseProducts
            .map((product) => product.gender)
            .filter((value) => value !== "unisex"),
        ),
      ];
      genders.forEach((value) =>
        options.push({
          id: value,
          label: value.toUpperCase(),
          params: { gender: value },
          active: gender === value,
        }),
      );
      [...new Set(baseProducts.map((product) => product.subcategory))].forEach(
        (value) =>
          options.push({
            id: value,
            label: value,
            params: { subcategory: value.toLowerCase() },
            active: subcategory.toLowerCase() === value.toLowerCase(),
          }),
      );
    }
    return options;
  }, [
    baseProducts,
    categoryId,
    categories,
    facet,
    gender,
    styleTag,
    subcategory,
  ]);

  const handleFacetSelect = (option) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      Object.entries(option.params).forEach(([key, value]) => {
        nextParams.set(key, value);
      });
      return nextParams;
    });
    setIsFilterOpen(false);
  };

  const applyFilters = (filters) => {
    const params = {};
    if (filters.categoryId.length === 1 && !config.fixed.categoryId)
      params.category = filters.categoryId[0];
    if (filters.subcategory.length === 1)
      params.subcategory = filters.subcategory[0].toLowerCase();
    if (filters.styleTags.length === 1)
      params.style = filters.styleTags[0].toLowerCase();
    if (filters.gender.length === 1 && !config.fixed.gender)
      params.gender = filters.gender[0];
    setSearchParams(params);
    setIsFilterOpen(false);
  };

  if (!config) return null;

  return (
    <main className="min-h-screen max-w-360 mx-auto bg-white px-1.5 pb-20 sm:px-4 lg:px-1.5">
      <div className="relative py-16">
        <AnimatedPageTitle title={config.title} />
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-700">
          Explore the complete {config.title.toLowerCase()} catalogue.
        </p>
      </div>
      <ListingToolbar
        label={activeLabel.toUpperCase()}
        onViewAll={() => setIsFilterOpen(true)}
        leftContent={
          <span className="text-sm font-semibold text-gray-500">
            {visibleProducts.length} PRODUCTS
          </span>
        }
        onFilter={() => setIsFilterOpen(true)}
        activeFilterCount={
          Object.values(appliedFilters).flat().filter(Boolean).length
        }
      />
      {visibleLoading || baseLoading ? (
        <ProductGridSkeleton />
      ) : visibleError ? (
        <p className="py-16 text-sm text-red-600">Couldn't load products.</p>
      ) : visibleProducts.length ? (
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
      ) : (
        <p className="py-16 text-sm text-gray-600">
          No products match these filters.
        </p>
      )}
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        products={baseProducts}
        appliedFilters={appliedFilters}
        activeCategoryId={effectiveCategoryId}
        categories={categories || []}
        facetOptions={facetOptions}
        onFacetSelect={handleFacetSelect}
        onApply={applyFilters}
      />
    </main>
  );
};

export default GenderCatalogue;
