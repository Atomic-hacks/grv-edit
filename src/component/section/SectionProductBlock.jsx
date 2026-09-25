import React from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { getProductImages } from "../../lib/productHelpers";
import Card from "../ui/Card";
import ProductRail from "./ProductRail";

const SectionProductBlock = ({ section, standalone = false }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const addProductToCart = (product, images) =>
    addToCart(
      {
        ...product,
        price: product.basePrice,
        image: images[0],
        hoverImage: images[1] || images[0],
      },
      1,
    );

  // A homepage teaser scrolls horizontally, exactly like every other
  // recommendation rail on the storefront (equal-height cards, one row,
  // "View section" leading to the real thing). The dedicated section page —
  // what that link leads to — is an actual browsing destination, so it stays
  // a full grid instead.
  if (!standalone) {
    return (
      <div className="page-shell">
        <ProductRail
          eyebrow="Curated section"
          title={section.name}
          description={section.description}
          products={section.products}
          viewAllTo={`/sections/${section.slug}`}
          viewAllLabel="View section"
          onQuickAdd={addProductToCart}
        />
      </div>
    );
  }

  return (
    <section className="page-shell py-16 md:py-20">
      <div className="mb-6 max-w-2xl md:mb-8">
        <p className="eyebrow">Curated section</p>
        <h2 className="section-title mt-1.5">{section.name}</h2>
        {section.description && (
          <p className="body-text mt-2 text-sm">{section.description}</p>
        )}
      </div>
      {section.products.length === 0 ? (
        <p className="py-12 text-sm text-[var(--ink-500)]">
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
                  badge={product.isNew ? "NEW" : undefined}
                  onQuickAdd={() => addProductToCart(product, images)}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SectionProductBlock;
