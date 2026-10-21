import { defineConfig } from "vitest/config";

// Two projects: the logic in src/lib runs in plain Node; the screens and components run in jsdom.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "lib", environment: "node", include: ["src/lib/**/*.test.ts"] } },
      {
        test: {
          name: "ui",
          environment: "jsdom",
          environmentOptions: { jsdom: { url: "http://localhost/" } },
          include: ["src/ui/**/*.test.{ts,tsx}"],
          setupFiles: ["src/test/setup.ts"],
          // Plain CSS stays out of the screens' tests; `?raw` imports (read by the layering test) keep their text.
          css: { include: [/\.css\?raw$/] },
          testTimeout: 15_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      // A little under what the suite reaches today (97 / 88 / 96): a drop below fails the run.
      // Vitest 5 also counts files no test imports (Vitest 3 skipped them), so these are lower than before for the same code.
      thresholds: { lines: 95, statements: 93, functions: 91, branches: 83 },
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/**/*.testkit.ts", "src/lib/**/*.d.ts", "src/lib/mock/**", "src/lib/catalog/fixtures/**"],
    },
  },
});
