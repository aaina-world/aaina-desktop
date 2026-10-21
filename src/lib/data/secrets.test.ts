import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
const { secrets, KEYCHAIN_UNAVAILABLE } = await import("./secrets");

describe("keychain errors", () => {
  it("say in plain words that the keychain couldn't be used", async () => {
    invoke.mockRejectedValueOnce("KEYCHAIN_UNAVAILABLE: Platform secure storage failure: no secret service");
    await expect(secrets.set("openai_api_key", "sk-x")).rejects.toThrow(KEYCHAIN_UNAVAILABLE);
  });
  it("keep any other reason, as an Error", async () => {
    invoke.mockRejectedValueOnce("unknown secret");
    await expect(secrets.get("openai_api_key")).rejects.toThrow("unknown secret");
  });
  it("pass answers through", async () => {
    invoke.mockResolvedValueOnce("sk-saved");
    expect(await secrets.get("openai_api_key")).toBe("sk-saved");
  });
});
