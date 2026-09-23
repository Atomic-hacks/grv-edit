import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import FilterDrawer from "../component/ui/FilterDrawer";
import ListingToolbar from "../component/ui/ListingToolbar";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import ErrorState from "../component/ui/ErrorState";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import { formatPrice, getProductImages } from "../lib/productHelpers";
import {
  fetchCategories,
  fetchProducts,
  fetchProductPage,
} from "../lib/apiClient";
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
  // Read every value for each key: the drawer allows multi-select, so
  // "?subcategory=tops&subcategory=shorts" has to survive a round trip.
  const categoryIds = searchParams.getAll("category");
  const subcategories = searchParams.getAll("subcategory");
  const styleTags = searchParams.getAll("style");
  const genders = searchParams.getAll("gender");
  const brandIds = searchParams.getAll("brand");
  const sort = searchParams.get("sort") || "";
  // Single-value views (breadcrumbs, labels, facet highlighting) still want
  // the first value.
  const categoryId = categoryIds[0] || "";
  const subcategory = subcategories[0] || "";
  const styleTag = styleTags[0] || "";
  const gender = genders[0] || "";
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
  const orEmpty = (fixed, values) => (fixed ? [fixed] : values);
  // Joined keys so the memo compares by value, not by array identity.
  const categoryKey = categoryIds.join(",");
  const subcategoryKey = subcategories.join(",");
  const styleKey = styleTags.join(",");
  const genderKey = genders.join(",");
  const brandKey = brandIds.join(",");
  const visibleProductFilters = useMemo(
    () => ({
      ...config.fixed,
      categoryId: orEmpty(config.fixed.categoryId, categoryKey ? categoryKey.split(",") : []),
      subcategory: subcategoryKey ? subcategoryKey.split(",") : [],
      styleTag: orEmpty(config.fixed.styleTag, styleKey ? styleKey.split(",") : []),
      gender: orEmpty(config.fixed.gender, genderKey ? genderKey.split(",") : []),
      brandId: brandKey ? brandKey.split(",") : [],
      sort: sort || undefined,
    }),
    [
      config.fixed,
      categoryKey,
      subcategoryKey,
      styleKey,
      genderKey,
      brandKey,
      sort,
    ],
  );
  const {
    data: visibleProductsData,
    isPending: visibleLoading,
    error: visibleError,
    refetch: refetchVisibleProducts,
    isRefetching: isRetryingProducts,
  } = useQuery({
    queryKey: ["products", visibleProductFilters],
    queryFn: () => fetchProductPage(visibleProductFilters),
  });
  const visibleProducts = visibleProductsData?.items || [];
  // Server-side total, not the length of this page of results.
  const totalProducts = visibleProductsData?.total ?? 0;
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

  // Every selected value is written to the URL. Previously only
  // single-selections were applied, so checking two subcategories silently
  // dropped the filter entirely while the drawer still previewed a count
  // for it.
  const applyFilters = (filters) => {
    const params = new URLSearchParams();
    const appendAll = (key, values, lowercase = false) => {
      (values || []).forEach((value) =>
        params.append(key, lowercase ? String(value).toLowerCase() : value),
      );
    };
    if (!config.fixed.categoryId) appendAll("category", filters.categoryId);
    appendAll("subcategory", filters.subcategory, true);
    if (!config.fixed.styleTag) appendAll("style", filters.styleTags, true);
    if (!config.fixed.gender) appendAll("gender", filters.gender);
    appendAll("brand", filters.brandId);
    if (sort) params.set("sort", sort);
    setSearchParams(params);
    setIsFilterOpen(false);
  };

  const applySort = (nextSort) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      if (nextSort) nextParams.set("sort", nextSort);
      else nextParams.delete("sort");
      return nextParams;
    });
  };

  const clearFilters = () => {
    setSearchParams(sort ? { sort } : {});
  };

  // Chips mirror the URL exactly, so what a shopper sees listed is what the
  // grid is filtered by. Values the facet itself fixes (e.g. gender on /men)
  // are not shown: they are the page, not a filter you can drop.
  const removeParam = (key, value) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      const kept = nextParams.getAll(key).filter((item) => item !== value);
      nextParams.delete(key);
      kept.forEach((item) => nextParams.append(key, item));
      return nextParams;
    });
  };
  const chipLabel = (key, value) => {
    if (key === "category")
      return (categories || []).find((item) => item.id === value)?.name || value;
    if (key === "brand")
      return (
        baseProducts.find((item) => item.brandId === value)?.brandName || value
      );
    return String(value).replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
  };
  const chips = [
    ...(config.fixed.categoryId ? [] : categoryIds.map((v) => ["category", v])),
    ...subcategories.map((v) => ["subcategory", v]),
    ...(config.fixed.styleTag ? [] : styleTags.map((v) => ["style", v])),
    ...(config.fixed.gender ? [] : genders.map((v) => ["gender", v])),
    ...brandIds.map((v) => ["brand", v]),
  ].map(([key, value]) => ({
    id: `${key}:${value}`,
    label: chipLabel(key, value),
    onRemove: () => removeParam(key, value),
  }));

  // Count what is actually applied in the URL, so the badge can never
  // disagree with the products on screen.
  const activeFilterCount =
    (config.fixed.categoryId ? 0 : categoryIds.length) +
    subcategories.length +
    (config.fixed.styleTag ? 0 : styleTags.length) +
    (config.fixed.gender ? 0 : genders.length) +
    brandIds.length;

  if (!config) return null;

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-24">
      <Breadcrumbs
        className="pt-4"
        items={[
          { label: "Home", to: "/" },
          { label: config.title, to: `/${facet}` },
          ...(category ? [{ label: category.name }] : []),
          ...(subcategory ? [{ label: subcategory }] : []),
        ]}
      />
      <div className="relative pb-8 pt-6 md:pb-10 md:pt-8">
        <AnimatedPageTitle
          title={config.title}
          subtitle={`Explore the complete ${config.title.toLowerCase()} catalogue.`}
        />
      </div>
      <ListingToolbar
        label={activeLabel.toUpperCase()}
        onViewAll={() => setIsFilterOpen(true)}
        leftContent={
          <span className="text-sm font-semibold text-gray-500">
            {totalProducts} {totalProducts === 1 ? "PRODUCT" : "PRODUCTS"}
          </span>
        }
        onFilter={() => setIsFilterOpen(true)}
        sort={sort}
        onSortChange={applySort}
        onClearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
        chips={chips}
      />
      {visibleLoading || baseLoading ? (
        <ProductGridSkeleton />
      ) : visibleError ? (
        <ErrorState
          title="Couldn't load these products"
          message="Something went wrong fetching this page. Your filters are still applied — retrying picks up right here."
          onRetry={refetchVisibleProducts}
          retryPending={isRetryingProducts}
        />
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
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="section-title">No products match these filters</p>
          <p className="meta-text max-w-sm">
            Try removing a filter, or browse the full {config.title.toLowerCase()}{" "}
            catalogue.
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
            >
              Clear all filters
            </button>
          )}
        </div>
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
      <RecentlyViewedRail />
      </div>
      <StoreSupport promises={false} help={false} />
    </main>
  );
};

export default GenderCatalogue;
