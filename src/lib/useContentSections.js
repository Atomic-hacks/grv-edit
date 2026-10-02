import { useQuery } from "@tanstack/react-query";
import { fetchContentSections } from "./apiClient";

// Admin-managed sections for one page (HOME, SHOP, DEPARTMENTS, or
// CATEGORY with a categoryId), already resolved by the API.
export const useContentSections = (page, categoryId) =>
  useQuery({
    queryKey: ["content-sections", page, categoryId || null],
    queryFn: () => fetchContentSections(page, categoryId),
    enabled: page !== "CATEGORY" || Boolean(categoryId),
    staleTime: 60 * 1000,
  });

// A page shows at most one hero — the first active one in its order.
export const pickHero = (sections = []) =>
  sections.find((section) => section.layout === "HERO") || null;
