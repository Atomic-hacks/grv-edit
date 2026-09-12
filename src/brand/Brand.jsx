import React from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import RevealImage from "../component/ui/RevealImage";
import CtaButton from "../component/ui/CtaButton";

const pillars = [
  {
    title: "Considered Curation",
    copy: "Every brand on GRV is chosen, not just listed — we look for craftsmanship and a point of view before we look at trend.",
  },
  {
    title: "Global Access",
    copy: "Catalogues from across the world, brought together in one place so discovery doesn't depend on which city you're in.",
  },
  {
    title: "Rooted in Lagos",
    copy: "Built from Nigeria, for a global audience — proof that great taste isn't limited by geography.",
  },
];

const spotlightBrands = [
  ["Northline", "/brands/northline", "/img/maleheromodel.jpg"],
  ["Atelier Zero", "/brands/atelier-zero", "/img/femaletop.jpg"],
  ["Common Form", "/brands/common-form", "/img/goth-girl2.jpg"],
];

const Brand = () => {
  return (
    <main className="w-full bg-white text-black">
      {/* Full-bleed hero */}
      <section className="relative h-screen w-full overflow-hidden">
        <RevealImage
          src="/img/goth-boy.jpg"
          alt="GRV founder"
          loading="eager"
          className="absolute inset-0 h-full w-full"
          revealDuration={2.4}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/70" />
        <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-16 text-white md:px-14 md:pb-24 lg:px-16">
          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/80"
          >
            Meet The Founder
          </Motion.p>
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.65 }}
          >
            <AnimatedPageTitle title="Who We Are" className="text-white" />
          </Motion.div>
          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="mt-6 max-w-md text-lg leading-relaxed tracking-wide text-white/90"
          >
            What began as a small edit of hand-picked pieces shared with friends
            has grown into a destination for the brands that deserve a wider
            audience.
          </Motion.p>
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <CtaButton
              to="/brands"
              title="EXPLORE BRANDS"
              variant="light"
              className="mt-10"
            />
          </Motion.div>
        </div>
      </section>

      <div className="px-1.5">
        {/* Founding story */}
        <section className="py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                The story
              </p>
              <h2 className="mt-4 text-3xl font-semibold md:text-5xl">
                Taste as a starting point
              </h2>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-gray-600">
                GRV didn't start with a factory or a pattern room — it started
                with a founder tired of watching great labels stay invisible
                outside their home markets. We began sourcing pieces we believed
                in and putting them in front of people who would never have
                found them otherwise.
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-600">
                That instinct hasn't changed. GRV is still, at its core, a
                filter — one that separates the brands worth your attention from
                the noise.
              </p>
            </div>
            <RevealImage
              src="/img/heromodel3.jpg"
              alt="GRV curated catalogue"
              className="aspect-4/3 w-full"
            />
          </div>
        </section>

        {/* Based in Nigeria statement */}
        <section className="py-20 text-center md:py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Based in
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-5xl font-bold leading-none md:text-7xl">
            Lagos, Nigeria
          </h2>
          <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-gray-600">
            A global outlook, built from home — curating the world's catalogues
            for a market that deserves the same access as anywhere else.
          </p>
        </section>

        {/* Pillars */}
        <section className="py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {pillars.map((pillar) => (
              <div key={pillar.title}>
                <span className="text-(--color-accent-orange) text-xs font-semibold uppercase tracking-[0.16em]">
                  —
                </span>
                <h3 className="mt-3 text-xl font-semibold">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {pillar.copy}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Brands we carry */}
        <section className="py-16 md:py-24">
          <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                On GRV
              </p>
              <h2 className="mt-2 text-3xl font-semibold md:text-4xl">
                Brands we carry
              </h2>
            </div>
            <CtaButton to="/brands" title="VIEW ALL" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {spotlightBrands.map(([name, path, image]) => (
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

        {/* Closing CTA */}
        <section className="pb-24 md:pb-32">
          <div className="relative flex min-h-[380px] items-center justify-center overflow-hidden text-center md:min-h-[440px]">
            <RevealImage
              src="/img/goth-flowers.jpg"
              alt="Explore the GRV catalogue"
              className="absolute inset-0 h-full w-full"
            />
            <div className="pointer-events-none absolute inset-0 bg-black/55" />
            <div className="relative z-10 px-6 text-white">
              <h2 className="text-3xl font-semibold md:text-5xl">
                Ready to explore?
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/85">
                Every catalogue we carry, in one place.
              </p>
              <CtaButton
                to="/catalogues"
                title="SHOP NOW"
                variant="light"
                className="pointer-events-auto mt-8 w-fit"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Brand;
