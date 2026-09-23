import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import RevealImage from "../component/ui/RevealImage";
import { HorizontalSkeleton } from "../component/ui/LoadingSkeletons";
import CtaButton from "../component/ui/CtaButton";
import HorizontalCarousel from "../component/ui/HorizontalCarousel";
import { getProductImages } from "../lib/productHelpers";
import { fetchNewArrivals } from "../lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import Card from "../component/ui/Card";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import { useSiteImages } from "../lib/useSiteImages";

// Single spacing scale reused by every section on this page.
const SECTION = "py-16 md:py-24";
const SECTION_HEAD = "mb-6 md:mb-10";

const departments = [
  {
    name: "Men",
    key: "department-men",
    image: "/img/maleheromodel.jpg",
    path: "/men",
  },
  {
    name: "Women",
    key: "department-women",
    image: "/img/femaletop.jpg",
    path: "/women",
  },
  {
    name: "Accessories",
    key: "department-accessories",
    image: "/img/bag1.jpg",
    path: "/accessories",
  },
  {
    name: "Brands",
    key: "department-brands",
    image: "/img/heromodel.jpg",
    path: "/brands",
  },
];

const collections = [
  {
    name: "Men",
    key: "collection-men",
    eyebrow: "The essential edit",
    copy: "Clean layers and relaxed proportions for the everyday uniform.",
    image: "/img/malemodel1.jpg",
    path: "/men",
    links: [
      ["Shoes", "/men?category=footwear"],
      ["Bags", "/men?category=accessories&subcategory=bags"],
      ["Accessories", "/men?category=accessories"],
    ],
  },
  {
    name: "Women",
    key: "collection-women",
    eyebrow: "A softer structure",
    copy: "Fluid shapes, considered textures, and pieces made to move.",
    image: "/img/model3.jpg",
    path: "/women",
    links: [
      ["Shoes", "/women?category=footwear"],
      ["Bags", "/women?category=accessories&subcategory=bags"],
      ["Accessories", "/women?category=accessories"],
    ],
  },
  {
    name: "Bags",
    key: "collection-bags",
    eyebrow: "Carry it forward",
    copy: "Useful forms with a little more character than expected.",
    image: "/img/bag4.jpg",
    path: "/women?category=accessories",
    links: [
      ["Totes", "/women?category=accessories&subcategory=totes"],
      ["Crossbody", "/women?category=accessories&subcategory=crossbody"],
      ["Clutches", "/women?category=accessories&subcategory=clutches"],
    ],
  },
  {
    name: "Athletics",
    key: "collection-athletics",
    eyebrow: "The details that matter",
    copy: "Small details, sharp silhouettes, and the pieces that stay.",
    image: "/img/shoe5.jpg",
    path: "/athletics",
    links: [
      ["Jerseys", "/men?category=athletics&subcategory=jerseys"],
      ["Football Boots", "/men?category=athletics&subcategory=football-boots"],
      ["Activewear", "/men?category=athletics&subcategory=activewear"],
    ],
  },
  {
    name: "Lifestyle",
    key: "collection-lifestyle",
    eyebrow: "Off-duty, considered",
    copy: "Easy layers and everyday pieces for everything around the main event.",
    image: "/img/model6.jpg",
    path: "/lifestyle",
    links: [
      ["Apparel", "/lifestyle?category=apparel"],
      ["New arrivals", "/shop/new-arrivals"],
    ],
  },
];

const brands = [
  [
    "Northline",
    "/brands/northline",
    "brand-northline",
    "/img/maleheromodel.jpg",
  ],
  [
    "Atelier Zero",
    "/brands/atelier-zero",
    "brand-atelier-zero",
    "/img/femaletop.jpg",
  ],
  [
    "Common Form",
    "/brands/common-form",
    "brand-common-form",
    "/img/goth-girl2.jpg",
  ],
];

// Desktop bento layout for the five Collections tiles.
const BENTO_LAYOUT = [
  { span: "col-span-1 md:col-span-4 md:row-span-2", compact: true },
  { span: "col-span-1 md:col-span-2 md:row-span-2", compact: true },
  { span: "col-span-1 md:col-span-2", compact: true },
  { span: "col-span-1 md:col-span-2", compact: true },
  { span: "col-span-1 md:col-span-4 md:row-span-2", compact: true },
];

const LinkList = ({
  links,
  className = "",
  light = false,
  stopPropagation = false,
}) => (
  <div className={`flex flex-wrap justify-center gap-x-5 gap-y-2 ${className}`}>
    {links.map(([label, path]) => (
      <Link
        key={label}
        to={path}
        onClick={
          stopPropagation ? (event) => event.stopPropagation() : undefined
        }
        className={`text-[13px] font-semibold underline-offset-4 hover:underline ${
          light ? "text-white/90" : "text-[var(--ink-900)]"
        }`}
      >
        {label}
      </Link>
    ))}
  </div>
);

const Shop = () => {
  const navigate = useNavigate();
  const siteImages = useSiteImages();
  const {
    data: products,
    isPending: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["products", { page: "home" }],
    queryFn: () => fetchNewArrivals(),
  });
  const newArrivals = products || [];

  return (
    <main className="bg-white text-black">
      {/* Full-bleed gradient hero */}
      <section className="relative h-screen w-full overflow-hidden">
        <RevealImage
          src={siteImages.hero || "/img/heromodel5.jpg"}
          alt="Featured GRV collection"
          loading="eager"
          className="absolute inset-0 z-0 h-full w-full"
          revealDuration={2.4}
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-transparent" />

        <div className="relative z-20 mx-auto flex h-full max-w-3xl flex-col justify-end px-6 pb-16 text-center text-white md:px-14 md:pb-24 lg:px-16">
          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/80"
          >
            The GRV edit
          </Motion.p>

          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.75 }}
            className="mx-auto"
          >
            <CtaButton
              to="/catalogues"
              title="Shop"
              bare
              className="text-5xl text-white md:text-7xl"
            />
          </Motion.div>

          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="mt-6 max-w-md text-lg mx-auto  leading-relaxed tracking-wide text-white/90"
          >
            Considered pieces across the labels and collections shaping the
            season.
          </Motion.p>

          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.05 }}
            className="mx-auto"
          >
            <CtaButton
              to="/catalogues"
              title="SHOP NOW"
              variant="light"
              className="mt-10"
            />
          </Motion.div>
        </div>
      </section>

      <div className="page-shell">
        {/* New Arrivals */}
        <section className={SECTION}>
          <div
            className={`flex items-end justify-between gap-6 ${SECTION_HEAD}`}
          >
            <div>
              <p className="eyebrow">Just in</p>
              <h2 className="section-title mt-1.5">
                New arrivals, handpicked as they land
              </h2>
            </div>
            <CtaButton to="/shop/new-arrivals" title="Shop now" />
          </div>
          {error && (
            <p className="meta-text">
              Couldn't load new arrivals.{" "}
              <button
                type="button"
                onClick={() => refetch()}
                className="font-semibold text-[var(--ink-900)] underline underline-offset-4 transition-colors hover:text-(--color-accent-orange)"
              >
                Try again
              </button>
            </p>
          )}
          {loading ? (
            <HorizontalSkeleton />
          ) : (
            <HorizontalCarousel>
              {newArrivals.map((product) => {
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
                      badge="NEW"
                    />
                  </Link>
                );
              })}
            </HorizontalCarousel>
          )}
        </section>

        {/* Choose a department */}
        <section className={SECTION}>
          <h2 className={`section-title ${SECTION_HEAD}`}>
            Choose a department
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
            {departments.map((department) => (
              <Link
                key={department.name}
                to={department.path}
                className="group relative block"
              >
                <RevealImage
                  src={siteImages[department.key] || department.image}
                  alt={department.name}
                  className="aspect-3/4 w-full transition-opacity group-hover:opacity-75"
                  revealDuration={0.8}
                  width={600}
                />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-white md:text-base">
                    {department.name}
                  </span>
                  <span className="inline-flex shrink-0 items-center justify-center border border-white bg-transparent px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black">
                    Shop {department.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Brands — hero + labeled thumbnails, min-h guards mobile overflow */}
        <section className={SECTION}>
          <Link
            to="/brands"
            className="group relative block min-h-120 md:aspect-21/9 md:min-h-0"
          >
            <RevealImage
              src={siteImages["brands-section"] || "/img/heromodel.jpg"}
              alt="Upcoming brands"
              className="absolute inset-0 h-full w-full transition-opacity group-hover:opacity-90"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 text-white md:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                Brands
              </p>
              <h2 className="mt-3 max-w-md text-2xl font-semibold md:text-5xl">
                Explore upcoming brands
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85 md:mt-4">
                New voices, considered essentials, and a point of view that
                keeps changing.
              </p>
              <p className="mt-4 text-sm font-semibold md:mt-6">
                — or enjoy the classics
              </p>
              <span className="pointer-events-auto mt-4 inline-flex w-fit items-center justify-center border border-white bg-transparent px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black">
                VIEW CATALOGUE
              </span>
            </div>
          </Link>

          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            {brands.map(([name, path, key, fallbackImage]) => (
              <Link key={name} to={path} className="group relative block">
                <RevealImage
                  src={siteImages[key] || fallbackImage}
                  alt={name}
                  className="aspect-3/4 w-full transition-opacity group-hover:opacity-75"
                  revealDuration={0.8}
                  width={500}
                />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/65 via-black/10 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-white md:text-base">
                    {name}
                  </span>
                  <span className="shrink-0 border border-white px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white transition-colors group-hover:bg-white group-hover:text-black">
                    Explore
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={`section-title ${SECTION_HEAD}`}>
            Shop the collections
          </h2>
          <div
            className="grid grid-cols-1 gap-2 auto-rows-[260px] md:grid-cols-4 md:gap-4 md:auto-rows-[240px]"
            style={{ gridAutoFlow: "dense" }}
          >
            {collections.map((collection, index) => {
              const layout = BENTO_LAYOUT[index % BENTO_LAYOUT.length];
              return (
                <div
                  key={collection.name}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(collection.path)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(collection.path);
                    }
                  }}
                  className={`group relative block cursor-pointer overflow-hidden ${layout.span}`}
                >
                  <RevealImage
                    src={siteImages[collection.key] || collection.image}
                    alt={collection.name}
                    className="absolute inset-0 h-full w-full transition-opacity group-hover:opacity-90"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                  <div
                    className={`absolute inset-0 flex flex-col justify-center items-center p-4 text-white md:p-8 text-center ${
                      layout.compact ? "" : "max-w-sm mx-auto"
                    }`}
                  >
                    {!layout.compact && (
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                        {collection.eyebrow}
                      </p>
                    )}
                    <h2
                      className={
                        layout.compact
                          ? "text-lg font-semibold md:text-2xl"
                          : "mt-3 text-2xl font-semibold md:text-4xl"
                      }
                    >
                      {collection.name}
                    </h2>
                    {!layout.compact && (
                      <p className="mt-3 text-sm leading-relaxed text-white/85 md:mt-4">
                        {collection.copy}
                      </p>
                    )}
                    {!layout.compact && (
                      <LinkList
                        links={collection.links}
                        light
                        stopPropagation
                        className="mt-4 justify-start md:mt-6"
                      />
                    )}
                    <span
                      className={`pointer-events-none inline-flex w-fit items-center justify-center border border-white bg-transparent text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black ${
                        layout.compact
                          ? "mt-2 px-3 py-1.5"
                          : "mt-4 px-6 py-3 text-xs md:mt-6"
                      }`}
                    >
                      {layout.compact ? "Shop" : "VIEW CATALOGUE"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <RecentlyViewedRail />
      </div>

      <StoreSupport promises={false} />
    </main>
  );
};

export default Shop;
