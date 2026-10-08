import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

// Set for non-production instances (e.g. "Development"); see INSTANCE_LABEL in docs/deployment.md.
const instanceLabel = process.env.VITE_INSTANCE_LABEL?.trim() || undefined;
const DEV_THEME_COLOR = "#1e3a8a";
const PAGE_THEME_COLOR = "#eef0f3";

/**
 * Builds the web app manifest. Non-production instances get their own name, theme color and icons,
 * so an installed dev app can never be mistaken for the real one.
 * @param {string | undefined} label
 */
function buildManifest(label: string | undefined): string {
  const icons = label ? "/icons/dev" : "/icons";
  return JSON.stringify(
    {
      name: label ? `FreeSite (${label})` : "FreeSite",
      short_name: label ? "FreeSite dev" : "FreeSite",
      description: "Which exams are free? Vote with your course.",
      lang: "en",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: label ? DEV_THEME_COLOR : PAGE_THEME_COLOR,
      theme_color: label ? DEV_THEME_COLOR : PAGE_THEME_COLOR,
      icons: [
        { src: `${icons}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${icons}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `${icons}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  );
}

/** Serves and emits manifest.webmanifest, and points the page at the dev icons for labelled instances. */
function webAppPlugin(label: string | undefined): Plugin {
  return {
    name: "free-site-web-app",
    transformIndexHtml(html) {
      if (!label) return html;
      return html
        .replace('href="/favicon.svg"', 'href="/favicon-dev.svg"')
        .replace('href="/apple-touch-icon.png"', 'href="/apple-touch-icon-dev.png"')
        .replace(/\s*<meta name="theme-color"[^>]*dark\)" \/>/, "")
        .replace(/<meta name="theme-color"[^>]*light\)" \/>/, `<meta name="theme-color" content="${DEV_THEME_COLOR}" />`);
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: buildManifest(label) });
    },
    configureServer(server) {
      server.middlewares.use("/manifest.webmanifest", (_request, response) => {
        response.setHeader("Content-Type", "application/manifest+json");
        response.end(buildManifest(label));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), webAppPlugin(instanceLabel)],
  server: { proxy: { "/api": "http://localhost:3000" } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"] },
});
