import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "site",
      "design",
      "docs",
      ".wrangler",
      "src-tauri",
      "coverage",
      "playwright-report",
      "test-results",
      "e2e-app",
      "packaging",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      // Prompt text is cleaned of control characters on purpose.
      "no-control-regex": "off",
      // Async handlers on JSX attributes are idiomatic React; async functions that satisfy a Promise-returning interface need no await.
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false, properties: false } }],
      // Not using the React Compiler, so its strict "pure render" rules are noise here; rules-of-hooks and exhaustive-deps stay on.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      // Screens export small helpers next to components; Vite still reloads them fully.
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description", minimumDescriptionLength: 10 }],
    },
  },
  {
    // Tests may use looser typing around mocks.
    files: ["src/**/*.test.{ts,tsx}", "src/**/*.testkit.ts", "src/test/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  {
    files: ["e2e/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
    ...tseslint.configs.disableTypeChecked,
  },
);
