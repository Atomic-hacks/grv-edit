import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import SectionProductBlock from "../component/section/SectionProductBlock";
import { fetchSection } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";
import ErrorState from "../component/ui/ErrorState";

const SectionPage = () => {
  const { slug } = useParams();
  const sectionQuery = useQuery({
    queryKey: ["section", slug],
    queryFn: () => fetchSection(slug),
    enabled: Boolean(slug),
  });

  if (sectionQuery.isPending) {
    return (
      <main className="page-shell flex min-h-[60vh] items-center justify-center py-24">
        <Spinner label="Loading section" className="text-sm text-[var(--ink-500)]" />
      </main>
    );
  }
  if (sectionQuery.error) {
    return (
      <main className="page-shell min-h-[60vh]">
        <ErrorState
          title="Couldn't load this section"
          message="Something went wrong on our end. Give it another try."
          onRetry={sectionQuery.refetch}
          retryPending={sectionQuery.isRefetching}
          secondaryTo="/shop"
          secondaryLabel="Back to shop"
        />
      </main>
    );
  }
  if (!sectionQuery.data) return null;

  return (
    <main className="min-h-screen bg-white text-black">
      <SectionProductBlock section={sectionQuery.data} standalone />
    </main>
  );
};

export default SectionPage;
