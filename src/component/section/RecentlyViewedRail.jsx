import React from "react";
import ProductRail from "./ProductRail";
import { useRecentlyViewed } from "../../context/RecentlyViewedContext";

// Reads the session's viewing history and renders it as a rail. Renders
// nothing at all when there is no history — a "you haven't viewed anything"
// placeholder on a shopping page is a dead end, not an empty state.
const RecentlyViewedRail = ({ excludeId, className = "" }) => {
  const { getRecentlyViewed } = useRecentlyViewed();
  const products = getRecentlyViewed(excludeId);

  if (products.length === 0) return null;

  return (
    <ProductRail
      eyebrow="Picked up where you left off"
      title="Recently viewed"
      products={products}
      className={className}
    />
  );
};

export default RecentlyViewedRail;
