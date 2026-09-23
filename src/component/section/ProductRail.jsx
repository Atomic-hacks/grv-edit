import React from "react";
import { Link } from "react-router-dom";
import Card from "../ui/Card";
import HorizontalCarousel from "../ui/HorizontalCarousel";
import { HorizontalSkeleton } from "../ui/LoadingSkeletons";
import { getProductImages } from "../../lib/productHelpers";

// Every recommendation context on the storefront renders through this one
// component. Each rail states what it is showing and why, so a shopper can
// tell "More from Northline" from "Recently viewed" at a glance instead of
// scrolling past three identical carousels.
const ProductRail = ({
  eyebrow,
  title,
  description,
  products = [],
  loading = false,
  viewAllTo,
  viewAllLabel = "View all",
  onQuickAdd,
  className = "",
}) => {
  // A rail with nothing in it is not an empty state, it is noise. The caller
  // does not have to guard every usage.
  if (!loading && products.length === 0) return null;

  return (
    <section className={`py-12 md:py-16 ${className}`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="section-title mt-1.5">{title}</h2>
          {description && (
            <p className="body-text mt-1.5 text-[13px]">{description}</p>
          )}
        </div>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="shrink-0 border border-[var(--ink-900)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 hover:bg-[var(--ink-900)] hover:text-white"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>

      {loading ? (
        <HorizontalSkeleton />
      ) : (
        <HorizontalCarousel>
          {products.map((product) => {
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
                  details={product.gender}
                  badge={product.isNew ? "NEW" : undefined}
                  onQuickAdd={
                    onQuickAdd ? () => onQuickAdd(product, images) : undefined
                  }
                />
              </Link>
            );
          })}
        </HorizontalCarousel>
      )}
    </section>
  );
};

export default ProductRail;
