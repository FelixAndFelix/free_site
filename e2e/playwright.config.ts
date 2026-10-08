import { defineConfig, devices } from "@playwright/test";

// The suite runs the real built backend against a real PostgreSQL database and the built frontend
// behind `vite preview`, which proxies /api like production's nginx does. See e2e/README.md.
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 3100);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 4173);
export const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://free_site@localhost:5432/e2e";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  // One worker: the tests share one database and one in-memory rate limiter.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // For machines where Playwright's own browser download is not available.
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  projects: [
    // Registers the first admin through the UI and saves their session for the other tests.
    { name: "setup", testMatch: /00-first-admin\.setup\.ts/ },
    {
      name: "desktop",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      // Mails are printed to this log when there is no RESEND_API_KEY; the tests read the codes from it.
      command: "node ../backend/dist/server.js > .backend.log 2>&1",
      url: `http://localhost:${backendPort}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(backendPort),
        DATABASE_URL,
        ALLOWED_EMAIL_DOMAINS: "dhbw.example",
        ADMIN_SETUP_CODE: "e2e-admin-setup-code",
        INITIAL_COURSE_JOIN_CODE: "E2E-COURSE-CODE",
      },
    },
    {
      command: `npx vite preview --port ${frontendPort} --strictPort`,
      cwd: "../frontend",
      url: `http://localhost:${frontendPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { BACKEND_URL: `http://localhost:${backendPort}` },
    },
  ],
});
