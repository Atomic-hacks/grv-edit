"use client";

import React, { useEffect, useState } from "react";
import Button from "./ui/special-button";
import SpotifyPlayer from "./ui/spotify-player";
import { Link, useNavigate } from "react-router-dom";
import AnimatedPageTitle from "./ui/AnimatedPageTitle";
import { useQuery } from "@tanstack/react-query";
import { fetchHomepageSections } from "../lib/apiClient";
import SectionProductBlock from "./section/SectionProductBlock";
import ProductRail from "./section/ProductRail";
import RecentlyViewedRail from "./section/RecentlyViewedRail";
import StoreSupport from "./section/StoreSupport";
import RevealImage from "./ui/RevealImage";
import { fetchNewArrivals } from "../lib/apiClient";
import { useSiteImages } from "../lib/useSiteImages";
import { useCart } from "../context/CartContext";

const departments = [
  {
    name: "Women",
    key: "department-women",
    image: "/img/femaletop.jpg",
    path: "/women",
  },
  {
    name: "Men",
    key: "department-men",
    image: "/img/maleheromodel.jpg",
    path: "/men",
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

const Hero = () => {
  const [time, setTime] = useState("");
  const navigate = useNavigate();
  const siteImages = useSiteImages();
  const { addToCart } = useCart();
  const homepageSectionsQuery = useQuery({
    queryKey: ["homepage-sections"],
    queryFn: fetchHomepageSections,
  });
  const newArrivalsQuery = useQuery({
    queryKey: ["products", { page: "home" }],
    queryFn: fetchNewArrivals,
  });

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Lagos",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <section className="relative h-screen w-full overflow-hidden text-white bg-[#161616]">
        {/* Background Video */}
        <video
          src="/videos/hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 z-10 h-full w-full object-cover"
        />

        {/* Overlay */}
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-transparent via-black/50 to-transparent" />

        {/* Main Content */}
        <nav className="relative z-30 flex flex-col items-center justify-center text-center mt-48 md:mt-72">
          <AnimatedPageTitle
            img="/img/lo.png"
            className="uppercase tracking-[3px] text-4xl md:text-8xl font-normal mb-8 text-white"
          />

          <ul className="space-y-2 flex flex-col items-center justify-center">
            {["Shop", "Departments", "Brands", "About Us", "Contact"].map(
              (title) => (
                <Button
                  key={title}
                  title={title}
                  onPress={() =>
                    navigate(title === "About Us" ? "/about" : `/${title}`)
                  }
                  containerClass="flex flex-col items-center justify-center gap-2"
                />
              ),
            )}
          </ul>
        </nav>

        {/* Time Display */}
        {time && (
          <div className="absolute bottom-0 z-30 flex items-center justify-center w-full py-4 text-xs md:text-sm">
            <p>Lagos {time}</p>
          </div>
        )}

        {/* Spotify Player */}
        <SpotifyPlayer />
      </section>
      <div className="page-shell">
        <ProductRail
          eyebrow="Just in"
          title="New arrivals, handpicked as they land"
          products={(newArrivalsQuery.data || []).slice(0, 12)}
          loading={newArrivalsQuery.isPending}
          viewAllTo="/shop/new-arrivals"
          viewAllLabel="Shop now"
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

        <section className="py-12 md:py-16">
          <p className="eyebrow">Start here</p>
          <h2 className="section-title mt-1.5">Choose a department</h2>
          <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
            {departments.map((department) => (
              <Link
                key={department.name}
                to={department.path}
                className="group relative block"
              >
                <RevealImage
                  src={siteImages[department.key] || department.image}
                  alt={department.name}
                  className="aspect-3/4 w-full"
                  revealDuration={0.8}
                  width={600}
                />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-white md:text-base">
                    {department.name}
                  </span>
                  <span className="inline-flex items-center justify-center border border-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition-colors duration-200 group-hover:bg-white group-hover:text-[var(--ink-900)]">
                    Explore
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {(homepageSectionsQuery.data || []).map((section) => (
        <SectionProductBlock key={section.id} section={section} />
      ))}

      <div className="page-shell">
        <RecentlyViewedRail />
      </div>

      <StoreSupport promises={false} />
    </>
  );
};

export default Hero;
