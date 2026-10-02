import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import "./index.css";
import App from "./App.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { RecentlyViewedProvider } from "./context/RecentlyViewedContext.jsx";
import ErrorBoundary from "./component/ErrorBoundary.jsx";
import { initSentry } from "./lib/sentry.js";
import { initAnalytics } from "./lib/analytics.js";
import {
  createQueryPersister,
  shouldPersistQuery,
  PERSIST_MAX_AGE,
  PERSIST_BUSTER,
} from "./lib/queryPersistence.js";

initSentry();
initAnalytics();

const persister = createQueryPersister();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      // Refetching every mounted query on window/tab focus was the source
      // of the "reloads when you come back to it" complaint: switching
      // apps and back re-fired every query on screen at once. Data is
      // already considered fresh for 5 minutes (staleTime above); nothing
      // here needs to be that eager.
      refetchOnWindowFocus: false,
      // Must be at least the persistence max age, or saved queries are
      // garbage-collected before they can be restored.
      gcTime: PERSIST_MAX_AGE,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: PERSIST_MAX_AGE,
          buster: PERSIST_BUSTER,
          dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        }}
      >
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <RecentlyViewedProvider>
                  <App />
                </RecentlyViewedProvider>
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
