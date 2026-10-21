import { expect, type Page } from "@playwright/test";

/** A real 1 x 1 PNG, to hand to the file chooser. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export const A_KEY = "sk-abcdefghijklmnopqrstuvwxyz0123";

/** Saves a key the mock Api accepts, so the app can make photos. */
export async function connectKey(page: Page) {
  await page.goto("/#/connect");
  await page.getByLabel("API key").fill(A_KEY);
  await page.getByRole("button", { name: "Check key" }).click();
  await expect(page.getByText("Key works. You can make photos.")).toBeVisible();
}

/** Opens the Create flow, chooses one photo and names the product. */
export async function addProduct(page: Page, name: string) {
  await page.goto("/#/create/new");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photos" }).click();
  await (await chooser).setFiles({ name: "tee.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("textbox", { name: "Product name" }).fill(name);
  await page.getByRole("textbox", { name: "Product name" }).blur();
}
