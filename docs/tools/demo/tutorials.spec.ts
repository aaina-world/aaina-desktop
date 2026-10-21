// Screenshots for docs/tutorials. Demo mode, live catalogue, no real keys (the sample Api accepts any key that looks like one).
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { at, relayCatalog, shot } from "./helpers";

const DEMO_KEY = "sk-demo-key-for-the-tutorial-screens-0000";
const photo = (name: string) => readFileSync(join(import.meta.dirname, "out", `${name}.png`));
const heading = (page: Page) => page.getByRole("heading", { level: 1 });

test.beforeEach(async ({ page }) => relayCatalog(page));
test.afterEach(async ({ page }) => page.unrouteAll({ behavior: "ignoreErrors" }));

async function connect(page: Page) {
  await page.goto(at("/connect"));
  await page.getByRole("button", { name: /Sign in with ChatGPT/ }).click();
  await page.getByLabel("API key").fill(DEMO_KEY);
  await page.getByRole("button", { name: "Check key" }).click();
  await expect(page.getByText("Key works. You can make photos.")).toBeVisible();
}

test("1 getting started", async ({ page }) => {
  await page.goto(at("/welcome", true));
  await expect(heading(page)).toContainText("Model photos of your products");
  await shot(page, "01-welcome");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(heading(page)).toContainText("Connect OpenAI");
  await shot(page, "02-connect");
  await page.getByRole("button", { name: /Sign in with ChatGPT/ }).click();
  await page.getByLabel("API key").fill(DEMO_KEY);
  await page.getByRole("button", { name: "Check key" }).click();
  await expect(page.getByText("Key works. You can make photos.")).toBeVisible();
  await shot(page, "03-connected");
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(heading(page)).toContainText("Where should photos go?");
  await shot(page, "04-folder");
  await page.getByRole("button", { name: "Start using Aaina" }).click();
  await expect(heading(page)).toContainText("What are we shooting today?");
  await shot(page, "05-home");
});

test("2 a shoot on a model", async ({ page }) => {
  await connect(page);
  await page.goto(at("/create/new"));
  await expect(heading(page)).toContainText("Add your product");
  await shot(page, "10-product-empty");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photos" }).click();
  await (await chooser).setFiles({ name: "emerald-slip-dress.png", mimeType: "image/png", buffer: photo("dress-product") });
  await expect(page.getByText("Read by ChatGPT")).toBeVisible();
  await page.getByRole("textbox", { name: "Product name" }).fill("Emerald slip dress");
  await page.getByRole("textbox", { name: "Product name" }).blur();
  await page.waitForTimeout(800);
  await shot(page, "11-product");
  await page.getByRole("link", { name: /Next: model/ }).click();
  await expect(heading(page)).toContainText("Choose a model");
  await page.getByText("Suggested for your slip dress").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 260);
  await shot(page, "12-models");
  await page.getByRole("img", { name: "Chloe", exact: true }).first().click();
  await shot(page, "13-model-picked");
  await page.getByRole("link", { name: /Next: poses/ }).click();
  await expect(heading(page)).toContainText("Choose poses");
  await shot(page, "14-poses");
  for (const name of ["Walking", "Front view"]) await page.getByText(name, { exact: true }).first().click();
  await page.getByRole("tab", { name: /^All/ }).click();
  await page.getByPlaceholder("Search poses").fill("three-quarter");
  await page.getByText("Three-quarter, facing camera-left", { exact: true }).first().click();
  await page.getByPlaceholder("Search poses").fill("");
  await page.getByRole("tab", { name: "Suggested" }).click();
  await expect(page.getByText("3 of 6 picked")).toBeVisible();
  await shot(page, "15-poses-picked");
  await page.getByRole("link", { name: /Next: scene/ }).click();
  await expect(heading(page)).toContainText("Pick a scene");
  await shot(page, "16-scenes");
  await page.getByLabel("Search scenes").fill("studio");
  await page.getByRole("button", { name: /^Warm Minimal Arch Studio/ }).click();
  await shot(page, "17-scene-picked");
  await page.getByRole("tab", { name: "Colour" }).click();
  await shot(page, "18-scene-colour");
  await page.getByRole("tab", { name: "Scenes" }).click();
  await page.getByLabel("Search scenes").fill("studio");
  await page.getByRole("button", { name: /^Warm Minimal Arch Studio/ }).click();
  await page.getByRole("link", { name: /Next: review/ }).click();
  await expect(heading(page)).toContainText("Review");
  await page.getByRole("tab", { name: "High" }).click();
  await shot(page, "20-review");
  await page.getByRole("button", { name: /Make 3 photos/ }).click();
  await expect(page.getByText("Making your photo").first()).toBeVisible();
  await shot(page, "21-making");
  await expect(page.getByText("Making your photo")).toHaveCount(0, { timeout: 60_000 });
  await shot(page, "22-shoot-done");
  await page.getByRole("article").filter({ hasText: "Ready" }).first().getByRole("link").click();
  const viewer = page.getByRole("dialog", { name: "Photo viewer" });
  await expect(viewer).toBeVisible();
  await shot(page, "23-viewer");
  await viewer.getByRole("button", { name: /Fix something/ }).click();
  await viewer.getByLabel("What to fix").fill("Make the straps a little thinner");
  await shot(page, "24-fix");
  await viewer.getByRole("button", { name: "All tools" }).click();
  await viewer.getByRole("button", { name: /Other colours/ }).click();
  await shot(page, "25-colours");
  await viewer.getByRole("button", { name: "All tools" }).click();
  await viewer.getByRole("button", { name: /Save photo…/ }).click();
  await shot(page, "26-save");
});

async function addProduct(page: Page, kind: "Ghost mannequin" | "Flat-lay" | null, file: string, name: string) {
  await page.goto(at("/create/new"));
  if (kind) await page.getByRole("tab", { name: kind }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photos" }).click();
  await (await chooser).setFiles({ name: `${file === "coat" ? "camel-overcoat" : "emerald-slip-dress"}.png`, mimeType: "image/png", buffer: photo(`${file}-product`) });
  await expect(page.getByText("Read by ChatGPT")).toBeVisible();
  await page.getByRole("textbox", { name: "Product name" }).fill(name);
  await page.getByRole("textbox", { name: "Product name" }).blur();
  await page.waitForTimeout(600);
}

test("3 ghost mannequin and flat-lay", async ({ page }) => {
  await connect(page);
  await addProduct(page, "Ghost mannequin", "coat", "Camel overcoat");
  await expect(page.getByText(/Overcoat · camel/)).toBeVisible();
  await shot(page, "30-ghost-product");
  await page.getByRole("link", { name: /Next/ }).last().click();
  await shot(page, "31-ghost-angles");
  await addProduct(page, "Flat-lay", "dress", "Emerald slip dress");
  await page.getByRole("link", { name: /Next/ }).last().click();
  await shot(page, "32-flatlay-styles");
});

test("4 library: products, models, poses, scenes", async ({ page }) => {
  await connect(page);
  await page.goto(at("/library/products"));
  await shot(page, "40-library-products");
  await page.goto(at("/models/new"));
  await page.getByLabel(/^Name/).fill("Mira");
  await shot(page, "41-model-new");
  await page.getByRole("button", { name: /Show me 3 faces/ }).click();
  await expect(page.getByText("Making 3 faces")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick a face" })).toBeVisible({ timeout: 30_000 });
  await shot(page, "43-model-pick-face");
  await page.getByRole("button", { name: /Use this face/ }).nth(1).click();
  await shot(page, "44-model-sheet-making");
  await expect(page.getByText("Making the reference sheet")).toHaveCount(0, { timeout: 30_000 });
  await shot(page, "45-model-ready");

  await page.goto(at("/library/poses"));
  await page.getByRole("button", { name: /Make a pose/ }).click();
  await page.getByLabel("Describe the pose").fill("Hands in pockets, leaning on one leg, looking over the shoulder");
  await shot(page, "46-make-pose");
  await page.getByRole("button", { name: /Make the pose/ }).click();
  await page.waitForTimeout(3500);
  await shot(page, "47-poses-made");

  await page.goto(at("/library/scenes"));
  await page.getByRole("button", { name: /Make a scene/ }).click();
  await page.getByLabel("Describe the scene").fill("A soft white studio with sheer curtains and warm morning light");
  await shot(page, "48-make-scene");
  await page.getByRole("button", { name: /Make the scene/ }).click();
  await page.waitForTimeout(3500);
  await shot(page, "49-scenes-made");
});

test("5 shoots and settings", async ({ page }) => {
  await connect(page);
  await page.goto(at("/shoots"));
  await shot(page, "50-shoots");
  await page.goto(at("/settings"));
  await shot(page, "51-settings-connection");
  await page.locator("section#data").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot(page, "51-settings-data");
});
