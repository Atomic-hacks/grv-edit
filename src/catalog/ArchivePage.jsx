import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Card from "../component/ui/Card";
import { ProductGridSkeleton } from "../component/ui/LoadingSkeletons";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import ErrorState from "../component/ui/ErrorState";
import { getProductImages } from "../lib/productHelpers";
import { fetchProductPage } from "../lib/apiClient";

// Archived products are a status, not a taxonomy membership — sold-out,
// retired pieces kept for reference. Deliberately not part of the category
// tree, so it stays its own small page rather than a category an admin
// could accidentally delete.
const ArchivePage = () => {
  const archiveQuery = useQuery({
    queryKey: ["products", { archived: true }],
    queryFn: () => fetchProductPage({ archived: true, pageSize: 60 }),
  });
  const products = archiveQuery.data?.items || [];

  return (
    <main className="page-shell min-h-screen bg-white pb-24">
      <Breadcrumbs className="pt-4" items={[{ label: "Home", to: "/" }, { label: "Archive" }]} />
      <div className="pb-8 pt-6 md:pb-10 md:pt-8">
        <AnimatedPageTitle title="Archive" subtitle="Retired pieces, kept for reference." />
      </div>

      {archiveQuery.isPending ? (
        <ProductGridSkeleton />
      ) : archiveQuery.error ? (
        <ErrorState
          title="Couldn't load the archive"
          message="Something went wrong. Give it another try."
          onRetry={() => archiveQuery.refetch()}
        />
      ) : products.length === 0 ? (
        <p className="py-24 text-center text-sm text-[var(--ink-500)]">Nothing archived yet.</p>
      ) : (
        <div className="product-grid">
          {products.map((product) => {
            const images = getProductImages(product);
            return (
              <Link key={product.id} to={`/product/${product.id}`}>
                <Card
                  img={images[0]}
                  hoverImg={images[1] || images[0]}
                  alt={product.name}
                  title={product.name}
                  product={product}
                  category={product.subcategory}
                />
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default ArchivePage;
