import { brands } from "../data/brands";
import { getProducts as queryProducts } from "../data/products";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const getProducts = (url) => {
  return queryProducts({
    gender: url.searchParams.get("gender") || undefined,
    categoryId: url.searchParams.get("category") || undefined,
    subcategory: url.searchParams.get("subcategory") || undefined,
    styleTag: url.searchParams.get("style") || undefined,
    brandId: url.searchParams.get("brand") || undefined,
  });
};

export const handleApiRequest = (request) => {
  const url = new URL(request.url);

  if (request.method !== "GET")
    return jsonResponse({ error: "Method not allowed" }, 405);
  if (url.pathname === "/api/brands") return jsonResponse(brands);
  if (url.pathname === "/api/products") return jsonResponse(getProducts(url));

  return jsonResponse({ error: "Not found" }, 404);
};
