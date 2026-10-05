import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "../lib/apiClient";
import { getCategoryHref } from "../lib/categoryTree";
import Spinner from "../component/ui/Spinner";
import NotFound from "../NotFound";

// /sections/:slug used to be a separate view of a category flagged for the
// homepage. Homepage rails are now Page Sections, and a category's own page
// already lists the same products, so old links land there instead.
const SectionPage = () => {
  const { slug } = useParams();
  const { data: categories, isPending } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  if (isPending) {
    return (
      <main className="page-shell flex min-h-[60vh] items-center justify-center py-24">
        <Spinner label="Loading" className="text-sm text-[var(--ink-500)]" />
      </main>
    );
  }
  const category = (categories || []).find((item) => item.slug === slug);
  if (!category) return <NotFound />;
  return <Navigate to={getCategoryHref(categories, category.id)} replace />;
};

export default SectionPage;
