import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import RevealImage from "../ui/RevealImage";
import CtaButton from "../ui/CtaButton";
import SmartLink from "../ui/SmartLink";
import { getOptimizedImageUrl, getOptimizedVideoUrl, getVideoPosterUrl } from "../../lib/imageHelpers";
import ProductRail from "../section/ProductRail";
import { useCart } from "../../context/CartContext";

// Renders admin-managed page sections (ContentSection rows). Each layout's
// markup is lifted from the hand-built Shop / Departments / Home sections it
// replaces, so moving a page onto this system doesn't change how it looks.

const SECTION = "py-12 md:py-20";

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const update = () => setReduced(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
};

// Image or video, whichever the admin chose. A video paints a poster
// immediately (the admin's still, or the video's own first frame) while the
// file buffers. Visitors who've asked their OS for reduced motion get the
// admin's still instead of motion, when there is one.
export const SectionMedia = ({ section, className = "", eager = false, revealDuration }) => {
  const reducedMotion = usePrefersReducedMotion();
  const isVideo = section.mediaType === "VIDEO" && Boolean(section.videoUrl);

  if (isVideo && !(reducedMotion && section.imageUrl)) {
    const src = getOptimizedVideoUrl(section.videoUrl);
    // The derived first-frame poster already carries its own transformation,
    // so it's used as-is; an admin-supplied still gets the usual resize.
    const poster = section.imageUrl
      ? getOptimizedImageUrl(section.imageUrl, 1280)
      : getVideoPosterUrl(section.videoUrl) || undefined;
    return (
      <video
        key={src}
        src={src}
        poster={poster}
        autoPlay={!reducedMotion}
        loop
        muted
        playsInline
        preload={eager ? "auto" : "metadata"}
        className={`object-cover ${className}`}
      />
    );
  }
  if (!section.imageUrl) return null;
  return (
    <RevealImage
      src={section.imageUrl}
      alt={section.title}
      loading={eager ? "eager" : "lazy"}
      priority={eager}
      width={eager ? 1600 : undefined}
      className={className}
      revealDuration={revealDuration}
    />
  );
};

const SectionHeader = ({ section }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-10">
    <div className="min-w-0 max-w-2xl">
      {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
      <h2 className={`section-title ${section.eyebrow ? "mt-1.5" : ""}`}>{section.title}</h2>
      {section.description && <p className="body-text mt-2 text-sm">{section.description}</p>}
    </div>
    {section.ctaUrl && <CtaButton to={section.ctaUrl} title={section.ctaLabel} />}
  </div>
);

const HeroSection = ({ section }) => (
  <section className="relative h-screen w-full overflow-hidden bg-[#161616]">
    <SectionMedia
      section={section}
      eager
      revealDuration={2.4}
      className="absolute inset-0 z-0 h-full w-full"
    />
    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-transparent" />
    <div className="relative z-20 mx-auto flex h-full max-w-3xl flex-col justify-end px-6 pb-16 text-center text-white md:px-14 md:pb-24 lg:px-16">
      {section.eyebrow && (
        <Motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/80"
        >
          {section.eyebrow}
        </Motion.p>
      )}
      <Motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.75 }}
        className="mx-auto"
      >
        {section.ctaUrl ? (
          <CtaButton to={section.ctaUrl} title={section.title} bare className="text-5xl text-white md:text-7xl" />
        ) : (
          <h1 className="text-5xl font-semibold text-white md:text-7xl">{section.title}</h1>
        )}
      </Motion.div>
      {section.description && (
        <Motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="mx-auto mt-6 max-w-md text-lg leading-relaxed tracking-wide text-white/90"
        >
          {section.description}
        </Motion.p>
      )}
      {section.ctaUrl && (
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.05 }}
          className="mx-auto"
        >
          <CtaButton to={section.ctaUrl} title={section.ctaLabel} variant="light" className="mt-10" />
        </Motion.div>
      )}
    </div>
  </section>
);

const BannerSection = ({ section }) => {
  const content = (
    <>
      <SectionMedia
        section={section}
        className="absolute inset-0 h-full w-full transition-opacity group-hover:opacity-90"
      />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 text-white md:p-12">
        {section.eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">{section.eyebrow}</p>
        )}
        <h2 className="mt-3 max-w-md text-2xl font-semibold md:text-5xl">{section.title}</h2>
        {section.description && (
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85 md:mt-4">{section.description}</p>
        )}
        {section.ctaUrl && (
          <span className="mt-6 inline-flex w-fit items-center justify-center border border-white bg-transparent px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black">
            {section.ctaLabel}
          </span>
        )}
      </div>
    </>
  );
  const frame = "group relative block min-h-120 overflow-hidden bg-[#161616] md:aspect-21/9 md:min-h-0";
  return (
    <section className={SECTION}>
      {section.ctaUrl ? (
        <SmartLink to={section.ctaUrl} className={frame}>{content}</SmartLink>
      ) : (
        <div className={frame}>{content}</div>
      )}
    </section>
  );
};

const tileColumns = (count) => {
  if (count <= 2) return "md:grid-cols-2";
  if (count % 4 === 0) return "md:grid-cols-4";
  return "md:grid-cols-3";
};

const TilesSection = ({ section }) => {
  const items = section.items || [];
  const fourUp = items.length % 4 === 0;
  return (
    <section className={SECTION}>
      <SectionHeader section={section} />
      <div className={`grid grid-cols-2 gap-2 md:gap-4 ${tileColumns(items.length)}`}>
        {items.map((item) => (
          <SmartLink key={`${item.title}-${item.url}`} to={item.url} className="group relative block">
            <RevealImage
              src={item.imageUrl}
              alt={item.title}
              className={`${fourUp ? "aspect-3/4" : "aspect-4/3"} w-full transition-opacity group-hover:opacity-75`}
              revealDuration={0.8}
              width={600}
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <span className="text-center text-sm font-semibold uppercase tracking-[0.12em] text-white md:text-base">
                {item.title}
              </span>
              <span className="inline-flex shrink-0 items-center justify-center border border-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition-colors duration-200 group-hover:bg-white group-hover:text-[var(--ink-900)]">
                Explore
              </span>
            </div>
          </SmartLink>
        ))}
      </div>
    </section>
  );
};

// Asymmetric collage; the pattern repeats if there are more than five tiles.
const BENTO_SPANS = [
  "col-span-1 md:col-span-4 md:row-span-2",
  "col-span-1 md:col-span-2 md:row-span-2",
  "col-span-1 md:col-span-2",
  "col-span-1 md:col-span-2",
  "col-span-1 md:col-span-4 md:row-span-2",
];

const BentoSection = ({ section }) => {
  const navigate = useNavigate();
  const go = (url) => {
    if (/^https?:\/\//i.test(url)) window.location.assign(url);
    else navigate(url);
  };
  return (
    <section className={SECTION}>
      <SectionHeader section={section} />
      <div
        className="grid auto-rows-[260px] grid-cols-1 gap-2 md:auto-rows-[240px] md:grid-cols-4 md:gap-4"
        style={{ gridAutoFlow: "dense" }}
      >
        {(section.items || []).map((item, index) => (
          <div
            key={`${item.title}-${item.url}`}
            role="link"
            tabIndex={0}
            onClick={() => go(item.url)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                go(item.url);
              }
            }}
            className={`group relative block cursor-pointer overflow-hidden ${BENTO_SPANS[index % BENTO_SPANS.length]}`}
          >
            <RevealImage
              src={item.imageUrl}
              alt={item.title}
              className="absolute inset-0 h-full w-full transition-opacity group-hover:opacity-90"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-white md:p-8">
              <h3 className="text-lg font-semibold md:text-2xl">{item.title}</h3>
              <span className="pointer-events-none mt-2 inline-flex w-fit items-center justify-center border border-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black">
                Shop
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const ProductsSection = ({ section }) => {
  const { addToCart } = useCart();
  return (
    <ProductRail
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.description}
      products={section.products || []}
      viewAllTo={section.viewAllUrl || undefined}
      viewAllLabel={section.viewAllLabel}
      onQuickAdd={(product, images) =>
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
  );
};

const BrandsSection = ({ section }) => (
  <section className={SECTION}>
    <SectionHeader section={section} />
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4">
      {(section.brands || []).map((brand) => (
        <SmartLink key={brand.id} to={`/brands/${brand.slug || brand.id}`} className="group relative block">
          {brand.logo ? (
            <RevealImage
              src={brand.logo}
              alt={brand.name}
              className="aspect-4/3 w-full transition-opacity group-hover:opacity-75"
              revealDuration={0.9}
              width={600}
            />
          ) : (
            <div className="aspect-4/3 w-full bg-[var(--surface-muted)]" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/5 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
            <span className="text-lg font-semibold uppercase tracking-wide text-white transition-colors group-hover:text-(--color-accent-orange)">
              {brand.name}
            </span>
            <span className="shrink-0 border border-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition-colors group-hover:bg-white group-hover:text-black">
              Explore
            </span>
          </div>
        </SmartLink>
      ))}
    </div>
  </section>
);

const RENDERERS = {
  BANNER: BannerSection,
  TILES: TilesSection,
  BENTO: BentoSection,
  PRODUCTS: ProductsSection,
  BRANDS: BrandsSection,
};

// Renders every non-hero section in order, inside the page's content
// column. Heroes are full-bleed and rendered separately by each page (see
// HeroSection and pickHero in lib/useContentSections), since a page's own header sits where a hero would.
export const ContentSectionList = ({ sections }) => (
  <div className="page-shell">
    {sections
      .filter((section) => section.layout !== "HERO")
      .map((section) => {
        const Renderer = RENDERERS[section.layout];
        return Renderer ? <Renderer key={section.id} section={section} /> : null;
      })}
  </div>
);

export { HeroSection };
