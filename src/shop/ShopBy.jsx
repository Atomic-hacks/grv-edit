import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import ErrorState from "../component/ui/ErrorState";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import { getProductImages } from "../lib/productHelpers";
import { fetchProducts } from "../lib/apiClient";
import { useSiteImages } from "../lib/useSiteImages";
import { useCart } from "../context/CartContext";

// A muted tint per theme, used when no editorial photo has been set for it
// yet (Site Images admin, key "shopby-<slug>") — never a broken image.
const FALLBACK_TINTS = ["#e8e3dc", "#ddE3e0", "#e3dde3", "#e0e3dd", "#e3e0dd"];

const ThemeCard = ({ filterType, tags, image, tint, activeTag, onSelectTag }) => (
  <div className="relative overflow-hidden">
    <div
      className="relative aspect-4/3 w-full overflow-hidden sm:aspect-16/10"
      style={{ backgroundColor: tint }}
    >
      {image && (
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
          Shop by
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
          {filterType.name}
        </h2>
        {/* Every value is visible at once — nothing hidden behind a click
            just to see the menu. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => {
            const isActive = activeTag === tag.slug;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onSelectTag(tag)}
                className={`border px-3.5 py-2 text-[12px] font-medium transition-colors ${
                  isActive
                    ? "border-white bg-white text-[var(--ink-900)]"
                    : "border-white/70 text-white hover:border-white hover:bg-white/10"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

const ShopBy = () => {
  const { addToCart } = useCart();
  const siteImages = useSiteImages();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTagSlug = searchParams.get("tag") || "";

  const filterTypesQuery = useQuery({
    queryKey: ["filter-types"],
    queryFn: () =>
      fetch("/api/filter-types").then((response) => {
        if (!response.ok) throw new Error("Unable to load themes");
        return response.json();
      }),
  });
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: () =>
      fetch("/api/tags").then((response) => {
        if (!response.ok) throw new Error("Unable to load tags");
        return response.json();
      }),
  });
  const productsQuery = useQuery({
    queryKey: ["products", { tag: activeTagSlug }],
    queryFn: () => fetchProducts({ tag: activeTagSlug, pageSize: 60 }),
    enabled: Boolean(activeTagSlug),
  });

  const filterTypes = filterTypesQuery.data || [];
  const tags = tagsQuery.data || [];
  const activeTag = tags.find((tag) => tag.slug === activeTagSlug) || null;
  const loading = filterTypesQuery.isPending || tagsQuery.isPending;
  const error = filterTypesQuery.error || tagsQuery.error;

  const selectTag = (tag) => setSearchParams({ tag: tag.slug });
  const clearTag = () => setSearchParams({});

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-24">
        <Breadcrumbs
          className="pt-4"
          items={[
            { label: "Home", to: "/" },
            { label: "Shop by", to: activeTag ? "/shop-by" : undefined },
            ...(activeTag ? [{ label: activeTag.name }] : []),
          ]}
        />
        <header className="pt-6 md:pt-8">
          <p className="eyebrow">Curated discovery</p>
          <h1 className="display-title mt-2">Shop by</h1>
          <p className="body-text mt-4">
            Pick a mood, an occasion, the weather — find pieces that fit the brief.
          </p>
        </header>

        {loading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <ProductGridSkeleton count={4} />
          </div>
        ) : error ? (
          <ErrorState
            title="Couldn't load this page"
            message={error.message || "Something went wrong loading the themes."}
            onRetry={() => {
              filterTypesQuery.refetch();
              tagsQuery.refetch();
            }}
          />
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {filterTypes.map((filterType, index) => {
              const typeTags = tags.filter((tag) => tag.filterType?.slug === filterType.slug);
              if (typeTags.length === 0) return null;
              return (
                <ThemeCard
                  key={filterType.id}
                  filterType={filterType}
                  tags={typeTags}
                  image={siteImages[`shopby-${filterType.slug}`]}
                  tint={FALLBACK_TINTS[index % FALLBACK_TINTS.length]}
                  activeTag={activeTagSlug}
                  onSelectTag={selectTag}
                />
              );
            })}
          </div>
        )}

        {activeTag && (
          <section className="mt-16 border-t border-[var(--line)] pt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">{activeTag.filterType?.name}</p>
                <h2 className="section-title mt-1.5">{activeTag.name}</h2>
              </div>
              <button
                type="button"
                onClick={clearTag}
                className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
              >
                Browse a different theme
              </button>
            </div>

            {productsQuery.isPending ? (
              <div className="mt-8"><ProductGridSkeleton /></div>
            ) : productsQuery.error ? (
              <ErrorState
                title="Couldn't load these products"
                message="Something went wrong. Give it another try."
                onRetry={() => productsQuery.refetch()}
              />
            ) : (productsQuery.data || []).length === 0 ? (
              <p className="meta-text mt-8">No products are tagged with this yet — check back soon.</p>
            ) : (
              <div className="mt-8 product-grid">
                {(productsQuery.data || []).map((product) => {
                  const images = getProductImages(product);
                  return (
                    <Link key={product.id} to={`/product/${product.id}`}>
                      <Card
                        img={images[0]}
                        hoverImg={images[1] || images[0]}
                        alt={product.name}
                        title={product.name}
                        product={product}
                        category={product.subcategory}
                        badge={product.isNew ? "NEW" : undefined}
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
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <RecentlyViewedRail />
      </div>
      <StoreSupport promises={false} help={false} />
    </main>
  );
};

export default ShopBy;
