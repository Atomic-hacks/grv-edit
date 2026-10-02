import { waitUntil } from "@vercel/functions";

/**
 * Runs work that must finish but must not delay the HTTP response —
 * customer emails, brand notices, admin alerts.
 *
 * A bare `void promise` is not enough on Vercel: the function instance can
 * be frozen the moment the response is returned, killing any work still in
 * flight. `waitUntil` tells the platform to keep the instance alive until
 * the promise settles. Outside Vercel (local `vite dev`) there's no request
 * context and the promise simply runs to completion on its own.
 *
 * Never throws, and never lets the work's own rejection go unhandled.
 */
export const runInBackground = (promise, label = "Background task") => {
  const guarded = Promise.resolve(promise).catch((error) => {
    console.error(`${label} failed`, error);
  });
  try {
    waitUntil(guarded);
  } catch {
    // No request context (local dev, tests) — `guarded` already runs.
  }
  return guarded;
};
