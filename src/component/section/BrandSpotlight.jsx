import React from "react";
import { Link } from "react-router-dom";
import RevealImage from "../ui/RevealImage";

// One brand, one banner. Shown on a product page when there are too few
// other pieces from the brand to justify a carousel — the invitation is to
// go explore the brand's own page, not to scroll past one or two cards.
const BrandSpotlight = ({ brand, eyebrow = "From the label" }) => {
  if (!brand) return null;

  return (
    <section className="py-12 md:py-16">
      <Link
        to={`/brands/${brand.id}`}
        className="group relative block h-72 overflow-hidden sm:h-80 md:h-96"
      >
        <RevealImage
          src={brand.logo}
          alt=""
          className="absolute inset-0 h-full w-full transition-opacity group-hover:opacity-90"
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
            {eyebrow}
          </p>
          <h2 className="mt-2 max-w-md text-2xl font-semibold md:text-4xl">
            {brand.name}
          </h2>
          {brand.description && (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
              {brand.description}
            </p>
          )}
          <span className="pointer-events-none mt-5 inline-flex w-fit items-center justify-center border border-white bg-transparent px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors duration-200 group-hover:bg-white group-hover:text-[var(--ink-900)]">
            Explore {brand.name}
          </span>
        </div>
      </Link>
    </section>
  );
};

export default BrandSpotlight;
