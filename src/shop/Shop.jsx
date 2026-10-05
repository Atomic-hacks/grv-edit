import React from "react";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import { HorizontalSkeleton } from "../component/ui/LoadingSkeletons";
import ErrorState from "../component/ui/ErrorState";
import RecentlyViewedRail from "../component/section/RecentlyViewedRail";
import StoreSupport from "../component/section/StoreSupport";
import {
  ContentSectionList,
  HeroSection,
} from "../component/content/ContentSections";
import { useContentSections, pickHero } from "../lib/useContentSections";

// Everything above the recently-viewed rail is managed in Admin → Page
// Sections (page: Shop): the hero, product rails, tile grids and banners,
// their order, and whether each is shown.
const Shop = () => {
  const { data: sections = [], isPending, error, refetch, isRefetching } =
    useContentSections("SHOP");
  const hero = pickHero(sections);

  return (
    <main className="bg-white text-black">
      {isPending ? (
        <>
          <div className="h-screen w-full animate-pulse bg-[#161616]" />
          <div className="page-shell py-16">
            <HorizontalSkeleton />
          </div>
        </>
      ) : error ? (
        <div className="page-shell min-h-[60vh]">
          <ErrorState
            title="Couldn't load the shop"
            message="Something went wrong on our end. Give it another try."
            onRetry={refetch}
            retryPending={isRefetching}
            secondaryTo="/catalogues"
            secondaryLabel="Browse departments"
          />
        </div>
      ) : (
        <>
          {hero ? (
            <HeroSection section={hero} />
          ) : (
            <section className="page-shell pb-4 pt-10 md:pt-14">
              <AnimatedPageTitle title="Shop" />
            </section>
          )}
          <ContentSectionList sections={sections} />
        </>
      )}

      <div className="page-shell">
        <RecentlyViewedRail />
      </div>
      <StoreSupport promises={false} />
    </main>
  );
};

export default Shop;
