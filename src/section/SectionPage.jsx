import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import SectionProductBlock from "../component/section/SectionProductBlock";
import { fetchSection } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const SectionPage = () => {
  const { slug } = useParams();
  const sectionQuery = useQuery({
    queryKey: ["section", slug],
    queryFn: () => fetchSection(slug),
    enabled: Boolean(slug),
  });

  if (sectionQuery.isPending) {
    return (
      <main className="min-h-screen px-6 py-24">
        <Spinner label="Loading section" />
      </main>
    );
  }
  if (sectionQuery.error) {
    return (
      <main className="min-h-screen px-6 py-24 text-sm text-red-600">
        Couldn&apos;t load this section.
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
