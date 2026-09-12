import React from "react";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import RevealImage from "../component/ui/RevealImage";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import CtaButton from "../component/ui/CtaButton";
import HorizontalCarousel from "../component/ui/HorizontalCarousel";
import { fetchBrands, fetchProducts } from "../lib/apiClient";
import { useAsync } from "../lib/useAsync";
import { formatPrice } from "../lib/productHelpers";

const SECTION = "py-16 md:py-24";
const SECTION_HEAD = "mb-6 md:mb-10";

const departments = [
  {
    id: "men",
    name: "Men",
    image: "/img/maleheromodel.jpg",
    path: "/men",
  },
  {
    id: "women",
    name: "Women",
    image: "/img/femaletop.jpg",
    path: "/women",
  },
  {
    id: "footwear",
    name: "Footwear",
    image: "/img/shoe.jpg",
    path: "/footwear",
  },
  {
    id: "accessories",
    name: "Accessories",
    image: "/img/bag1.jpg",
    path: "/accessories",
  },
  {
    id: "athletics",
    name: "Athletics",
    image: "/img/model4.jpg",
    path: "/athletics",
  },
  {
    id: "apparel",
    name: "Apparel",
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
    />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
    <span className="absolute inset-x-4 bottom-4 text-lg font-semibold uppercase tracking-wide text-white transition-colors group-hover:text-(--color-accent-orange)">
      {name}
    </span>
  </Link>
);

const Catalogues = () => {
  const {
    data: products,
    loading,
    error,
  } = useAsync(() => fetchProducts({}), []);
  const { data: brands } = useAsync(() => fetchBrands(), []);
  const newArrivals = (products || []).filter((product) => product.isNew);

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="px-4 pt-20 pb-4 md:px-16 lg:px-24">
        <AnimatedPageTitle title="Catalogues" />
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-600">
          Browse every collection and department in one place.
        </p>
      </section>

      <div className="px-1.5">
        <section className={SECTION}>
          <div
            className={`flex items-end justify-between gap-6 ${SECTION_HEAD}`}
          >
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
          {error && (
            <p className="text-sm text-red-600">Couldn't load new arrivals.</p>
          )}
          {loading ? (
            <ProductGridSkeleton count={4} />
          ) : (
            <HorizontalCarousel>
              {newArrivals.map((product) => {
                const images = product.variants?.[0]?.images || [];
                return (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="group relative block"
                  >
                    <RevealImage
                      src={images[0]}
                      alt={product.name}
                      className="aspect-3/4 w-full transition-opacity group-hover:opacity-80"
                      revealDuration={0.8}
                    />
                    <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-sm font-semibold text-white">
                      <span>{product.name}</span>
                      <span>{formatPrice(product.basePrice)}</span>
                    </div>
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
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">
              Featured catalogues
            </h2>
            <CtaButton to="/brands" title="VIEW ALL BRANDS" />
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
                image={department.image}
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
