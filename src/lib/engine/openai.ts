/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument --
   OpenAI and ChatGPT replies are untrusted JSON of a shape we do not own; every field is read defensively (?. and ??) and validated at the use site. */
// A small client for api.openai.com over the Tauri http plugin. Only this file talks to OpenAI.
import { EngineError, engineError, errorFromReply, isBusyReply } from "./errors";
import type { Quality } from "../contract";

/** Model ids, as Aaina uses them (packages/providers/src/openai-runtime.ts). Never shown on screen. */
export const IMAGE_MODEL = "gpt-image-2.5-sunburst";
export const READER_MODEL = "gpt-6-luna";
const BASE = "https://api.openai.com/v1";

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type Img = { bytes: Uint8Array; mime: string };
export type Size = "1024x1024" | "1536x1536" | "1024x1536" | "1536x1024";

export type OpenAIOptions = {
  getKey: () => Promise<string | null>;
  /** Defaults to the Tauri http plugin's fetch. */
  fetcher?: Fetcher;
  /** Waits between rate-limit retries (ms); tests pass [0,0,0]. */
  retryDelaysMs?: number[];
  imageTimeoutMs?: number;
  textTimeoutMs?: number;
};

const bodyBytes = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const extOf = (mime: string) => (mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp");

export function qualityWord(q: Quality): "medium" | "high" {
  return q === "high" ? "high" : "medium";
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const dataUrl = (img: Img) => `data:${img.mime};base64,${bytesToB64(img.bytes)}`;

export function createOpenAI(options: OpenAIOptions) {
  const delays = options.retryDelaysMs ?? [5000, 15000, 30000];
  let fetcherPromise: Promise<Fetcher> | null = null;
  const fetcher = (): Promise<Fetcher> =>
    (fetcherPromise ??= options.fetcher
      ? Promise.resolve(options.fetcher)
      : import("@tauri-apps/plugin-http").then((m) => m.fetch as unknown as Fetcher));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function key(): Promise<string> {
    const k = await options.getKey();
    if (!k) throw engineError("NOT_CONNECTED");
    return k;
  }

  /**
   * One request with the rules for money: a 429/503 "busy" reply was refused before any work, so it is waited out and asked again
   * (up to 3 times). A request lost after it was sent is INTERRUPTED (maybe charged) and never repeated here.
   * `paid` only changes how a lost connection is described.
   */
  async function call(url: string, make: () => RequestInit, timeoutMs: number, paid: boolean): Promise<{ status: number; json: any }> {
    const f = await fetcher();
    for (let attempt = 0; ; attempt++) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) throw engineError("NETWORK");
      const started = Date.now();
      let response: Response;
      try {
        response = await f(url, { ...make(), signal: AbortSignal.timeout(timeoutMs) });
      } catch (e) {
        const msg = String((e as Error)?.message ?? e).toLowerCase();
        const early = Date.now() - started < 4000 && /dns|resolve|connect|offline|unreachable|refused|tls|certificate/.test(msg);
        if (early || !paid) throw engineError("NETWORK");
        throw engineError("INTERRUPTED", "maybe");
      }
      let json: any = null;
      try {
        json = await response.json();
      } catch {
        /* not JSON */
      }
      if (response.ok) return { status: response.status, json };
      if (isBusyReply(response.status, json) && attempt < delays.length) {
        const header = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(header) && header > 0 ? Math.min(header, 30) * 1000 : delays[attempt]);
        continue;
      }
      throw errorFromReply(response.status, json);
    }
  }

  const authed = async (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${await key()}`, ...extra });

  /** The free key check (GET /v1/models). */
  async function checkKey(candidate?: string): Promise<"works" | "refused" | "unknown"> {
    const k = candidate ?? (await key());
    const f = await fetcher();
    try {
      const r = await f(`${BASE}/models`, { headers: { Authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return "works";
      return r.status === 401 || r.status === 403 ? "refused" : "unknown";
    } catch {
      throw engineError("NETWORK");
    }
  }

  function pictureFrom(json: any): Uint8Array {
    const b64 = json?.data?.[0]?.b64_json;
    if (typeof b64 !== "string" || !b64) throw engineError("BAD_ANSWER", "maybe");
    const bytes = b64ToBytes(b64);
    // PNG signature
    if (bytes.length < 100 || bytes[0] !== 0x89 || bytes[1] !== 0x50) throw engineError("BAD_ANSWER", "maybe");
    return bytes;
  }

  /** images/edits with several input pictures (image 1 first). */
  async function editImage(input: { prompt: string; images: Img[]; size: Size; quality: Quality }): Promise<Uint8Array> {
    const headers = await authed();
    const { json } = await call(
      `${BASE}/images/edits`,
      () => {
        const form = new FormData();
        form.set("model", IMAGE_MODEL);
        form.set("prompt", input.prompt);
        form.set("size", input.size);
        form.set("quality", qualityWord(input.quality));
        form.set("output_format", "png");
        form.set("n", "1");
        input.images.forEach((img, i) =>
          form.append("image[]", new Blob([bodyBytes(img.bytes)], { type: img.mime }), `reference-${i + 1}.${extOf(img.mime)}`),
        );
        return { method: "POST", headers, body: form };
      },
      options.imageTimeoutMs ?? 300_000,
      true,
    );
    return pictureFrom(json);
  }

  /** images/generations (no input picture). */
  async function generateImage(input: { prompt: string; size: Size; quality: Quality | "medium" }): Promise<Uint8Array> {
    const headers = await authed({ "Content-Type": "application/json" });
    const q = input.quality === "high" ? "high" : "medium";
    const { json } = await call(
      `${BASE}/images/generations`,
      () => ({
        method: "POST",
        headers,
        body: JSON.stringify({ model: IMAGE_MODEL, prompt: input.prompt, size: input.size, quality: q, output_format: "png", n: 1 }),
      }),
      options.imageTimeoutMs ?? 300_000,
      true,
    );
    return pictureFrom(json);
  }

  /** A strict-JSON answer from the reading model (Responses API), with optional pictures. */
  async function respondJson<T>(input: {
    prompt: string;
    images?: Img[];
    schemaName: string;
    schema: unknown;
    effort?: "none" | "low" | "medium";
    maxTokens?: number;
  }): Promise<T> {
    const headers = await authed({ "Content-Type": "application/json" });
    const content: unknown[] = [
      { type: "input_text", text: input.prompt },
      ...(input.images ?? []).map((im) => ({ type: "input_image", image_url: dataUrl(im) })),
    ];
    const { json } = await call(
      `${BASE}/responses`,
      () => ({
        method: "POST",
        headers,
        body: JSON.stringify({
          model: READER_MODEL,
          reasoning: { effort: input.effort ?? "low" },
          input: [{ role: "user", content }],
          max_output_tokens: input.maxTokens ?? 1500,
          text: { format: { type: "json_schema", name: input.schemaName, strict: true, schema: input.schema } },
        }),
      }),
      options.textTimeoutMs ?? 90_000,
      true,
    );
    const text = (json?.output ?? [])
      .filter((o: any) => o.type === "message")
      .flatMap((o: any) => o.content ?? [])
      .filter((c: any) => c.type === "output_text")
      .map((c: any) => c.text)
      .join("");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw engineError("BAD_ANSWER", "maybe");
    }
  }

  /** Plain words from the reading model (a pose described from a photo). */
  async function respondText(input: { prompt: string; images?: Img[]; maxTokens?: number }): Promise<string> {
    const headers = await authed({ "Content-Type": "application/json" });
    const content: unknown[] = [
      { type: "input_text", text: input.prompt },
      ...(input.images ?? []).map((im) => ({ type: "input_image", image_url: dataUrl(im) })),
    ];
    const { json } = await call(
      `${BASE}/responses`,
      () => ({
        method: "POST",
        headers,
        body: JSON.stringify({
          model: READER_MODEL,
          reasoning: { effort: "low" },
          input: [{ role: "user", content }],
          max_output_tokens: input.maxTokens ?? 600,
        }),
      }),
      options.textTimeoutMs ?? 90_000,
      true,
    );
    const text = (json?.output ?? [])
      .filter((o: any) => o.type === "message")
      .flatMap((o: any) => o.content ?? [])
      .filter((c: any) => c.type === "output_text")
      .map((c: any) => c.text)
      .join("")
      .trim();
    if (!text) throw engineError("BAD_ANSWER", "maybe");
    return text;
  }

  return { checkKey, editImage, generateImage, respondJson, respondText };
}

export type OpenAI = ReturnType<typeof createOpenAI>;
export { EngineError };
