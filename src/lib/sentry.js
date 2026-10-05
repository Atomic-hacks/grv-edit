import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

// No-ops entirely when the DSN isn't set (local dev without a .env value,
// or any deploy that hasn't been given one yet) — every Sentry.* call
// elsewhere in the app is always safe to make, init or not.
export const initSentry = () => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // Trace a fraction of pageloads/navigations in production, all of them
    // in dev — this is a small storefront, not a high-traffic API.
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  });
};

export { Sentry };
