import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

initSentry();
initAnalytics();

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
      gcTime: 10 * 60 * 1000,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
