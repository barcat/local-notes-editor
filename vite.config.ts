import { defineConfig, loadEnv, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

function normalizeBasePath(value: string | undefined): string {
  const raw = value?.trim() || "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash ? `${withoutTrailingSlash}/` : "/";
}

function createNotFoundPage(basePath: string): string {
  const serializedBasePath = JSON.stringify(basePath);
  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lokalne notatki</title>
  </head>
  <body>
    <p>Przywracanie edytora…</p>
    <script>
      (() => {
        const basePath = ${serializedBasePath};
        const currentPath = window.location.pathname;
        const appPath = currentPath.startsWith(basePath) ? currentPath : basePath;
        try {
          window.sessionStorage.setItem("local-notes:pending-path:v1", appPath);
        } catch {
          // Continue to the app even when sessionStorage is unavailable.
        }
        window.location.replace(basePath);
      })();
    </script>
  </body>
</html>
`;
}

function githubPagesNotFound(basePath: string): Plugin {
  return {
    name: "github-pages-not-found",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "404.html", source: createNotFoundPage(basePath) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const basePath = normalizeBasePath(env.VITE_BASE_PATH);

  return {
    base: basePath,
    plugins: [
      preact(),
      githubPagesNotFound(basePath),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["404.html"],
        manifest: {
          name: "Lokalne notatki",
          short_name: "Notatki",
          description: "Edytor notatek przechowywanych lokalnie.",
          start_url: basePath,
          scope: basePath,
          display: "standalone",
          background_color: "#f4f1de",
          theme_color: "#233d4d",
          icons: [],
        },
        workbox: {
          navigateFallback: `${basePath}index.html`,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        },
      }),
    ],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
