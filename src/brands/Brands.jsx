import React from "react";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import { brands } from "../data/brands";

const Brands = () => {
  return (
    <div className="min-h-screen bg-white px-4 md:px-32">
      <div className="relative py-16">
        <AnimatedPageTitle title="Brands" />
        <p className="mt-6 max-w-lg text-lg leading-relaxed tracking-wide text-gray-900">
          Explore the labels behind our curated collection.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-12 pb-20 md:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <Link key={brand.id} to={`/brands/${brand.id}`} className="group">
            <div className="aspect-3/4 overflow-hidden bg-[#f0f0f0]">
              <img
                src={brand.logo}
                alt={brand.name}
                className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-80"
              />
            </div>
            <div className="pt-4">
              <h2 className="text-xl font-semibold text-neutral-800">
                {brand.name}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
                {brand.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Brands;
