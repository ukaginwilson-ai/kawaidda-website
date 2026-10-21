import { defineConfig } from "vite";
import { resolve } from "node:path";

const sitePage = "/index.html";

export default defineConfig({
  plugins: [{
    name: "website-root-redirect",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = new URL(request.url || "/", "http://localhost");
        if (request.method === "GET" && requestUrl.pathname === "/") {
          response.statusCode = 302;
          response.setHeader("Location", `${sitePage}${requestUrl.search}`);
          response.end();
          return;
        }
        next();
      });
    },
  }],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        admin: resolve(process.cwd(), "admin.html"),
        trackOrder: resolve(process.cwd(), "track-order.html"),
      },
    },
  },
});
