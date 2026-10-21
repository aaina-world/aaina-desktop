import { describe, expect, it, vi } from "vitest";
import { createChatGPT } from "./chatgpt";

const jwt = (claims: object) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.y`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const stored = (over: object = {}) => ({
  clientId: "oaiapp_9",
  hostId: "h",
  email: "me@x.y",
  plan: "plus",
  subject: "u1",
  accessToken: "at-old",
  refreshToken: "rt-old",
  idToken: null,
  scopes: ["chatgpt.tokens.use.direct"],
  expiresAt: 0,
  savedAt: "",
  ...over,
});
function keychain(initial?: object | string) {
  const store = new Map<string, string>();
  if (initial) store.set("chatgpt_tokens", typeof initial === "string" ? initial : JSON.stringify(initial));
  return {
    store,
    secrets: {
      get: async (n: string) => store.get(n) ?? null,
      set: async (n: string, v: string) => void store.set(n, v),
      delete: async (n: string) => void store.delete(n),
    } as never,
  };
}
const NOW = 1_800_000_000_000;

describe("sign-in failures say what happened", () => {
  async function signInWith(callback: string, tokenReply?: Response, previous?: object) {
    const k = keychain(previous);
    let state = "";
    const c = createChatGPT({
      secrets: k.secrets,
      now: () => NOW,
      openUrl: async (u) => void (state = new URL(u).searchParams.get("state")!),
      invoke: async (cmd) => (cmd === "oauth_loopback_start" ? 1455 : callback.replace("STATE", state)),
      fetcher: async () => tokenReply ?? json({}),
    });
    return { c, k, run: () => c.signIn() };
  }
  it("a callback for another request is refused", async () => {
    await expect((await signInWith("code=a&state=other&client_id=x")).run()).rejects.toThrow(/did not match/);
  });
  it("cancelling and other errors", async () => {
    await expect((await signInWith("error=access_denied&state=STATE")).run()).rejects.toThrow(/cancelled/);
    await expect((await signInWith("error=server_error&state=STATE")).run()).rejects.toThrow(/sign-in failed/);
  });
  it("a callback without a code, or for another app, is refused", async () => {
    await expect((await signInWith("state=STATE")).run()).rejects.toThrow(/did not finish/);
    await expect((await signInWith("code=a&state=STATE&client_id=other", undefined, stored())).run()).rejects.toThrow(/not for this app/);
  });
  it("a plan that cannot be used by this app is refused and nothing is kept", async () => {
    const reply = json({ access_token: "at", id_token: jwt({ aud: "c", exp: 9_999_999_999 }), scope: "openid", expires_in: 60 });
    const s = await signInWith("code=a&state=STATE&client_id=c", reply);
    await expect(s.run()).rejects.toThrow(/plan can't be used/);
    expect(s.k.store.has("chatgpt_tokens")).toBe(false); // only the host id is kept
  });
  it("a sign-in answer for another app, an old one, or one with another nonce is refused", async () => {
    const bad = (claims: object) => json({ access_token: "at", id_token: jwt(claims), scope: "chatgpt.tokens.use.direct" });
    await expect((await signInWith("code=a&state=STATE&client_id=c", bad({ aud: "someone-else" }))).run()).rejects.toThrow(
      /not for this app/,
    );
    await expect((await signInWith("code=a&state=STATE&client_id=c", bad({ aud: "c", exp: 1 }))).run()).rejects.toThrow(/expired/);
    await expect((await signInWith("code=a&state=STATE&client_id=c", bad({ aud: "c", nonce: "not-ours" }))).run()).rejects.toThrow(
      /did not match/,
    );
  });
  it("the token endpoint refusing the code is an error", async () => {
    await expect((await signInWith("code=a&state=STATE&client_id=c", json({ error: "invalid_grant" }, 400))).run()).rejects.toThrow(
      /invalid_grant/,
    );
  });
});

describe("tokens", () => {
  it("a token that is still good is used as it is", async () => {
    const k = keychain(stored({ expiresAt: NOW + 3_600_000 }));
    const fetcher = vi.fn();
    const c = createChatGPT({ secrets: k.secrets, now: () => NOW, fetcher });
    expect(await c.status()).toEqual({ signedIn: true, email: "me@x.y", plan: "plus" });
    expect(await c.signedIn()).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("garbage in the keychain means signed out", async () => {
    const c = createChatGPT({ secrets: keychain("{not json").secrets, now: () => NOW });
    expect(await c.signedIn()).toBe(false);
  });
  async function read(tokens: object, replies: Response[]) {
    const k = keychain(tokens);
    const seen: Array<{ url: string; body?: unknown }> = [];
    const c = createChatGPT({
      secrets: k.secrets,
      now: () => NOW,
      fetcher: async (url, init) => (seen.push({ url, body: init?.body }), replies.shift() ?? json({}, 500)),
    });
    return { c, k, seen };
  }
  const stream = (text: string) =>
    new Response(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\ndata: [DONE]\n\n`, { status: 200 });
  const models = () =>
    json({
      models: [
        { slug: "gpt-5", visibility: "list" },
        { slug: "gpt-luna", visibility: "list" },
        { slug: "hidden", visibility: "hide" },
      ],
    });

  it("refreshes an expired token before reading, keeps the new tokens, and asks for the plan's model", async () => {
    const { c, k, seen } = await read(stored(), [
      json({ access_token: "at-new", refresh_token: "rt-new", expires_in: 3600, scope: "chatgpt.tokens.use.direct" }),
      models(),
      stream('Sure: {"label":"Kurta"} thanks'),
    ]);
    expect(await c.readJson({ prompt: "read it" })).toEqual({ label: "Kurta" });
    expect(seen[0].body).toContain("grant_type=refresh_token");
    expect(JSON.parse(k.store.get("chatgpt_tokens")!)).toMatchObject({ accessToken: "at-new", refreshToken: "rt-new" });
    expect(JSON.parse(seen[2].body as string)).toMatchObject({ model: "gpt-luna", store: false, stream: true });
  });
  it("an ended session (invalid_grant) signs the person out; any other refresh problem keeps the tokens", async () => {
    const ended = await read(stored(), [json({ error: "invalid_grant" }, 400)]);
    await expect(ended.c.readJson({ prompt: "x" })).rejects.toThrow(/Sign in with ChatGPT again/);
    expect(ended.k.store.size).toBe(0);
    const flaky = await read(stored(), [json({}, 503)]);
    await expect(flaky.c.readJson({ prompt: "x" })).rejects.toThrow(/Sign in/);
    expect(flaky.k.store.size).toBe(1);
  });
  it("no refresh token on an expired session signs out", async () => {
    const { c, k } = await read(stored({ refreshToken: null }), []);
    await expect(c.readJson({ prompt: "x" })).rejects.toThrow(/Sign in/);
    expect(k.store.size).toBe(0);
  });
  it("a plan with no model, or an answer that is not OK, is a plain error", async () => {
    const none = await read(stored({ expiresAt: NOW + 9e6 }), [json({ models: [] })]);
    await expect(none.c.readJson({ prompt: "x" })).rejects.toThrow(/No model is available/);
    const refused = await read(stored({ expiresAt: NOW + 9e6 }), [models(), json({}, 429)]);
    await expect(refused.c.readJson({ prompt: "x" })).rejects.toThrow(/answered 429/);
  });
  it("sign-out revokes the refresh token when it can, and clears locally even when it cannot", async () => {
    const good = await read(stored(), [json({ revocation_endpoint: "https://auth.openai.com/revoke" }), json({})]);
    await good.c.signOut();
    expect(good.seen[1]).toMatchObject({ url: "https://auth.openai.com/revoke" });
    expect(String(good.seen[1].body)).toContain("token=rt-old");
    expect(good.k.store.size).toBe(0);
    const offline = createChatGPT({
      secrets: keychain(stored()).secrets,
      fetcher: async () => {
        throw new Error("offline");
      },
    });
    await offline.signOut();
    expect(await offline.signedIn()).toBe(false);
  });
});
