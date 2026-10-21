import { defineConfig } from "@playwright/test";

// Tutorial screenshots and the demo video: the real screens in Chromium against `vite`, with the sample Api in demo mode
// (`?demo`) and Aaina's real public catalogue (`?catalog=live`). Run from the repo root:
//   npx playwright test -c docs/tools/demo
const PORT = 4520;

export default defineConfig({
  testDir: ".",
  testMatch: /\.spec\.ts$/,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    actionTimeout: 15_000,
    launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH || undefined },
  },
  webServer: { command: `npx vite --port ${PORT} --strictPort`, cwd: "../../..", url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 60_000 },
});
