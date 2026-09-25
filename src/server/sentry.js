import * as Sentry from "@sentry/node";

// Same no-op-without-a-DSN shape as the client side (src/lib/sentry.js) —
// safe to import and call from anywhere in the API layer whether or not
// SENTRY_DSN has been set for a given environment.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.2 : 1.0,
  });
}

export { Sentry };
