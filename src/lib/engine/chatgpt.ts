/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument --
   OpenAI and ChatGPT replies are untrusted JSON of a shape we do not own; every field is read defensively (?. and ??) and validated at the use site. */
// "Sign in with ChatGPT" for open-source, locally run apps, as OpenAI documents it (developers.openai.com/siwc/token-sharing-open-source/*):
// OAuth 2.0 authorization code + PKCE (S256) against auth.openai.com, a loopback redirect on 127.0.0.1, no client secret.
// The access token is accepted by the public Responses API for eligible requests; image generation is NOT supported, so it is used
// only for product readings (text and photos in, JSON out).
import type { Img } from "./openai";
import { dataUrl } from "./openai";

const AUTHORIZE = "https://auth.openai.com/api/accounts/authorize";
const TOKEN = "https://auth.openai.com/api/accounts/oauth/token";
const RESOURCE = "https://api.openai.com/v1";
const SCOPE = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const REGISTRATION_ID = "dynamic_agent_client";
const CALLBACK_PATH = "/auth/callback";
const AGENT_NAME = "Aaina Desktop";

export type StoredTokens = {
  clientId: string;
  hostId: string;
  email: string | null;
  plan: string | null;
  subject: string | null;
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  scopes: string[];
  expiresAt: number;
  savedAt: string;
};

// ---------- pure helpers (tested) ----------
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

export function authorizeUrl(p: {
  clientId: string | null;
  hostId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
  loginHint?: string | null;
}): string {
  const q = new URLSearchParams({
    client_id: p.clientId ?? REGISTRATION_ID,
    ext_agent_host_id: p.hostId,
    response_type: "code",
    redirect_uri: p.redirectUri,
    scope: SCOPE,
    resource: RESOURCE,
    state: p.state,
    nonce: p.nonce,
    code_challenge_method: "S256",
    code_challenge: p.challenge,
  });
  if (!p.clientId) q.set("agent_name_hint", AGENT_NAME);
  if (p.loginHint) q.set("login_hint", p.loginHint);
  return `${AUTHORIZE}?${q.toString()}`;
}

export function jwtClaims(token: string | null | undefined): Record<string, any> {
  try {
    const part = token?.split(".")[1];
    if (!part) return {};
    const json = atob(
      part
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(part.length / 4) * 4, "="),
    );
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
  } catch {
    return {};
  }
}

/** Text of a streamed Responses reply (`data: {json}` lines): the completed response's text, or the joined deltas. Throws on failure events. */
export function textFromStream(stream: string): string {
  let deltas = "";
  let completed: string | null = null;
  for (const line of stream.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") continue;
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") deltas += event.delta;
    else if (event.type === "response.failed" || event.type === "response.incomplete")
      throw new Error(event.response?.error?.code ?? event.type);
    else if (event.type === "response.completed") {
      completed = (event.response?.output ?? [])
        .filter((o: any) => o.type === "message")
        .flatMap((o: any) => o.content ?? [])
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text)
        .join("");
    }
  }
  if (completed === null && !deltas) throw new Error("interrupted");
  return completed ?? deltas;
}

/** The first JSON object in some text. */
export function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

// ---------- the client ----------
type SecretsLike = {
  get(name: "chatgpt_tokens"): Promise<string | null>;
  set(name: "chatgpt_tokens", value: string): Promise<void>;
  delete(name: "chatgpt_tokens"): Promise<void>;
};
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type ChatGPTDeps = {
  secrets: SecretsLike;
  fetcher?: Fetcher;
  /** Tauri `invoke`; only the loopback commands are used. */
  invoke?: (command: string, args?: Record<string, unknown>) => Promise<any>;
  openUrl?: (url: string) => Promise<void>;
  now?: () => number;
};

export function createChatGPT(deps: ChatGPTDeps) {
  const now = deps.now ?? (() => Date.now());
  let fetcher: Promise<Fetcher> | null = null;
  const getFetch = () =>
    (fetcher ??= deps.fetcher
      ? Promise.resolve(deps.fetcher)
      : import("@tauri-apps/plugin-http").then((m) => m.fetch as unknown as Fetcher));
  const invoke = async (command: string, args?: Record<string, unknown>) =>
    deps.invoke ? deps.invoke(command, args) : (await import("@tauri-apps/api/core")).invoke(command, args);
  const open = async (url: string) => (deps.openUrl ? deps.openUrl(url) : (await import("@tauri-apps/plugin-opener")).openUrl(url));

  let cached: StoredTokens | null | undefined;
  async function load(): Promise<StoredTokens | null> {
    if (cached !== undefined) return cached;
    const text = await deps.secrets.get("chatgpt_tokens");
    try {
      cached = text ? (JSON.parse(text) as StoredTokens) : null;
    } catch {
      cached = null;
    }
    return cached;
  }
  async function save(t: StoredTokens | null) {
    cached = t;
    if (t) await deps.secrets.set("chatgpt_tokens", JSON.stringify(t));
    else await deps.secrets.delete("chatgpt_tokens");
  }

  async function tokenRequest(form: Record<string, string>): Promise<any> {
    const f = await getFetch();
    const r = await f(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const json: any = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(json?.error ?? `HTTP ${r.status}`), { grant: json?.error });
    return json;
  }

  function fromTokenResponse(
    json: any,
    base: Partial<StoredTokens> & { clientId: string; hostId: string },
    expectedNonce?: string,
  ): StoredTokens {
    const claims = jwtClaims(json.id_token);
    if (json.id_token) {
      if (claims.aud && claims.aud !== base.clientId && !(Array.isArray(claims.aud) && claims.aud.includes(base.clientId)))
        throw new Error("The sign-in answer was not for this app.");
      if (expectedNonce && claims.nonce && claims.nonce !== expectedNonce) throw new Error("The sign-in answer did not match the request.");
      if (typeof claims.exp === "number" && claims.exp * 1000 < now() - 60_000) throw new Error("The sign-in answer has expired.");
    }
    const scopes = String(json.scope ?? base.scopes?.join(" ") ?? "")
      .split(/\s+/)
      .filter(Boolean);
    const auth = claims["https://api.openai.com/auth"] ?? {};
    return {
      clientId: base.clientId,
      hostId: base.hostId,
      email: claims.email ?? base.email ?? null,
      plan: auth.chatgpt_plan_type ?? base.plan ?? null,
      subject: claims.sub ?? base.subject ?? null,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? base.refreshToken ?? null,
      idToken: json.id_token ?? base.idToken ?? null,
      scopes,
      expiresAt: now() + (Number(json.expires_in) || 3600) * 1000,
      savedAt: new Date(now()).toISOString(),
    };
  }

  /** Opens the browser, waits for the loopback callback and keeps the tokens in the keychain. */
  async function signIn(): Promise<{ email: string | null; plan: string | null }> {
    const previous = await load();
    const hostId = previous?.hostId ?? crypto.randomUUID();
    let port: number;
    try {
      port = Number(await invoke("oauth_loopback_start", { path: CALLBACK_PATH }));
    } catch {
      throw new Error("ChatGPT sign-in isn't available yet");
    }
    const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;
    const verifier = randomToken(48),
      state = randomToken(16),
      nonce = randomToken(16);
    await open(
      authorizeUrl({
        clientId: previous?.clientId ?? null,
        hostId,
        redirectUri,
        state,
        nonce,
        challenge: await pkceChallenge(verifier),
        loginHint: previous?.email,
      }),
    );
    const query = String(await invoke("oauth_loopback_wait", { timeoutSecs: 300 }));
    const q = new URLSearchParams(query.replace(/^\?/, ""));
    if (q.get("state") !== state) throw new Error("The sign-in answer did not match the request.");
    if (q.get("error")) throw new Error(q.get("error") === "access_denied" ? "Sign-in was cancelled." : "ChatGPT sign-in failed.");
    const code = q.get("code");
    const clientId = q.get("client_id") ?? previous?.clientId;
    if (!code || !clientId) throw new Error("ChatGPT sign-in did not finish.");
    if (previous?.clientId && q.get("client_id") && q.get("client_id") !== previous.clientId)
      throw new Error("The sign-in answer was not for this app.");
    const json = await tokenRequest({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource: RESOURCE,
    });
    const tokens = fromTokenResponse(json, { clientId, hostId }, nonce);
    if (!tokens.scopes.includes("chatgpt.tokens.use.direct")) throw new Error("Your ChatGPT plan can't be used by this app.");
    await save(tokens);
    return { email: tokens.email, plan: tokens.plan };
  }

  let refreshing: Promise<StoredTokens> | null = null;
  async function fresh(): Promise<StoredTokens | null> {
    const t = await load();
    if (!t) return null;
    if (t.expiresAt - now() > 120_000) return t;
    if (!t.refreshToken) {
      await save(null);
      return null;
    }
    refreshing ??= (async () => {
      try {
        const json = await tokenRequest({
          grant_type: "refresh_token",
          client_id: t.clientId,
          refresh_token: t.refreshToken!,
          resource: RESOURCE,
        });
        const next = fromTokenResponse(json, t);
        await save(next);
        return next;
      } finally {
        refreshing = null;
      }
    })();
    try {
      return await refreshing;
    } catch (e) {
      if ((e as { grant?: string }).grant === "invalid_grant") await save(null); // the session ended: sign in again
      return null;
    }
  }

  async function signOut(): Promise<void> {
    const t = await load();
    if (t?.refreshToken) {
      try {
        const f = await getFetch();
        const config: any = await (await f("https://auth.openai.com/.well-known/openid-configuration")).json();
        if (config?.revocation_endpoint)
          await f(config.revocation_endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: t.refreshToken, token_type_hint: "refresh_token", client_id: t.clientId }).toString(),
          });
      } catch {
        /* cleared locally anyway */
      }
    }
    await save(null);
  }

  async function status(): Promise<{ signedIn: boolean; email: string | null; plan: string | null }> {
    const t = await load();
    return { signedIn: !!t, email: t?.email ?? null, plan: t?.plan ?? null };
  }

  let modelSlug: string | null = null;
  async function pickModel(token: string): Promise<string> {
    if (modelSlug) return modelSlug;
    const f = await getFetch();
    const r = await f(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${token}` } });
    const json: any = await r.json().catch(() => ({}));
    const list: any[] = (json.models ?? []).filter((m: any) => m.visibility === "list");
    const slug = (list.find((m) => /luna/.test(m.slug)) ?? list[0])?.slug;
    if (!slug) throw new Error("No model is available for your ChatGPT plan.");
    return (modelSlug = slug);
  }

  /** The reading reader: streamed Responses call on the signed-in plan; returns the first JSON object in the answer. */
  async function readJson<T>(input: { prompt: string; images?: Img[] }): Promise<T> {
    const t = await fresh();
    if (!t) throw new Error("Sign in with ChatGPT again.");
    const model = await pickModel(t.accessToken);
    const f = await getFetch();
    const content: unknown[] = [
      { type: "input_text", text: `${input.prompt}\nAnswer with only one JSON object and nothing else.` },
      ...(input.images ?? []).map((im) => ({ type: "input_image", image_url: dataUrl(im) })),
    ];
    const r = await f(`${RESOURCE}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: [{ role: "user", content }], store: false, stream: true }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`ChatGPT answered ${r.status}`);
    return firstJsonObject(textFromStream(await r.text())) as T;
  }

  return { signIn, signOut, status, readJson, signedIn: async () => (await load()) !== null };
}
export type ChatGPT = ReturnType<typeof createChatGPT>;
