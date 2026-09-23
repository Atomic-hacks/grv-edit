import React from "react";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import RevealImage from "../component/ui/RevealImage";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import CtaButton from "../component/ui/CtaButton";
import HorizontalCarousel from "../component/ui/HorizontalCarousel";
import { fetchBrands, fetchNewArrivals } from "../lib/apiClient";
import { useAsync } from "../lib/useAsync";
import Card from "../component/ui/Card";
import { getProductImages } from "../lib/productHelpers";
import { useSiteImages } from "../lib/useSiteImages";

const SECTION = "py-16 md:py-24";
const SECTION_HEAD = "mb-6 md:mb-10";

const departments = [
  {
    id: "men",
    name: "Men",
    key: "department-men",
    image: "/img/maleheromodel.jpg",
    path: "/men",
  },
  {
    id: "women",
    name: "Women",
    key: "department-women",
    image: "/img/femaletop.jpg",
    path: "/women",
  },
  {
    id: "footwear",
    name: "Footwear",
    key: "department-footwear",
    image: "/img/shoe.jpg",
    path: "/footwear",
  },
  {
    id: "accessories",
    name: "Accessories",
    key: "department-accessories",
    image: "/img/bag1.jpg",
    path: "/accessories",
  },
  {
    id: "athletics",
    name: "Athletics",
    key: "department-athletics",
    image: "/img/model4.jpg",
    path: "/athletics",
  },
  {
    id: "apparel",
    name: "Apparel",
    key: "department-apparel",
    image: "/img/top1.avif",
    path: "/men?category=apparel",
  },
];

const CatalogueTile = ({ name, image, logo, path }) => (
  <Link to={path} className="group relative block">
    <RevealImage
      src={image || logo}
      alt={name}
      className="aspect-4/3 w-full transition-opacity group-hover:opacity-75"
      revealDuration={0.9}
      width={600}
    />
    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/5 to-transparent" />
    <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
      <span className="text-lg font-semibold uppercase tracking-wide text-white transition-colors group-hover:text-(--color-accent-orange)">
        {name}
      </span>
      <span className="shrink-0 border border-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition-colors group-hover:bg-white group-hover:text-black">
        Explore
      </span>
    </div>
  </Link>
);

const Catalogues = () => {
  const siteImages = useSiteImages();
  const {
    data: products,
    loading,
    error,
    refetch,
  } = useAsync(() => fetchNewArrivals(), []);
  const { data: brands } = useAsync(() => fetchBrands(), []);
  const newArrivals = products || [];

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="page-shell pb-4 pt-10 md:pt-14">
        <AnimatedPageTitle
          title="Catalogues"
          subtitle="Browse every collection and department in one place."
        />
      </section>

      <div className="page-shell">
        <section className={SECTION}>
          <div
            className={`flex items-end justify-between gap-6 ${SECTION_HEAD}`}
          >
            <div>
              <p className="eyebrow">Just in</p>
              <h2 className="section-title mt-1.5">New arrivals</h2>
            </div>
            <CtaButton to="/shop/new-arrivals" title="Shop now" />
          </div>
          {error && (
            <p className="meta-text">
              Couldn't load new arrivals.{" "}
              <button
                type="button"
                onClick={refetch}
                className="font-semibold text-[var(--ink-900)] underline underline-offset-4 transition-colors hover:text-(--color-accent-orange)"
              >
                Try again
              </button>
            </p>
          )}
          {loading ? (
            <ProductGridSkeleton count={4} />
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

        <section className={SECTION}>
          <div
            className={`flex items-end justify-between gap-6 ${SECTION_HEAD}`}
          >
            <h2 className="section-title">Featured catalogues</h2>
            <CtaButton to="/brands" title="All brands" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4">
            {(brands || []).map((brand) => (
              <CatalogueTile
                key={brand.id}
                name={brand.name}
                image={brand.image}
                logo={brand.logo}
                path={brand.path || `/brands/${brand.slug || brand.id}`}
              />
            ))}
          </div>
        </section>

        <section className={SECTION}>
          <h2
            className={`text-sm font-semibold uppercase tracking-[0.14em] ${SECTION_HEAD}`}
          >
            Departments
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4">
            {departments.map((department) => (
              <CatalogueTile
                key={department.id}
                name={department.name}
                image={siteImages[department.key] || department.image}
                path={department.path}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default Catalogues;
