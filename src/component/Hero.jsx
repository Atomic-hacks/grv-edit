"use client";

import React, { useEffect, useState } from "react";
import Button from "./ui/special-button";
import { useNavigate } from "react-router-dom";
import AnimatedPageTitle from "./ui/AnimatedPageTitle";
import RecentlyViewedRail from "./section/RecentlyViewedRail";
import StoreSupport from "./section/StoreSupport";
import { HorizontalSkeleton } from "./ui/LoadingSkeletons";
import {
  ContentSectionList,
  SectionMedia,
} from "./content/ContentSections";
import { useContentSections, pickHero } from "../lib/useContentSections";

// The landing page. Its intro (logo, menu, Lagos clock) is fixed; the
// background media, optional tagline, and every section below it are
// managed in Admin → Page Sections (page: Home).
const Hero = () => {
  const [time, setTime] = useState("");
  const navigate = useNavigate();
  const { data: sections = [], isPending } = useContentSections("HOME");
  const hero = pickHero(sections);

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
      <section className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#161616] text-white">
        {/* Background image or video — Admin → Page Sections → Home hero. */}
        {hero && (
          <SectionMedia
            section={hero}
            eager
            className="absolute inset-0 z-10 h-full w-full"
          />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-transparent via-black/50 to-transparent" />

        {/* Main Content */}
        <nav className="relative z-30 mt-16 flex flex-col items-center justify-center text-center md:mt-24">
          <AnimatedPageTitle
            img="/img/logowhite.png"
            className="uppercase tracking-[3px] text-4xl md:text-8xl font-normal mb-8 text-white"
          />
          {hero?.description && (
            <p className="-mt-4 mb-8 max-w-md px-6 text-sm leading-relaxed tracking-wide text-white/85 md:text-base">
              {hero.description}
            </p>
          )}

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
          <div className="absolute bottom-0 z-30 flex flex-col items-center justify-center w-full gap-1 py-6 md:py-10">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/60 md:text-xs">
              Lagos
            </span>
            <p className="font-mono text-2xl font-semibold tabular-nums tracking-[0.08em] text-white md:text-4xl">
              {time}
            </p>
          </div>
        )}
      </section>
      {isPending ? (
        <div className="page-shell py-16">
          <HorizontalSkeleton />
        </div>
      ) : (
        <ContentSectionList sections={sections} />
      )}

      <div className="page-shell">
        <RecentlyViewedRail />
      </div>

      <StoreSupport promises={false} />
    </>
  );
};

export default Hero;
