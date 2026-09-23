import React from "react";
import { Link } from "react-router-dom";
import LoadingImage from "../ui/LoadingImage";

// Shown when a product carries no brand of its own — there is nothing to say
// "more from this label", so the page offers the next best thing: other
// labels worth a look. A grid of brand banners, not another product grid.
const BrandDiscoveryGrid = ({
  brands = [],
  eyebrow = "Keep exploring",
  title = "Discover other brands",
}) => {
  if (brands.length === 0) return null;

  return (
    <section className="py-12 md:py-16">
      <div className="mb-6">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-title mt-1.5">{title}</h2>
      </div>
      <div
        className={`grid grid-cols-2 gap-2 md:gap-4 ${
          brands.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        {brands.map((brand) => (
          <Link key={brand.id} to={`/brands/${brand.id}`} className="group relative block">
            <div className="relative aspect-4/5 overflow-hidden bg-[var(--surface-muted)]">
              <LoadingImage
                src={brand.logo}
                alt={brand.name}
                width={600}
                className="h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                wrapperClassName="h-full w-full"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="text-sm font-semibold uppercase tracking-[0.1em] text-white">
                  {brand.name}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default BrandDiscoveryGrid;
