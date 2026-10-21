import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run the real screens in Chromium against `vite`, where the app uses the in-memory mock Api (no Tauri, no network).
const PORT = Number(process.env.E2E_PORT ?? 4519);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Use a Chromium you already have instead of the one Playwright downloads (E2E_CHROMIUM_PATH=/path/to/chrome).
    launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
    timeout: 60_000,
  },
});
