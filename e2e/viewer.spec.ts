import { expect, test } from "@playwright/test";

test.describe("photo viewer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/shoots");
    await page.getByRole("link", { name: "Camel coat" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Camel coat");
    await page.getByRole("article").filter({ hasText: "Ready" }).first().getByRole("link").click();
    await expect(page.getByRole("dialog", { name: "Photo viewer" })).toBeVisible();
  });

  test("opens on a photo with its place in the shoot", async ({ page }) => {
    const viewer = page.getByRole("dialog", { name: "Photo viewer" });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByText("1 of 4")).toBeVisible();
    await expect(viewer.getByRole("img")).toBeVisible();
    await expect(page).toHaveURL(/#\/photo\/[\w-]+\?shoot=[\w-]+$/);
  });

  test("next and previous, by button and by arrow key", async ({ page }) => {
    const viewer = page.getByRole("dialog", { name: "Photo viewer" });
    await viewer.getByRole("button", { name: "Next photo" }).click();
    await expect(viewer.getByText("2 of 4")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(viewer.getByText("3 of 4")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(viewer.getByText("2 of 4")).toBeVisible();
    await viewer.getByRole("button", { name: "Previous photo" }).click();
    await expect(viewer.getByText("1 of 4")).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Previous photo" })).toHaveCount(0);
  });

  test("Esc and the Close button go back to the shoot", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Photo viewer" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Camel coat");
    await page.getByRole("article").filter({ hasText: "Ready" }).first().getByRole("link").click();
    await expect(page.getByRole("dialog", { name: "Photo viewer" })).toBeVisible();
    await page.getByRole("button", { name: "Close viewer" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Camel coat");
  });
});
