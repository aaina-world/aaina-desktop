import { expect, it } from "vitest";

// Overlays must stack in a fixed order: a dialog opened from the photo viewer has to show above it, and menus and
// toasts above dialogs. The last rule for a selector wins, as in the app (components.css loads after ds.css).
const sheets = import.meta.glob<string>(["./*.css", "../components/*.css"], { query: "?raw", import: "default", eager: true });
const ORDER = ["./ds.css", "./desktop.css", "../components/components.css"];

function zIndex(selector: string): number {
  let found: number | undefined;
  for (const file of ORDER) {
    const css = sheets[file] ?? "";
    const rule = new RegExp(`(?:^|[}\\s])${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "g");
    for (const match of css.matchAll(rule)) {
      const z = /z-index:\s*(\d+)/.exec(match[1]);
      if (z) found = Number(z[1]);
    }
  }
  if (found === undefined) throw new Error(`No z-index for ${selector}`);
  return found;
}

it("stacks the viewer under dialogs, and dialogs under menus and toasts", () => {
  expect(zIndex(".scrim")).toBeGreaterThan(zIndex(".viewer"));
  expect(zIndex(".menu-fixed")).toBeGreaterThan(zIndex(".scrim"));
  expect(zIndex(".toast-host")).toBeGreaterThan(zIndex(".scrim"));
});
