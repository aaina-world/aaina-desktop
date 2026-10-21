import { expect, test } from "@playwright/test";
import { addProduct, connectKey } from "./helpers";

test("the full create flow: product, model, poses, scene, review, Make photos, progress, done", async ({ page }) => {
  await connectKey(page);
  await addProduct(page, "Cobalt tee");

  // Product
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Add your product");
  await page.getByRole("link", { name: /Next: model/ }).click();

  // Model
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Choose a model");
  await expect(page.getByRole("button", { name: /Next: poses/ })).toBeDisabled();
  await page.getByRole("img", { name: "Tara", exact: true }).click();
  await page.getByRole("link", { name: /Next: poses/ }).click();

  // Poses
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Choose poses");
  await expect(page.getByText("0 of 6 picked")).toBeVisible();
  await page.getByText("Arms crossed, wide stance", { exact: true }).first().click();
  await page.getByText("Peace sign", { exact: true }).first().click();
  await expect(page.getByText("2 of 6 picked")).toBeVisible();
  await page.getByRole("link", { name: /Next: scene/ }).click();

  // Scene
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pick a scene");
  await page.getByRole("button", { name: /^White studio/ }).click();
  await page.getByRole("link", { name: /Next: review/ }).click();

  // Review: the price is shown before anything is sent
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Review");
  await expect(page.getByText("Nothing is sent until you press Make")).toBeVisible();
  const make = page.getByRole("button", { name: /Make 2 photos/ });
  await expect(make).toContainText("about $0.10");
  await page.getByRole("tab", { name: "High" }).click();
  await expect(make).toContainText("about $0.40");
  await page.getByRole("tab", { name: "Standard" }).click();
  await expect(make).toContainText("about $0.10");

  // Make: the shoot page shows progress, then the photos
  await make.click();
  await expect(page).toHaveURL(/#\/shoots\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cobalt tee");
  await expect(page.getByText("Making your photo").first()).toBeVisible();
  await expect(page.getByText("0 photos · 2 making")).toBeVisible();
  await expect(page.getByRole("link", { name: "Arms crossed, wide stance" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Peace sign" })).toBeVisible();
  await expect(page.getByText("Making your photo")).toHaveCount(0);
});

test("a draft keeps its choices when you go Back and forward", async ({ page }) => {
  await addProduct(page, "Linen top");
  await page.getByRole("link", { name: /Next: model/ }).click();
  await page.getByRole("img", { name: "Nia", exact: true }).click();
  await page.getByRole("link", { name: /Next: poses/ }).click();
  await expect(page.getByText("On a model · Nia")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Choose a model");
  await expect(page.getByRole("link", { name: "3 Poses" })).toBeVisible(); // the chosen model is remembered: Poses is reachable
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Choose poses");
  await expect(page.getByText("On a model · Nia")).toBeVisible();
});

test("without a key the Review step says so and cannot start anything", async ({ page }) => {
  await page.goto("/#/shoots?q=linen");
  await page.getByRole("link", { name: "Linen shirt", exact: true }).click();
  await page.getByRole("link", { name: "5 Review" }).click();
  await expect(page.getByText(/Add your OpenAI key in Settings/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Make \d+ photo/ })).toBeDisabled();
});
