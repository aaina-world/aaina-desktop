import { expect, test, type Page } from "@playwright/test";

const luminance = async (page: Page, selector: string, property: "backgroundColor" | "color") =>
  page.evaluate(
    ([sel, prop]) => {
      const el = document.querySelector(sel)!;
      const css = getComputedStyle(el)[prop as "color"];
      const [r, g, b] = (css.match(/\d+(\.\d+)?/g) ?? []).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    },
    [selector, property] as const,
  );

test("the theme switch in Settings changes the whole window and is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/#/settings");
  const theme = page.getByRole("tablist", { name: "Theme" });
  await expect(theme.getByRole("tab", { name: "System" })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => luminance(page, "body", "backgroundColor")).toBeGreaterThan(0.8);

  await theme.getByRole("tab", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => luminance(page, "body", "backgroundColor")).toBeLessThan(0.2);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("tablist", { name: "Theme" }).getByRole("tab", { name: "Dark" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tablist", { name: "Theme" }).getByRole("tab", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => luminance(page, "body", "backgroundColor")).toBeGreaterThan(0.8);
});

test("System follows the computer's dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/#/settings");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await expect.poll(() => luminance(page, "body", "backgroundColor")).toBeLessThan(0.2);
});

test.describe("dark mode sanity check", () => {
  test.use({ colorScheme: "dark" });

  for (const [name, path] of [
    ["home", "/#/"],
    ["shoots", "/#/shoots"],
    ["settings", "/#/settings"],
    ["create", "/#/create/new"],
  ] as const) {
    test(`${name} is dark, readable and not blank`, async ({ page }, info) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect.poll(() => luminance(page, "body", "backgroundColor")).toBeLessThan(0.2);
      await expect.poll(() => luminance(page, "h1", "color")).toBeGreaterThan(0.6);
      const shot = await page.screenshot({ fullPage: false });
      await info.attach(`${name}-dark.png`, { body: shot, contentType: "image/png" });
      // Not blank: a real screen has many different pixels, so a PNG of one flat colour would be tiny.
      expect(shot.byteLength).toBeGreaterThan(20_000);
      // No horizontal overflow (a broken dark theme often shows as stray bars).
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
