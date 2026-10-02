import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { handleApiRequest } from "./src/api/routes.js";

const apiPlugin = () => ({
  name: "static-api-routes",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith("/api/")) {
        next();
        return;
      }

      const result = await handleApiRequest(
        new Request(`http://${request.headers.host}${request.url}`, {
          method: request.method,
          headers: new Headers(
            Object.entries(request.headers).filter(
              ([, value]) => typeof value === "string",
            ),
          ),
          body:
            request.method === "GET" || request.method === "HEAD"
              ? undefined
              : request,
          duplex: "half",
        }),
      );
      response.statusCode = result.status;
      result.headers.forEach((value, key) => response.setHeader(key, value));
      response.end(await result.text());
    });
  },
});

// One id per build, used to invalidate every visitor's saved query cache on
// deploy. Vercel's commit SHA when available, otherwise the build time.
const appBuild = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(appBuild) },
  // One copy of React Query only: a second copy (e.g. bundled inside the
  // persist client's dev pre-bundle) has its own context, which makes
  // useQueryClient throw "No QueryClient set" under the provider.
  resolve: { dedupe: ["@tanstack/react-query", "@tanstack/query-core", "react", "react-dom"] },
  plugins: [
    tailwindcss(),
    apiPlugin(),
    // Uploads source maps so stack traces in Sentry show real file/line
    // instead of minified gibberish. Silently skipped without an auth
    // token — everyone's local `vite build` still works without one, only
    // CI/deploys that have SENTRY_AUTH_TOKEN set actually upload.
    process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      }),
  ].filter(Boolean),
  build: {
    sourcemap: true,
  },
});
