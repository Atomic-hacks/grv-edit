import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
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
    <main className="min-h-screen bg-white px-4 pb-20 pt-12 md:px-16 md:pt-20">
      <header className="border-b border-black pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
          Curated discovery
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
          Shop by
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">
          Find pieces that meet every part of the brief.
        </p>
      </header>

      <section className="grid gap-8 border-b border-gray-200 py-8 md:grid-cols-4 md:gap-6">
        {filterTypes.map((type) => (
          <fieldset key={type.slug}>
            <legend className="text-sm font-semibold uppercase tracking-[0.16em]">
              {type.label}
            </legend>
            <div className="mt-4 space-y-3">
              {tagsByType[type.slug]?.map((tag) => (
                <label
                  key={tag.id}
                  className="flex cursor-pointer items-center gap-3 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="h-4 w-4 accent-black"
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </section>

      <div className="flex items-center justify-between py-8">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">
          {selectedTagIds.length
            ? `${visibleProducts.length} matching products`
            : "All products"}
        </h2>
        {selectedTagIds.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedTagIds([])}
            className="border-b border-black text-sm font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <p className="py-16 text-sm text-red-600">{error}</p>
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
        <p className="py-16 text-sm text-gray-600">
          No products match every selected tag.
        </p>
      )}
    </main>
  );
};

export default ShopBy;
