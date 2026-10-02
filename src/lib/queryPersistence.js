import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// Public catalogue data is saved to localStorage so a refresh, or coming
// back tomorrow, paints from the saved copy instantly while fresh data
// loads in the background — instead of every visit starting from nothing.
//
// This is an ALLOWLIST, never "everything": anything personal or
// sensitive (account, orders, cart, wishlist, waitlist, cases, checkout,
// the whole admin) must not be written to a shared device's disk, and
// would be wrong to show a different user after a logout.
export const PERSISTED_QUERY_ROOTS = new Set([
  "content-sections",
  "products",
  "product-filters",
  "product",
  "categories",
  "brands",
  "brand",
  "filter-types",
  "tags",
]);

export const shouldPersistQuery = (query) =>
  query.state.status === "success" && PERSISTED_QUERY_ROOTS.has(query.queryKey[0]);

// Saved data older than this is discarded rather than shown.
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

// Each deploy gets its own cache, so a new release never reads data shaped
// by the previous one. __APP_BUILD__ is injected by vite.config.js.
// eslint-disable-next-line no-undef
export const PERSIST_BUSTER = typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : "dev";

export const createQueryPersister = () =>
  createSyncStoragePersister({
    storage: typeof window === "undefined" ? undefined : window.localStorage,
    key: "grv-query-cache",
    // Batches writes so a burst of queries resolving doesn't hammer
    // localStorage (it's synchronous) on the main thread.
    throttleTime: 1000,
  });
