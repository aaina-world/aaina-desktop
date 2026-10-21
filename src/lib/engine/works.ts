// Single paid works that are not queued photos: product reading, own poses and scenes, own models (faces, sheet, checks).
import { logInfo, logWarning } from "../log";
import type { ProductReading } from "../contract";
import { engineError, isEngineError } from "./errors";
import { prepareInput, readingSample } from "./images";
import type { Img, OpenAI } from "./openai";
import {
  NO_PERSON_SENTINEL,
  REFERENCE_POSE_INSTRUCTION,
  REFERENCE_POSE_MAX,
  modelFacePrompt,
  modelSheetFromPicturesPrompt,
  ownModelPhotoPrompt,
  ownModelPhotoProblem,
  ownModelPhotoSchema,
  readingFromAnswer,
  readingPrompt,
  readingSchema,
  scenePrompt,
  sheetCheckPasses,
  sheetCheckPrompt,
  sheetCheckSchema,
  sheetPosePrompt,
  type OwnModelPhotoCheck,
  type SheetCheck,
  type Traits,
} from "./prompts";

/**
 * A signed-in ChatGPT plan reading photos and words: a JSON object (`schema` given) or plain text. Every reading in the app
 * (product, a pose in a photo, the sheet check, a real person's photo check) goes to ChatGPT first when signed in, and to
 * the OpenAI key when not signed in or when ChatGPT can't answer. Making pictures always needs the key.
 */
export type JsonReader = (input: { prompt: string; images: Img[]; schemaName?: string; schema?: unknown }) => Promise<unknown>;
export type ReadBy = "chatgpt" | "key";

export function createWorks(
  openai: OpenAI,
  options: { chatgptReader?: () => Promise<JsonReader | null>; keyPresent: () => Promise<boolean> },
) {
  const sample = async (bytes: Uint8Array, side?: number): Promise<Img> => {
    const s = await readingSample(bytes, side);
    return { bytes: s.bytes, mime: s.mime };
  };
  /**
   * One reading, by ChatGPT when signed in and by the key otherwise (or when ChatGPT fails; the reason is logged, never a
   * token). `key` is how the key reads it: a JSON answer with its own options, or text.
   */
  async function read<T>(
    input: { prompt: string; images: Img[]; schemaName?: string; schema?: unknown; what: string },
    key: () => Promise<T>,
  ): Promise<{ raw: T; by: ReadBy }> {
    const viaChatGPT = await options.chatgptReader?.();
    if (viaChatGPT) {
      try {
        const raw = (await viaChatGPT(input)) as T;
        void logInfo(`${input.what}: read by ChatGPT`);
        return { raw, by: "chatgpt" };
      } catch (error) {
        void logWarning(`ChatGPT ${input.what} failed, using the OpenAI key`, error);
      }
    }
    if (!(await options.keyPresent())) throw engineError("NOT_CONNECTED");
    const raw = await key();
    void logInfo(`${input.what}: read with the OpenAI key`);
    return { raw, by: "key" };
  }

  /** Reads a product: ChatGPT when signed in (and the key is not needed), else the key. */
  async function readProduct(
    photos: Uint8Array[],
    opts: { productTypes: string[] | null; typeNames?: Array<[string, string]>; productName?: string | null },
  ): Promise<ProductReading> {
    if (!photos.length) throw engineError("UNKNOWN", "no", "The product has no photos");
    const images = await Promise.all(photos.slice(0, 3).map((b) => sample(b)));
    const prompt = readingPrompt(opts.productTypes, opts.typeNames, opts.productName);
    const schema = readingSchema(opts.productTypes);
    const schemaName = "aaina_product_reading";
    const { raw, by } = await read({ prompt, images, schemaName, schema, what: "product reading" }, () =>
      openai.respondJson({ prompt, images, schemaName, schema }),
    );
    const reading = readingFromAnswer(raw, opts.productTypes, by);
    if (!reading) throw engineError("BAD_ANSWER", "maybe");
    return reading;
  }

  // ---- own poses and scenes ----
  /** Describes the pose in a reference photo in words (cheap reading call). Throws a plain message when no person shows. */
  async function readReferencePose(photo: Uint8Array): Promise<string> {
    const images = [await sample(photo, 1024)];
    const { raw } = await read({ prompt: REFERENCE_POSE_INSTRUCTION, images, what: "pose reading" }, () =>
      openai.respondText({ prompt: REFERENCE_POSE_INSTRUCTION, images }),
    );
    const text = String(raw);
    if (text.trim() === NO_PERSON_SENTINEL || text.includes(NO_PERSON_SENTINEL))
      throw engineError("CONTENT_REFUSED", "no", "There is no person in that photo");
    return text.replace(/\s+/g, " ").trim().slice(0, REFERENCE_POSE_MAX);
  }

  /** One pose photo from the model's sheet, 1024 x 1536 (portrait). `words` may be empty when a reference photo is given. */
  async function makePose(input: {
    sheet: Uint8Array;
    gender: string;
    words?: string | null;
    reference?: Uint8Array | null;
  }): Promise<Uint8Array> {
    let pose = input.words?.trim() ?? "";
    if (input.reference) {
      const read = await readReferencePose(input.reference);
      pose = [pose, read].filter(Boolean).join(". ");
    }
    if (!pose) throw engineError("UNKNOWN", "no", "Describe the pose or add a photo");
    const sheet = await prepareInput(input.sheet);
    return openai.editImage({
      prompt: sheetPosePrompt({ gender: input.gender, pose }),
      images: [{ bytes: sheet.bytes, mime: sheet.mime }],
      size: "1024x1536",
      quality: "standard",
    });
  }

  /** One scene picture, square 1536. With a reference photo the photo is image 1 (images/edits). */
  async function makeScene(input: { words: string; reference?: Uint8Array | null }): Promise<Uint8Array> {
    if (input.reference) {
      const ref = await prepareInput(input.reference);
      return openai.editImage({
        prompt: scenePrompt(input.words, true),
        images: [{ bytes: ref.bytes, mime: ref.mime }],
        size: "1536x1536",
        quality: "standard",
      });
    }
    return openai.generateImage({ prompt: scenePrompt(input.words, false), size: "1536x1536", quality: "medium" });
  }

  // ---- own models ----
  /** Three face options, one request at a time. Returns what was made; stops at the first failure that may have been charged. */
  async function makeFaces(traits: Traits, count = 3): Promise<{ faces: Uint8Array[]; error: unknown }> {
    const faces: Uint8Array[] = [];
    for (let i = 0; i < count; i++) {
      try {
        faces.push(await openai.generateImage({ prompt: modelFacePrompt(traits), size: "1024x1536", quality: "medium" }));
      } catch (error) {
        return { faces, error };
      }
    }
    return { faces, error: null };
  }

  /** The six-photo sheet (1024 x 1024, high quality) from a chosen face or 1 to 3 photos of a real adult. */
  async function makeSheet(input: {
    pictures: Uint8Array[];
    traits: { gender: "woman" | "man"; age: number; extra?: string | null };
  }): Promise<Uint8Array> {
    const images = await Promise.all(
      input.pictures.slice(0, 3).map(async (b) => {
        const p = await prepareInput(b);
        return { bytes: p.bytes, mime: p.mime };
      }),
    );
    return openai.editImage({
      prompt: modelSheetFromPicturesPrompt(input.traits, images.length),
      images,
      size: "1024x1024",
      quality: "high",
    });
  }

  /** The automatic sheet check (one cheap vision call). Only faults fail a sheet. */
  async function checkSheet(png: Uint8Array): Promise<{ pass: boolean; faults: string[] }> {
    const images = [await sample(png, 1024)];
    const prompt = sheetCheckPrompt();
    const schemaName = "aaina_sheet_check";
    const { raw } = await read<SheetCheck>({ prompt, images, schemaName, schema: sheetCheckSchema, what: "sheet check" }, () =>
      openai.respondJson<SheetCheck>({ prompt, images, schemaName, schema: sheetCheckSchema, effort: "medium", maxTokens: 2500 }),
    );
    const faults = Array.isArray(raw.faults) ? raw.faults.filter((x) => typeof x === "string").slice(0, 6) : [];
    const pass = sheetCheckPasses(raw);
    if (!pass && !faults.length) faults.push("The sheet has a fault (anatomy, people, panels or text).");
    return { pass, faults: pass ? [] : faults };
  }

  /** A real person's photo: one clear adult face, not a famous person. Returns the plain problem (null when it can be used) and the gender and age it saw. A check that can't run refuses. */
  async function checkPersonPhoto(
    photo: Uint8Array,
    view: "front" | "other",
  ): Promise<{ problem: string | null; gender: "woman" | "man"; age: number }> {
    const images = [await sample(photo, 1280)];
    const prompt = ownModelPhotoPrompt(view);
    const schemaName = "aaina_own_model_photo_check";
    let raw: OwnModelPhotoCheck;
    try {
      ({ raw } = await read<OwnModelPhotoCheck>({ prompt, images, schemaName, schema: ownModelPhotoSchema, what: "photo check" }, () =>
        openai.respondJson<OwnModelPhotoCheck>({ prompt, images, schemaName, schema: ownModelPhotoSchema, maxTokens: 400 }),
      ));
    } catch (e) {
      if (
        isEngineError(e) &&
        (e.code === "KEY_REFUSED" || e.code === "NOT_CONNECTED" || e.code === "OUT_OF_CREDIT" || e.code === "VERIFY_ORGANIZATION")
      )
        throw e;
      throw engineError("UNKNOWN", "no", "The photo check could not run, so the photo was not used. Try again");
    }
    if ([raw.onePerson, raw.faceClear, raw.adult, raw.publicFigure].some((v) => typeof v !== "boolean"))
      throw engineError("UNKNOWN", "no", "The photo check could not run");
    return {
      problem: ownModelPhotoProblem(raw, view),
      gender: raw.gender === "man" ? "man" : "woman",
      age: Math.min(90, Math.max(18, Math.round(Number(raw.ageYears) || 30))),
    };
  }

  return { readProduct, readReferencePose, makePose, makeScene, makeFaces, makeSheet, checkSheet, checkPersonPhoto };
}
export type Works = ReturnType<typeof createWorks>;
