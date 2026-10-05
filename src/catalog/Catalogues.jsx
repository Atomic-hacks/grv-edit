import React from "react";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import { HorizontalSkeleton } from "../component/ui/LoadingSkeletons";
import ErrorState from "../component/ui/ErrorState";
import {
  ContentSectionList,
  HeroSection,
} from "../component/content/ContentSections";
import { useContentSections, pickHero } from "../lib/useContentSections";

// The Departments page. Sections are managed in Admin → Page Sections
// (page: Departments). Without a hero section it keeps its plain title
// header; adding one replaces that header with a full-bleed hero.
const Catalogues = () => {
  const { data: sections = [], isPending, error, refetch, isRefetching } =
    useContentSections("DEPARTMENTS");
  const hero = pickHero(sections);

  return (
    <main className="min-h-screen bg-white text-black">
      {hero ? (
        <HeroSection section={hero} />
      ) : (
        <section className="page-shell pb-4 pt-10 md:pt-14">
          <AnimatedPageTitle
            title="Catalogues"
            subtitle="Browse every collection and department in one place."
          />
        </section>
      )}

      {isPending ? (
        <div className="page-shell py-16">
          <HorizontalSkeleton />
        </div>
      ) : error ? (
        <div className="page-shell">
          <ErrorState
            title="Couldn't load departments"
            message="Something went wrong on our end. Give it another try."
            onRetry={refetch}
            retryPending={isRefetching}
          />
        </div>
      ) : (
        <ContentSectionList sections={sections} />
      )}
    </main>
  );
};

export default Catalogues;
