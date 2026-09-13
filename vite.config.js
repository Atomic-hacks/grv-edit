import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
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

export default defineConfig({
  plugins: [tailwindcss(), apiPlugin()],
});
