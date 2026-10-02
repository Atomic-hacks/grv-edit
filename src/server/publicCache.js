// Which API responses may be cached by Vercel's CDN and the browser.
//
// Only anonymous GETs of public catalogue data qualify. Everything else —
// the whole of /api/admin, accounts, orders, cart, wishlist, checkout —
// is never given a cache header, and a request that carries credentials
// is never treated as public even if its path matches, so one shopper's
// personalised response can't be served to another.
const PUBLIC_CATALOGUE_PATH =
  /^\/api\/(content-sections|products(\/[^/]+)?|products\/(filters|new-arrivals)|categories|brands(\/[^/]+)?|filter-types|tags|journal(\/[^/]+)?)$/;

// Product detail carries live stock, so it's cached for far less than a
// listing is.
const PRODUCT_DETAIL_PATH = /^\/api\/products\/(?!filters$|new-arrivals$)[^/]+$/;

const CATALOGUE_CACHE = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
const PRODUCT_DETAIL_CACHE = "public, max-age=0, s-maxage=20, stale-while-revalidate=60";

export const publicCacheControl = (request, status) => {
  if (request.method !== "GET" || status !== 200) return null;
  if (request.headers.get("authorization") || request.headers.get("cookie")) return null;
  const { pathname } = new URL(request.url);
  if (!PUBLIC_CATALOGUE_PATH.test(pathname)) return null;
  return PRODUCT_DETAIL_PATH.test(pathname) ? PRODUCT_DETAIL_CACHE : CATALOGUE_CACHE;
};
