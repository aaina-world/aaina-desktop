import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

export const SHOTS = join(import.meta.dirname, "..", "..", "tutorials", "img");
mkdirSync(SHOTS, { recursive: true });

/** The app in demo mode with the live catalogue. `first` starts at the first-run screens. */
export const at = (hash: string, first = false) => `/?demo&catalog=live${first ? "&firstrun" : ""}#${hash}`;

/** static.aaina.world sends no CORS header (the app reads it without CORS); the browser gets it relayed with one. */
export async function relayCatalog(page: Page) {
  await page.route("https://static.aaina.world/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": "*" } });
  });
}

/** Waits for pictures to finish loading, then saves a screenshot as docs/tutorials/img/<name>.webp, 1600 px wide. */
export async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.waitForTimeout(400);
  const png = (await page.screenshot()).toString("base64");
  // Chromium encodes WebP itself, so the tool needs no image library.
  const encoder = await page.context().newPage();
  const webp = await encoder.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = Math.round((img.height * 1600) / img.width);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.82).split(",")[1];
  }, png);
  await encoder.close();
  writeFileSync(join(SHOTS, `${name}.webp`), Buffer.from(webp, "base64"));
}
