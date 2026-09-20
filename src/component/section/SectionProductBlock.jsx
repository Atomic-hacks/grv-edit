import React from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { getProductImages } from "../../lib/productHelpers";
import Card from "../ui/Card";

const SectionProductBlock = ({ section, standalone = false }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  return (
    <section className="px-1.5 py-16 md:py-24">
      <div className="mb-8 max-w-2xl md:mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
          Curated section
        </p>
        <h1 className="mt-2 text-3xl font-semibold md:text-5xl">
          {section.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600 md:text-lg">
          {section.description}
        </p>
      </div>
      {section.products.length === 0 ? (
        <p className="py-12 text-sm text-gray-500">
          No products in this section yet.
        </p>
      ) : (
        <div className="product-grid">
          {section.products.map((product) => {
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
      )}
      {!standalone && (
        <button
          type="button"
          onClick={() => navigate(`/sections/${section.slug}`)}
          className="mt-8 border-b border-black pb-1 text-sm font-semibold uppercase tracking-[0.12em]"
        >
          View section
        </button>
      )}
    </section>
  );
};

export default SectionProductBlock;
