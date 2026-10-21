import { describe, expect, it } from "vitest";
import { authorizeUrl, createChatGPT, firstJsonObject, isHostId, jwtClaims, newHostId, pkceChallenge, textFromStream } from "./chatgpt";

const jwt = (claims: object) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.y`;

describe("ChatGPT sign-in helpers", () => {
  it("builds the documented authorization request", () => {
    const url = new URL(
      authorizeUrl({
        clientId: null,
        hostId: "urn:uuid:00000000-0000-4000-8000-000000000001",
        redirectUri: "http://127.0.0.1:1455/auth/callback",
        state: "s",
        nonce: "n",
        challenge: "c",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://auth.openai.com/api/accounts/authorize");
    expect(url.searchParams.get("client_id")).toBe("dynamic_agent_client");
    expect(url.searchParams.get("agent_name_hint")).toBe("Aaina Desktop");
    expect(url.searchParams.get("scope")).toBe("openid profile email offline_access resource.invoke chatgpt.tokens.use.direct");
    expect(url.searchParams.get("resource")).toBe("https://api.openai.com/v1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const again = new URL(
      authorizeUrl({
        clientId: "oaiapp_1",
        hostId: "urn:uuid:00000000-0000-4000-8000-000000000001",
        redirectUri: "r",
        state: "s",
        nonce: "n",
        challenge: "c",
      }),
    );
    expect(again.searchParams.get("client_id")).toBe("oaiapp_1");
    expect(again.searchParams.has("agent_name_hint")).toBe(false);
  });
  it("PKCE S256 matches the RFC 7636 example", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("reads the streamed answer", () => {
    const s = `data: {"type":"response.output_text.delta","delta":"{\\"a\\":"}\n\ndata: {"type":"response.output_text.delta","delta":"1}"}\n\ndata: {"type":"response.completed","response":{"output":[{"type":"message","content":[{"type":"output_text","text":"{\\"a\\":1}"}]}]}}\n\n`;
    expect(firstJsonObject(textFromStream(s))).toEqual({ a: 1 });
    expect(() => textFromStream(`data: {"type":"response.failed","response":{"error":{"code":"usage"}}}\n`)).toThrow("usage");
    expect(() => textFromStream("")).toThrow();
  });
  it("decodes id token claims", () => {
    expect(jwtClaims(jwt({ email: "a@b.c" })).email).toBe("a@b.c");
    expect(jwtClaims("nope")).toEqual({});
  });
  it("says it isn't available when the app has no loopback listener", async () => {
    const store = new Map<string, string>();
    const c = createChatGPT({
      secrets: {
        get: async (n) => store.get(n) ?? null,
        set: async (n, v) => void store.set(n, v),
        delete: async (n) => void store.delete(n),
      },
      invoke: async () => {
        throw new Error("unknown command");
      },
    });
    await expect(c.signIn()).rejects.toThrow("ChatGPT sign-in isn't available yet");
    expect((await c.status()).signedIn).toBe(false);
  });
  it("completes a sign-in with a fake browser and stores tokens", async () => {
    const store = new Map<string, string>();
    let state = "";
    const exchanged: string[] = [];
    const c = createChatGPT({
      secrets: {
        get: async (n) => store.get(n) ?? null,
        set: async (n, v) => void store.set(n, v),
        delete: async (n) => void store.delete(n),
      },
      openUrl: async (u) => {
        state = new URL(u).searchParams.get("state")!;
      },
      invoke: async (cmd) => (cmd === "oauth_loopback_start" ? 1455 : `code=abc&state=${state}&client_id=oaiapp_9`),
      fetcher: async (_u, init) => {
        exchanged.push(String(init?.body));
        return new Response(
          JSON.stringify({
            access_token: "at",
            refresh_token: "rt",
            id_token: jwt({ email: "me@x.y", aud: "oaiapp_9", sub: "u1", exp: 9999999999 }),
            scope: "openid offline_access chatgpt.tokens.use.direct",
            expires_in: 3600,
          }),
        );
      },
    });
    expect(await c.signIn()).toMatchObject({ email: "me@x.y" });
    expect(exchanged[0]).toContain("grant_type=authorization_code");
    expect(exchanged[0]).toContain("code_verifier=");
    expect(exchanged[0]).not.toContain("client_secret");
    expect((await c.status()).signedIn).toBe(true);
    await c.signOut();
    expect(store.has("chatgpt_tokens")).toBe(false); // only the host id is kept
  });
});

describe("host id", () => {
  it("is a urn:uuid OpenAI accepts, and bare or malformed ids are not", () => {
    expect(isHostId(newHostId())).toBe(true);
    expect(isHostId("1e29403f-7201-4668-8f57-ebab9935e543")).toBe(false);
    expect(isHostId("urn:uuid:nope")).toBe(false);
    expect(isHostId(undefined)).toBe(false);
  });
});
