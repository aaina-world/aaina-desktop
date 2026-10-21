import { describe, expect, it } from "vitest";
import { checkForUpdate, isNewer } from "./updates";

const answer =
  (status: number, body: unknown = {}) =>
  async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("isNewer", () => {
  it("compares each part as a number, ignoring a leading v and pre-release tags", () => {
    expect(isNewer("v0.2.0", "0.1.9")).toBe(true);
    expect(isNewer("1.2.10", "1.2.9")).toBe(true);
    expect(isNewer("1.2.0", "1.2")).toBe(false);
    expect(isNewer("0.1.0", "0.1.0")).toBe(false);
    expect(isNewer("1.0.0-beta.1", "1.0.0")).toBe(false);
  });
});

describe("checkForUpdate", () => {
  it("treats no release yet as up to date", async () => {
    expect(await checkForUpdate("0.1.0", answer(404))).toEqual({ kind: "latest" });
  });
  it("offers a newer release with its page", async () => {
    const page = "https://github.com/aaina-world/aaina-desktop/releases/tag/v0.2.0";
    const r = await checkForUpdate("0.1.0", answer(200, { tag_name: "v0.2.0", html_url: page }));
    expect(r).toEqual({ kind: "newer", version: "0.2.0", url: page });
  });
  it("never sends people anywhere but this project's release pages", async () => {
    for (const html_url of [
      "https://github.com/x/y/releases/tag/v0.2.0",
      "https://evil.example/aaina-world/aaina-desktop/releases/tag/v0.2.0",
      "javascript:alert(1)",
    ])
      expect(await checkForUpdate("0.1.0", answer(200, { tag_name: "v0.2.0", html_url }))).toEqual({ kind: "latest" });
  });
  it("ignores the same version, drafts and pre-releases", async () => {
    expect(await checkForUpdate("0.2.0", answer(200, { tag_name: "v0.2.0", html_url: "u" }))).toEqual({ kind: "latest" });
    expect(await checkForUpdate("0.1.0", answer(200, { tag_name: "v0.2.0", html_url: "u", prerelease: true }))).toEqual({ kind: "latest" });
  });
  it("is an error when GitHub can't answer", async () => {
    await expect(checkForUpdate("0.1.0", answer(503))).rejects.toThrow("503");
  });
});
