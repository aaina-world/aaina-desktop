import { describe, expect, it, vi } from "vitest";
import { engineError } from "./errors";
import type { OpenAI } from "./openai";
import { createWorks } from "./works";

vi.mock("./images", () => ({
  prepareInput: async (bytes: Uint8Array) => ({ bytes, mime: "image/png", width: 1, height: 1 }),
  readingSample: async (bytes: Uint8Array) => ({ bytes, mime: "image/jpeg", width: 1, height: 1 }),
}));

const png = new Uint8Array([1, 2, 3]);
const answer = { label: "Kurta", productType: "kurtas", audience: "women", colour: "blue", material: null, details: null, reach: "upper" };

function fakeOpenai(over: Partial<Record<keyof OpenAI, unknown>> = {}) {
  const calls: Record<string, unknown[]> = { json: [], text: [], edit: [], generate: [] };
  const openai = {
    respondJson: vi.fn(async (i: unknown) => (calls.json.push(i), answer)),
    respondText: vi.fn(async (i: unknown) => (calls.text.push(i), "standing, one hand on hip")),
    editImage: vi.fn(async (i: unknown) => (calls.edit.push(i), new Uint8Array([9]))),
    generateImage: vi.fn(async (i: unknown) => (calls.generate.push(i), new Uint8Array([8]))),
    checkKey: vi.fn(),
    ...over,
  } as unknown as OpenAI;
  return { openai, calls };
}
const works = (o: OpenAI, keyPresent = true, chatgptReader?: () => Promise<((i: never) => Promise<unknown>) | null>) =>
  createWorks(o, { keyPresent: async () => keyPresent, chatgptReader: chatgptReader as never });

describe("readProduct", () => {
  const opts = { productTypes: ["kurtas"], typeNames: [["kurtas", "Kurtas"]] as Array<[string, string]>, productName: "Blue kurta" };
  it("uses the key when ChatGPT is not signed in", async () => {
    const { openai, calls } = fakeOpenai();
    const r = await works(openai).readProduct([png, png, png, png], opts);
    expect(r).toMatchObject({ label: "Kurta", productType: "kurtas", readBy: "key" });
    expect((calls.json[0] as { images: unknown[] }).images).toHaveLength(3); // at most three photos are read
  });
  it("prefers ChatGPT when signed in and says so", async () => {
    const { openai } = fakeOpenai();
    const reader = vi.fn(async () => answer);
    const r = await works(openai, false, async () => reader).readProduct([png], opts);
    expect(r.readBy).toBe("chatgpt");
    expect(openai.respondJson).not.toHaveBeenCalled();
  });
  it("falls back to the key when ChatGPT fails, and to NOT_CONNECTED when there is no key", async () => {
    const failing = async () => (async () => Promise.reject(new Error("401"))) as never;
    const { openai } = fakeOpenai();
    expect((await works(openai, true, failing).readProduct([png], opts)).readBy).toBe("key");
    await expect(works(openai, false, failing).readProduct([png], opts)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  });
  it("refuses a product without photos, and an answer that is not a reading is BAD_ANSWER (maybe charged)", async () => {
    const { openai } = fakeOpenai({ respondJson: vi.fn(async () => ({ nonsense: true })) });
    await expect(works(openai).readProduct([], opts)).rejects.toMatchObject({ code: "UNKNOWN", charged: "no" });
    await expect(works(openai).readProduct([png], opts)).rejects.toMatchObject({ code: "BAD_ANSWER", charged: "maybe" });
  });
});

describe("own poses and scenes", () => {
  it("describes a reference pose in one cleaned, short line", async () => {
    const { openai } = fakeOpenai({ respondText: vi.fn(async () => "  standing,\n\n one hand   on hip  ") });
    expect(await works(openai).readReferencePose(png)).toBe("standing, one hand on hip");
  });
  it("says so plainly when the reference photo shows no person", async () => {
    const { openai } = fakeOpenai({ respondText: vi.fn(async () => "NO_PERSON") });
    await expect(works(openai).readReferencePose(png)).rejects.toMatchObject({ code: "CONTENT_REFUSED", charged: "no" });
  });
  it("makes a pose from the sheet, joining words and the photo's reading", async () => {
    const { openai, calls } = fakeOpenai();
    await works(openai).makePose({ sheet: png, gender: "woman", words: "laughing", reference: png });
    const edit = calls.edit[0] as { prompt: string; size: string };
    expect(edit.size).toBe("1024x1536");
    expect(edit.prompt).toContain("laughing. standing, one hand on hip");
  });
  it("needs words or a photo for a pose", async () => {
    const { openai } = fakeOpenai();
    await expect(works(openai).makePose({ sheet: png, gender: "woman", words: "  " })).rejects.toThrow(/Describe the pose/);
  });
  it("makes a scene from words with generations, or from a photo with edits", async () => {
    const { openai, calls } = fakeOpenai();
    await works(openai).makeScene({ words: "a sunny terrace" });
    expect(calls.generate[0]).toMatchObject({ size: "1536x1536", quality: "medium" });
    await works(openai).makeScene({ words: "like this", reference: png });
    expect(calls.edit[0]).toMatchObject({ size: "1536x1536" });
  });
});

describe("own models", () => {
  const traits = { gender: "woman" as const, age: 30 };
  it("makes three faces one at a time", async () => {
    const { openai, calls } = fakeOpenai();
    const r = await works(openai).makeFaces(traits);
    expect(r.faces).toHaveLength(3);
    expect(r.error).toBeNull();
    expect(calls.generate).toHaveLength(3);
  });
  it("stops at the first failure and returns what was made so far", async () => {
    let n = 0;
    const boom = engineError("INTERRUPTED", "maybe");
    const { openai } = fakeOpenai({ generateImage: vi.fn(async () => (++n === 2 ? Promise.reject(boom) : new Uint8Array([1]))) });
    const r = await works(openai).makeFaces(traits);
    expect(r.faces).toHaveLength(1);
    expect(r.error).toBe(boom);
    expect(n).toBe(2);
  });
  it("makes the sheet from at most three pictures at high quality", async () => {
    const { openai, calls } = fakeOpenai();
    await works(openai).makeSheet({ pictures: [png, png, png, png], traits });
    expect(calls.edit[0]).toMatchObject({ size: "1024x1024", quality: "high" });
    expect((calls.edit[0] as { images: unknown[] }).images).toHaveLength(3);
  });
  it("passes a clean sheet and explains a faulty one", async () => {
    const ok = {
      panels: 6,
      onePersonEach: true,
      samePerson: true,
      extraLimbsOrHands: false,
      textOrLogos: false,
      appearsUnder18: false,
      faults: [],
    };
    expect(await works(fakeOpenai({ respondJson: vi.fn(async () => ok) }).openai).checkSheet(png)).toEqual({ pass: true, faults: [] });
    const bad = { ...ok, extraLimbsOrHands: true, faults: ["extra hand", 5, "b", "c", "d", "e", "f", "g"] };
    const r = await works(fakeOpenai({ respondJson: vi.fn(async () => bad) }).openai).checkSheet(png);
    expect(r.pass).toBe(false);
    expect(r.faults).toHaveLength(6);
    const silent = { ...ok, panels: 4, faults: undefined };
    expect((await works(fakeOpenai({ respondJson: vi.fn(async () => silent) }).openai).checkSheet(png)).faults).toHaveLength(1);
  });
});

describe("checkPersonPhoto", () => {
  const good = { onePerson: true, faceClear: true, adult: true, publicFigure: false, reason: "", gender: "man", ageYears: 41 };
  const run = (reply: unknown) => works(fakeOpenai({ respondJson: vi.fn(async () => reply) }).openai).checkPersonPhoto(png, "front");
  it("accepts a clear adult and reports gender and age", async () => {
    expect(await run(good)).toEqual({ problem: null, gender: "man", age: 41 });
  });
  it("keeps the age between 18 and 90 and defaults to a woman of 30", async () => {
    expect((await run({ ...good, ageYears: 5 })).age).toBe(18);
    expect((await run({ ...good, ageYears: 140 })).age).toBe(90);
    expect(await run({ ...good, gender: undefined, ageYears: undefined })).toMatchObject({ gender: "woman", age: 30 });
  });
  it("returns the plain problem for a public figure, a minor, or several people", async () => {
    expect((await run({ ...good, publicFigure: true })).problem).toMatch(/public figure/);
    expect((await run({ ...good, adult: false })).problem).toMatch(/18/);
    expect((await run({ ...good, onePerson: false })).problem).toMatch(/one real person/);
  });
  it("refuses when the check cannot run: an unusable answer, or a failure that is not about the key", async () => {
    await expect(run({ ...good, adult: "yes" })).rejects.toMatchObject({ code: "UNKNOWN", charged: "no" });
    const failing = fakeOpenai({ respondJson: vi.fn(async () => Promise.reject(new Error("socket"))) }).openai;
    await expect(works(failing).checkPersonPhoto(png, "other")).rejects.toThrow(/could not run/);
  });
  it("lets key problems through so the person can fix the key", async () => {
    const refused = fakeOpenai({ respondJson: vi.fn(async () => Promise.reject(engineError("KEY_REFUSED"))) }).openai;
    await expect(works(refused).checkPersonPhoto(png, "front")).rejects.toMatchObject({ code: "KEY_REFUSED" });
  });
});

describe("who reads: ChatGPT when signed in, else the OpenAI key", () => {
  const sheetAnswer = {
    panels: 6,
    onePersonEach: true,
    samePerson: true,
    extraLimbsOrHands: false,
    textOrLogos: false,
    appearsUnder18: false,
    faults: [],
  };
  const photoAnswer = { onePerson: true, faceClear: true, adult: true, publicFigure: false, gender: "woman", ageYears: 31 };

  it("sends every reading to ChatGPT when signed in, and none to the key", async () => {
    const { openai } = fakeOpenai();
    const asked: Array<{ schemaName?: string }> = [];
    const reader = vi.fn(async (i: { schemaName?: string }) => {
      asked.push(i);
      if (!i.schemaName) return "walking toward the camera";
      return i.schemaName === "aaina_sheet_check" ? sheetAnswer : i.schemaName === "aaina_own_model_photo_check" ? photoAnswer : answer;
    });
    const w = works(openai, true, async () => reader);
    expect((await w.readProduct([png], { productTypes: null })).readBy).toBe("chatgpt");
    expect(await w.readReferencePose(png)).toBe("walking toward the camera");
    expect((await w.checkSheet(png)).pass).toBe(true);
    expect((await w.checkPersonPhoto(png, "front")).problem).toBeNull();
    expect(asked.map((i) => i.schemaName ?? "text")).toEqual([
      "aaina_product_reading",
      "text",
      "aaina_sheet_check",
      "aaina_own_model_photo_check",
    ]);
    expect(openai.respondJson).not.toHaveBeenCalled();
    expect(openai.respondText).not.toHaveBeenCalled();
  });

  it("uses the key for every reading when ChatGPT is not signed in, or when it fails", async () => {
    for (const reader of [undefined, async () => (async () => Promise.reject(new Error("503"))) as never]) {
      const { openai } = fakeOpenai({
        respondJson: vi.fn(async (i: { schemaName: string }) =>
          i.schemaName === "aaina_sheet_check" ? sheetAnswer : i.schemaName === "aaina_own_model_photo_check" ? photoAnswer : answer,
        ),
      });
      const w = works(openai, true, reader);
      expect((await w.readProduct([png], { productTypes: null })).readBy).toBe("key");
      await w.readReferencePose(png);
      await w.checkSheet(png);
      await w.checkPersonPhoto(png, "front");
      expect(openai.respondJson).toHaveBeenCalledTimes(3);
      expect(openai.respondText).toHaveBeenCalledTimes(1);
    }
  });

  it("making pictures always uses the key, signed in or not", async () => {
    const { openai } = fakeOpenai();
    const reader = vi.fn(async () => "walking");
    const w = works(openai, true, async () => reader);
    await w.makeScene({ words: "a beach" });
    await w.makeFaces({ gender: "woman", age: 30 } as never, 1);
    expect(openai.generateImage).toHaveBeenCalledTimes(2);
    expect(reader).not.toHaveBeenCalled();
  });
});
