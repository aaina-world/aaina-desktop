import { describe, expect, it, vi } from "vitest";
import { errorFromReply } from "./errors";
import { bytesToB64, createOpenAI, b64ToBytes } from "./openai";

const png = (() => {
  const b = new Uint8Array(200);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b;
})();
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const make = (responses: Array<Response | Error>, calls: Array<{ url: string; init?: RequestInit }> = []) =>
  createOpenAI({
    getKey: async () => "sk-test",
    retryDelaysMs: [0, 0, 0],
    fetcher: async (url, init) => {
      calls.push({ url, init });
      const r = responses.shift()!;
      if (r instanceof Error) throw r;
      return r;
    },
  });
const input = { prompt: "p", images: [{ bytes: png, mime: "image/png" }], size: "1536x1536" as const, quality: "standard" as const };

describe("error mapping", () => {
  it("maps statuses", () => {
    expect(errorFromReply(401, {}).code).toBe("KEY_REFUSED");
    expect(errorFromReply(403, { error: { message: "Your organization must be verified to use this model" } }).code).toBe(
      "VERIFY_ORGANIZATION",
    );
    expect(errorFromReply(429, { error: { code: "insufficient_quota" } }).code).toBe("OUT_OF_CREDIT");
    expect(errorFromReply(429, { error: { code: "rate_limit_exceeded" } }).code).toBe("RATE_LIMITED");
    expect(errorFromReply(400, { error: { code: "moderation_blocked" } })).toMatchObject({ code: "CONTENT_REFUSED", charged: "no" });
    expect(errorFromReply(500, {})).toMatchObject({ code: "UNKNOWN", charged: "maybe" });
  });
});

describe("openai client", () => {
  it("returns the picture and sends several images in one multipart request", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const c = make([reply(200, { data: [{ b64_json: bytesToB64(png) }] })], calls);
    const out = await c.editImage({ ...input, images: [input.images[0], input.images[0]] });
    expect(out.length).toBe(200);
    expect(calls[0].url).toBe("https://api.openai.com/v1/images/edits");
    const form = calls[0].init!.body as FormData;
    expect(form.getAll("image[]").length).toBe(2);
    expect(form.get("quality")).toBe("medium");
    expect(form.get("size")).toBe("1536x1536");
  });
  it("waits and retries a busy 429 up to 3 times, then RATE_LIMITED", async () => {
    const busy = () => reply(429, { error: { code: "rate_limit_exceeded" } });
    const calls: Array<{ url: string }> = [];
    await expect(make([busy(), busy(), busy(), busy()], calls).editImage(input)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      charged: "no",
    });
    expect(calls.length).toBe(4);
    const ok = make([busy(), reply(200, { data: [{ b64_json: bytesToB64(png) }] })]);
    expect((await ok.editImage(input)).length).toBe(200);
  });
  it("does not retry out-of-credit, key refused or a refusal", async () => {
    for (const [r, code] of [
      [reply(429, { error: { code: "insufficient_quota" } }), "OUT_OF_CREDIT"],
      [reply(401, {}), "KEY_REFUSED"],
      [reply(400, { error: { code: "moderation_blocked" } }), "CONTENT_REFUSED"],
    ] as const) {
      const calls: unknown[] = [];
      await expect(make([r], calls as never).editImage(input)).rejects.toMatchObject({ code });
      expect(calls.length).toBe(1);
    }
  });
  it("200 without a usable picture is BAD_ANSWER (maybe charged)", async () => {
    await expect(make([reply(200, { data: [] })]).editImage(input)).rejects.toMatchObject({ code: "BAD_ANSWER", charged: "maybe" });
  });
  it("a request lost after sending is INTERRUPTED and never repeated; an early connect failure is NETWORK", async () => {
    const calls: unknown[] = [];
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const slow = createOpenAI({
      getKey: async () => "k",
      retryDelaysMs: [0],
      fetcher: async () => {
        calls.push(1);
        clock += 4100; // the request ran for over four seconds before it dropped
        throw new Error("error sending request: connection reset");
      },
    });
    await expect(slow.editImage(input)).rejects.toMatchObject({ code: "INTERRUPTED", charged: "maybe" });
    vi.restoreAllMocks();
    expect(calls.length).toBe(1);
    await expect(make([new Error("dns error: failed to lookup address")]).editImage(input)).rejects.toMatchObject({
      code: "NETWORK",
      charged: "no",
    });
  });
  it("no key means NOT_CONNECTED; the free key check reads /v1/models", async () => {
    await expect(createOpenAI({ getKey: async () => null }).editImage(input)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
    const calls: Array<{ url: string }> = [];
    expect(await make([reply(200, { data: [] })], calls as never).checkKey("sk-x")).toBe("works");
    expect(calls[0].url).toBe("https://api.openai.com/v1/models");
    expect(await make([reply(401, {})]).checkKey("sk-x")).toBe("refused");
  });
  it("parses a JSON reading from the Responses output", async () => {
    const body = { output: [{ type: "message", content: [{ type: "output_text", text: '{"label":"Tee"}' }] }] };
    expect(await make([reply(200, body)]).respondJson({ prompt: "p", schemaName: "x", schema: {} })).toEqual({ label: "Tee" });
  });
  it("base64 round trip", () => {
    expect(b64ToBytes(bytesToB64(png))).toEqual(png);
  });
});
