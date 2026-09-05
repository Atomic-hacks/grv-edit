import React from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import RevealImage from "../component/ui/RevealImage";
import CtaButton from "../component/ui/CtaButton";
import HorizontalCarousel from "../component/ui/HorizontalCarousel";
import { formatPrice, getProducts } from "../data/products";

// Single spacing scale reused by every section on this page.
const SECTION = "py-16 md:py-24";
const SECTION_HEAD = "mb-6 md:mb-10";

const departments = [
  { name: "Men", image: "/img/maleheromodel.jpg", path: "/men" },
  { name: "Women", image: "/img/femaletop.jpg", path: "/women" },
  {
    name: "Accessories",
    image: "/img/bag1.jpg",
      path: "/accessories",
  },
  { name: "Brands", image: "/img/heromodel.jpg", path: "/brands" },
];

const collections = [
  {
    name: "Men",
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
];

const brands = [
  ["Northline", "/brands/northline", "/img/maleheromodel.jpg"],
  ["Atelier Zero", "/brands/atelier-zero", "/img/femaletop.jpg"],
  ["Common Form", "/brands/common-form", "/img/goth-girl2.jpg"],
];

// Overlay boxes: min-h guarantees room for the text stack on mobile;
// the aspect-ratio only takes over at md, where there's width to spare.
const OVERLAY_LAYOUT = [
  {
    box: "min-h-[520px] md:aspect-21/9 md:min-h-0",
    align: "items-end justify-start text-left",
  },
  {
    box: "min-h-[560px] md:aspect-4/3 md:min-h-0",
    align: "items-end justify-end text-right",
  },
  {
    box: "min-h-[520px] md:aspect-16/9 md:min-h-0",
    align: "items-start justify-start text-left",
  },
  {
    box: "min-h-[560px] md:aspect-21/9 md:min-h-0",
    align: "items-center justify-center text-center",
  },
];

const LinkList = ({ links, className = "", light = false }) => (
  <div className={`flex flex-wrap gap-x-5 gap-y-2 ${className}`}>
    {links.map(([label, path]) => (
      <Link
        key={label}
        to={path}
        className={`text-sm font-semibold hover:underline ${
          light ? "text-white/90" : "text-black"
        }`}
      >
        {label}
      </Link>
    ))}
  </div>
);

const Shop = () => (
  <main className="bg-white text-black">
    {/* Full-bleed gradient hero */}
    <section className="relative h-screen w-full overflow-hidden">
      <RevealImage
        src="/img/heromodel5.jpg"
        alt="Featured GRV collection"
        className="absolute inset-0 z-0 h-full w-full"
        revealDuration={2.4}
      />

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
          className="mt-6 max-w-md text-lg leading-relaxed tracking-wide text-white/90"
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

    <div className="px-1.5">
      {/* New Arrivals */}
      <section className={SECTION}>
        <div className={`flex items-end justify-between gap-6 ${SECTION_HEAD}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              Just in
            </p>
            <h2 className="mt-2 text-3xl font-semibold md:text-4xl">
              New Arrivals
            </h2>
          </div>
          <CtaButton to="/shop/new-arrivals" title="VIEW ALL" />
        </div>
          <HorizontalCarousel>
            {getProducts().filter((product) => product.isNew).map((product) => {
              const image = product.variants[0]?.images[0];
              return (
                <Link key={product.id} to={`/product/${product.id}`} className="group relative block">
                  <RevealImage src={image} alt={product.name} className="aspect-3/4 w-full transition-opacity group-hover:opacity-80" revealDuration={0.8} />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-sm font-semibold text-white">
                    <span>{product.name}</span>
                    <span>{formatPrice(product.basePrice)}</span>
                  </div>
                </Link>
              );
            })}
          </HorizontalCarousel>
      </section>

      {/* Choose a department */}
      <section className={SECTION}>
        <h2
          className={`text-sm font-semibold uppercase tracking-[0.14em] ${SECTION_HEAD}`}
        >
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
                src={department.image}
                alt={department.name}
                className="aspect-3/4 w-full transition-opacity group-hover:opacity-75"
                revealDuration={0.8}
              />
              <span className="absolute inset-x-4 bottom-5 text-lg font-semibold uppercase tracking-wide text-white">
                {department.name}
              </span>
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
            src="/img/heromodel.jpg"
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
              New voices, considered essentials, and a point of view that keeps
              changing.
            </p>
            <p className="mt-4 text-sm font-semibold md:mt-6">
              — or enjoy the classic
            </p>
            <CtaButton
              to="/brands"
              title="VIEW CATALOGUE"
              variant="light"
              className="pointer-events-auto mt-4 w-fit md:mt-6"
            />
          </div>
        </Link>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {brands.map(([name, path, image]) => (
            <Link key={name} to={path} className="group relative block">
              <RevealImage
                src={image}
                alt={name}
                className="aspect-3/4 w-full transition-opacity group-hover:opacity-75"
                revealDuration={0.8}
              />
              <span className="absolute inset-x-3 bottom-3 text-xs font-semibold uppercase tracking-wide text-white">
                {name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Collections — min-h on mobile prevents the text stack overflowing the image */}
      {collections.map((collection, index) => {
        const layout = OVERLAY_LAYOUT[index % OVERLAY_LAYOUT.length];
        return (
          <section key={collection.name} className={SECTION}>
            <Link
              to={collection.path}
              className={`group relative block ${layout.box}`}
            >
              <RevealImage
                src={collection.image}
                alt={collection.name}
                className="absolute inset-0 h-full w-full transition-opacity group-hover:opacity-90"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
              <div
                className={`absolute inset-0 flex flex-col p-6 text-white md:p-12 ${layout.align}`}
              >
                <div className={index === 3 ? "max-w-md" : "max-w-sm"}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                    {collection.eyebrow}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold md:text-5xl">
                    {collection.name}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/85 md:mt-4">
                    {collection.copy}
                  </p>
                  <LinkList
                    links={collection.links}
                    light
                    className={`mt-4 md:mt-6 ${
                      index === 3 ? "justify-center" : ""
                    }`}
                  />
                  <CtaButton
                    to={collection.path}
                    title="VIEW CATALOGUE"
                    variant="light"
                    className="pointer-events-auto mt-4 w-fit md:mt-6"
                  />
                </div>
              </div>
            </Link>
          </section>
        );
      })}
    </div>
  </main>
);

export default Shop;
