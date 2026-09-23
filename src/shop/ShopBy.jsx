import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import ErrorState from "../component/ui/ErrorState";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import { formatPrice, getProductImages } from "../lib/productHelpers";
import { fetchProducts } from "../lib/apiClient";
import { useCart } from "../context/CartContext";

const ShopBy = () => {
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: () =>
      fetch("/api/tags").then((response) => {
        if (!response.ok) throw new Error("Unable to load tags");
        return response.json();
      }),
  });
  const filterTypesQuery = useQuery({
    queryKey: ["filter-types"],
    queryFn: () =>
      fetch("/api/filter-types").then((response) => {
        if (!response.ok) throw new Error("Unable to load filter types");
        return response.json();
      }),
  });
  const productsQuery = useQuery({
    queryKey: ["products", { pageSize: 100 }],
    queryFn: () => fetchProducts({ pageSize: 100 }),
  });
  const tags = tagsQuery.data || [];
  const filterTypes = filterTypesQuery.data || [];
  const products = productsQuery.data || [];
  const loading =
    tagsQuery.isPending ||
    filterTypesQuery.isPending ||
    productsQuery.isPending;
  const error =
    tagsQuery.error || filterTypesQuery.error || productsQuery.error;
  const retryAll = () => {
    tagsQuery.refetch();
    filterTypesQuery.refetch();
    productsQuery.refetch();
  };
  const isRetrying =
    tagsQuery.isRefetching ||
    filterTypesQuery.isRefetching ||
    productsQuery.isRefetching;

  const tagsByType = useMemo(
    () =>
      filterTypes.reduce(
        (groups, type) => ({
          ...groups,
          [type.slug]: tags.filter((tag) => tag.filterType?.slug === type.slug),
        }),
        {},
      ),
    [filterTypes, tags],
  );

  const visibleProducts = useMemo(() => {
    if (selectedTagIds.length === 0) return products;
    return products.filter((product) =>
      selectedTagIds.every((tagId) =>
        product.tags?.some((tag) => tag.id === tagId),
      ),
    );
  }, [products, selectedTagIds]);

  const toggleTag = (tagId) => {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-24">
      <Breadcrumbs
        className="pt-4"
        items={[{ label: "Home", to: "/" }, { label: "Shop by" }]}
      />
      <header className="pt-6 md:pt-8">
        <p className="eyebrow">Curated discovery</p>
        <h1 className="display-title mt-2">Shop by</h1>
        <p className="body-text mt-4">
          Find pieces that meet every part of the brief.
        </p>
      </header>

      <section className="mt-10 grid gap-8 border-y border-[var(--line)] py-8 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
        {filterTypes.map((type) => (
          <fieldset key={type.slug}>
            <legend className="eyebrow">{type.label}</legend>
            <div className="mt-3 space-y-0.5">
              {tagsByType[type.slug]?.map((tag) => (
                <label
                  key={tag.id}
                  className="flex min-h-10 cursor-pointer items-center gap-2.5 text-[13px] text-[var(--ink-700)] transition-colors hover:text-[var(--ink-900)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="h-4 w-4 shrink-0 accent-(--color-accent-orange)"
                  />
                  <span className="min-w-0 truncate">{tag.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 py-6">
        <h2 className="meta-text">
          {selectedTagIds.length
            ? `${visibleProducts.length} matching ${
                visibleProducts.length === 1 ? "product" : "products"
              }`
            : `${visibleProducts.length} products`}
        </h2>
        {selectedTagIds.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedTagIds([])}
            className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <ErrorState
          title="Couldn't load this page"
          message={error.message || "Something went wrong loading products and filters."}
          onRetry={retryAll}
          retryPending={isRetrying}
        />
      ) : visibleProducts.length ? (
        <div className="product-grid">
          {visibleProducts.map((product) => {
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
                  details={product.gender}
                  badge={product.isNew ? "NEW" : undefined}
                  price={formatPrice(product.basePrice)}
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
          <p className="section-title">No products match every selected tag</p>
          <p className="meta-text max-w-sm">
            Clearing one or two tags usually widens the results.
          </p>
        </div>
      )}
      <RecentlyViewedRail />
      </div>
      <StoreSupport promises={false} help={false} />
    </main>
  );
};

export default ShopBy;
