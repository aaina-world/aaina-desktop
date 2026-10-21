import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAI, bytesToB64, type Fetcher } from "./openai";

const png = (() => {
  const b = new Uint8Array(200);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b;
})();
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
const client = (fetcher: Fetcher, extra: object = {}) =>
  createOpenAI({ getKey: async () => "sk-test", retryDelaysMs: [0, 0, 0], fetcher, ...extra });
const queued =
  (items: Array<Response | Error>, seen: string[] = []): Fetcher =>
  async (url) => {
    seen.push(url);
    const next = items.shift()!;
    if (next instanceof Error) throw next;
    return next;
  };
const img = { bytes: png, mime: "image/png" };
const edit = { prompt: "p", images: [img], size: "1536x1536" as const, quality: "standard" as const };

afterEach(() => vi.restoreAllMocks());

describe("what OpenAI can answer, and what the person is told", () => {
  it.each([
    [401, {}, "KEY_REFUSED", "no"],
    [403, { error: { message: "Your organization must be verified" } }, "VERIFY_ORGANIZATION", "no"],
    [403, { error: { message: "no access" } }, "KEY_REFUSED", "no"],
    [429, { error: { code: "insufficient_quota" } }, "OUT_OF_CREDIT", "no"],
    [400, { error: { message: "billing_hard_limit_reached" } }, "OUT_OF_CREDIT", "no"],
    [400, { error: { code: "moderation_blocked" } }, "CONTENT_REFUSED", "no"],
    [500, { error: { message: "oops" } }, "UNKNOWN", "maybe"],
    [502, "<html>bad gateway</html>", "UNKNOWN", "maybe"],
  ] as const)("status %i becomes %s (charged %s)", async (status, body, code, charged) => {
    await expect(client(queued([reply(status, body)])).editImage(edit)).rejects.toMatchObject({ code, charged });
  });

  it("a 5xx is not sent again", async () => {
    const seen: string[] = [];
    await expect(client(queued([reply(500, {}), reply(200, {})], seen)).editImage(edit)).rejects.toMatchObject({ code: "UNKNOWN" });
    expect(seen).toHaveLength(1);
  });

  it("waits out a busy 503 as well, honouring Retry-After (capped)", async () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const done = client(
      queued(
        [reply(503, { error: { message: "slow down" } }, { "retry-after": "2" }), reply(200, { data: [{ b64_json: bytesToB64(png) }] })],
        seen,
      ),
    ).editImage(edit);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await done).length).toBe(200);
    expect(seen).toHaveLength(2);
    vi.useRealTimers();
  });

  it("an aborted or timed-out paid request is INTERRUPTED (maybe charged), never repeated", async () => {
    for (const name of ["AbortError", "TimeoutError"]) {
      const seen: string[] = [];
      const err = Object.assign(new Error("signal timed out"), { name });
      await expect(client(queued([err], seen)).editImage(edit)).rejects.toMatchObject({ code: "INTERRUPTED", charged: "maybe" });
      expect(seen).toHaveLength(1);
    }
  });

  it("offline before sending is NETWORK, charged no, and nothing is sent", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const seen: string[] = [];
    await expect(
      client(queued([reply(200, {})], seen)).generateImage({ prompt: "p", size: "1024x1024", quality: "medium" }),
    ).rejects.toMatchObject({ code: "NETWORK", charged: "no" });
    expect(seen).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("the key check: works, refused (401/403), unknown (5xx), NETWORK when it cannot connect", async () => {
    expect(await client(queued([reply(200, {})])).checkKey("sk-a")).toBe("works");
    expect(await client(queued([reply(403, {})])).checkKey("sk-a")).toBe("refused");
    expect(await client(queued([reply(500, {})])).checkKey("sk-a")).toBe("unknown");
    await expect(client(queued([new Error("offline")])).checkKey("sk-a")).rejects.toMatchObject({ code: "NETWORK" });
    await expect(createOpenAI({ getKey: async () => null, fetcher: queued([]) }).checkKey()).rejects.toMatchObject({
      code: "NOT_CONNECTED",
    });
  });
});

describe("pictures and readings", () => {
  const ok = (body: unknown) => reply(200, body);
  it("generateImage asks for a medium picture with JSON, no input pictures", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const f: Fetcher = async (url, init) => (calls.push({ url, init }), ok({ data: [{ b64_json: bytesToB64(png) }] }));
    await client(f).generateImage({ prompt: "a beach", size: "1536x1536", quality: "high" });
    expect(calls[0].url).toBe("https://api.openai.com/v1/images/generations");
    expect(JSON.parse(calls[0].init!.body as string)).toMatchObject({ prompt: "a beach", size: "1536x1536", quality: "high", n: 1 });
  });
  it("a picture that is not a PNG, or is tiny, is BAD_ANSWER (maybe charged)", async () => {
    const tiny = bytesToB64(new Uint8Array([0x89, 0x50, 1, 2]));
    const jpeg = bytesToB64(new Uint8Array(300).fill(1));
    for (const b64 of [tiny, jpeg, 5, ""]) {
      await expect(client(queued([ok({ data: [{ b64_json: b64 }] })])).editImage(edit)).rejects.toMatchObject({
        code: "BAD_ANSWER",
        charged: "maybe",
      });
    }
  });
  it("respondJson: text that is not JSON is BAD_ANSWER; the request carries the schema", async () => {
    const calls: Array<{ init?: RequestInit }> = [];
    const f: Fetcher = async (_u, init) => (
      calls.push({ init }),
      ok({ output: [{ type: "message", content: [{ type: "output_text", text: "not json" }] }] })
    );
    await expect(client(f).respondJson({ prompt: "p", images: [img], schemaName: "n", schema: { type: "object" } })).rejects.toMatchObject({
      code: "BAD_ANSWER",
      charged: "maybe",
    });
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.text.format).toMatchObject({ type: "json_schema", name: "n", strict: true });
    expect(body.input[0].content[1].image_url).toMatch(/^data:image\/png;base64,/);
  });
  it("respondText returns trimmed words, and an empty answer is BAD_ANSWER", async () => {
    const message = (text: string) => ok({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
    expect(await client(queued([message("  hands on hips  ")])).respondText({ prompt: "p" })).toBe("hands on hips");
    await expect(client(queued([message("   ")])).respondText({ prompt: "p" })).rejects.toMatchObject({ code: "BAD_ANSWER" });
    await expect(client(queued([ok({})])).respondText({ prompt: "p" })).rejects.toMatchObject({ code: "BAD_ANSWER" });
  });
});
