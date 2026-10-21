import { expect, test } from "@playwright/test";

test.describe("first run", () => {
  test("welcome, connect, setup, then home", async ({ page }) => {
    await page.goto("/?firstrun");
    await expect(page).toHaveURL(/#\/welcome$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Model photos of your products");

    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Connect OpenAI");
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");

    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Where should photos go?");
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    await expect(page.getByText("Sent to Aaina")).toBeVisible();

    await page.getByRole("button", { name: "Start using Aaina" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What are we shooting today?");
  });

  test("Skip for now on the connect screen goes straight home, and a reload stays there", async ({ page }) => {
    await page.goto("/?firstrun#/connect");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What are we shooting today?");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What are we shooting today?");
  });

  test("until onboarding is done every address leads to the welcome screen", async ({ page }) => {
    await page.goto("/?firstrun#/shoots");
    await expect(page).toHaveURL(/#\/welcome$/);
  });

  test("a key the mock refuses is explained, and the way back to the welcome screen works", async ({ page }) => {
    await page.goto("/?firstrun#/connect");
    await page.getByLabel("API key").fill("sk-refused-key-0000000000");
    await page.getByRole("button", { name: "Check key" }).click();
    await expect(page.getByText(/OpenAI didn't accept this key/)).toBeVisible();
    await page.getByRole("link", { name: /Back/ }).click();
    await expect(page).toHaveURL(/#\/welcome$/);
  });
});
