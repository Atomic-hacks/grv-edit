import React, { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import FilterDrawer from "../component/ui/FilterDrawer";
import BrowseDrawer from "../component/ui/BrowseDrawer";
import ListingToolbar from "../component/ui/ListingToolbar";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import ErrorState from "../component/ui/ErrorState";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import { getProductImages } from "../lib/productHelpers";
import { fetchCategories, fetchProductPage, fetchProductFilters } from "../lib/apiClient";
import { resolveCategoryPath } from "../lib/categoryTree";
import { useCart } from "../context/CartContext";


// One page for every category the site has, at any depth — "Jewelry"
// nested under Accessories under Men gets this page and a working URL the
// moment the category exists, with no route to add by hand. The backend
// expands a category's slug to include its descendants, so this page only
// ever passes the one slug it's actually showing.
const CategoryPage = () => {
  const { categorySlug, "*": restPath } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const categories = categoriesQuery.data || [];
  const segments = [categorySlug, ...(restPath ? restPath.split("/").filter(Boolean) : [])];
  const categoryPath = categoriesQuery.isPending ? null : resolveCategoryPath(categories, segments);
  const activeCategory = categoryPath?.[categoryPath.length - 1] || null;

  const filters = {
    brand: searchParams.getAll("brand"),
    size: searchParams.getAll("size"),
    color: searchParams.getAll("color"),
    style: searchParams.getAll("style"),
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
  };
  const sort = searchParams.get("sort") || "";
  const activeFilterCount =
    filters.brand.length +
    filters.size.length +
    filters.color.length +
    filters.style.length +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0);

  const queryParams = {
    category: activeCategory?.slug,
    brandId: filters.brand,
    size: filters.size,
    color: filters.color,
    styleTag: filters.style,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sort,
    pageSize: 60,
  };

  const productsQuery = useQuery({
    queryKey: ["products", queryParams],
    queryFn: () => fetchProductPage(queryParams),
    enabled: Boolean(activeCategory),
  });
  const facetsQuery = useQuery({
    queryKey: ["product-filters", queryParams],
    queryFn: () => fetchProductFilters(queryParams),
    enabled: Boolean(activeCategory),
  });

  const products = productsQuery.data?.items || [];
  const total = productsQuery.data?.total ?? 0;

  const applyFilters = (next) => {
    const params = new URLSearchParams();
    next.brand.forEach((v) => params.append("brand", v));
    next.size.forEach((v) => params.append("size", v));
    next.color.forEach((v) => params.append("color", v));
    next.style.forEach((v) => params.append("style", v));
    if (next.minPrice) params.set("minPrice", next.minPrice);
    if (next.maxPrice) params.set("maxPrice", next.maxPrice);
    if (sort) params.set("sort", sort);
    setSearchParams(params);
    setIsFilterOpen(false);
  };

  const clearFilters = () => setSearchParams(sort ? { sort } : {});

  const setSort = (nextSort) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextSort) next.set("sort", nextSort);
      else next.delete("sort");
      return next;
    });
  };

  if (categoriesQuery.isPending) {
    return (
      <main className="page-shell min-h-screen pb-24">
        <ProductGridSkeleton />
      </main>
    );
  }

  if (!categoryPath) {
    return (
      <main className="page-shell min-h-screen">
        <ErrorState
          tone="not-found"
          title="We couldn't find that"
          message="This page may have moved, or the link is out of date."
          secondaryTo="/shop"
          secondaryLabel="Back to shop"
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-24">
        <Breadcrumbs
          className="pt-4"
          items={[
            { label: "Home", to: "/" },
            ...categoryPath.map((category, index) => ({
              label: category.name,
              to:
                index < categoryPath.length - 1
                  ? `/${categoryPath.slice(0, index + 1).map((c) => c.slug).join("/")}`
                  : undefined,
            })),
          ]}
        />
        <div className="relative pb-8 pt-6 md:pb-10 md:pt-8">
          <AnimatedPageTitle
            title={activeCategory.name}
            subtitle={activeCategory.description || `Explore the full ${activeCategory.name.toLowerCase()} edit.`}
          />
        </div>

        <ListingToolbar
          label="VIEW ALL"
          onViewAll={() => setIsBrowseOpen(true)}
          leftContent={
            <span className="meta-text">
              {productsQuery.isPending ? "…" : total} {total === 1 ? "product" : "products"}
            </span>
          }
          onFilter={() => setIsFilterOpen(true)}
          sort={sort}
          onSortChange={setSort}
          onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
          activeFilterCount={activeFilterCount}
        />

        {productsQuery.isPending ? (
          <ProductGridSkeleton />
        ) : productsQuery.error ? (
          <ErrorState
            title="Couldn't load these products"
            message="Something went wrong. Your filters are still applied — retrying picks up right here."
            onRetry={() => productsQuery.refetch()}
            retryPending={productsQuery.isRefetching}
          />
        ) : products.length ? (
          <div className="product-grid">
            {products.map((product) => {
              const images = getProductImages(product);
              return (
                <div
                  key={product.id}
                  className="relative group"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <Card
                    img={images[0]}
                    hoverImg={images[1] || images[0]}
                    alt={product.name}
                    title={product.name}
                    product={product}
                    category={product.subcategory}
                    badge={product.isNew ? "NEW" : product.featured ? "FEATURED" : undefined}
                    onQuickAdd={() =>
                      addToCart(
                        {
                          ...product,
                          price: product.basePrice,
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
              Try removing a filter, or browse the full {activeCategory.name.toLowerCase()} edit.
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
          appliedFilters={filters}
          onApply={applyFilters}
          facets={facetsQuery.data}
          facetsLoading={facetsQuery.isPending}
        />
        <BrowseDrawer
          isOpen={isBrowseOpen}
          onClose={() => setIsBrowseOpen(false)}
          categories={categories}
          activeCategoryId={activeCategory?.id}
          styleOptions={facetsQuery.data?.styles || []}
        />

        <RecentlyViewedRail />
      </div>
      <StoreSupport promises={false} help={false} />
    </main>
  );
};

export default CategoryPage;
