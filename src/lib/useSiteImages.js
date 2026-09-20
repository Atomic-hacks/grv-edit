import { useQuery } from "@tanstack/react-query";
import { fetchSiteImages } from "./apiClient";

export const useSiteImages = () => {
  const query = useQuery({
    queryKey: ["site-images"],
    queryFn: fetchSiteImages,
    staleTime: 0,
  });

  return query.data || {};
};
