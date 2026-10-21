// Turns a queued photo into one OpenAI request: which pictures in which order, which words, which size.
// Picture order (Aaina, provider.ts validatedInputs): the model's identity picture(s), the pose picture, the scene picture, then the
// product photos (front, back, close-ups).
import type { Photo, PhotoRole, Product, ProductReading, Shoot } from "../contract";
import { ESTIMATE_USD } from "../contract";
import { engineError } from "./errors";
import { prepareInput } from "./images";
import type { Img, Size } from "./openai";
import type { CatalogSource, EngineStore, OwnSource } from "./store";
import {
  EXPRESSION_OF,
  FRAME_OF,
  backgroundEditPrompt,
  colourEditPrompt,
  colourSceneText,
  colourWords,
  fixEditPrompt,
  flatLayPrompt,
  ghostPrompt,
  modelPhotoPrompt,
  type EditTarget,
} from "./prompts";

export type Job = { prompt: string; images: Img[]; size: Size; quality: Shoot["quality"] };

export const PRODUCT_SIZE: Size = "1536x1536";
const MAX_PRODUCT_PHOTOS = 6;
const MAX_IDENTITY_PHOTOS = 4;

const ROLE_ORDER: Record<PhotoRole, number> = { front: 0, back: 1, detail: 2 };

export function productPhotosFor(product: Product) {
  return [...product.photos].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]).slice(0, MAX_PRODUCT_PHOTOS);
}

const ACCESSORY_WORDS =
  /\b(bag|handbag|clutch|tote|shoe|sneaker|heel|sandal|boot|jewell?ery|earring|necklace|ring|bracelet|bangle|watch|belt|scarf|cap|hat|sunglass)/i;
export const itemOf = (reading: ProductReading | null, product: Product) => reading?.label?.trim() || product.name || "product";
export const sectionOf = (reading: ProductReading | null): "clothing" | "accessories" =>
  reading?.reach === "accessory" || (reading?.reach == null && ACCESSORY_WORDS.test(reading?.label ?? "")) ? "accessories" : "clothing";

export const estimateFor = (quality: Shoot["quality"], kind: "photo" | "edit") =>
  kind === "edit" ? ESTIMATE_USD.edit : ESTIMATE_USD.photo[quality];

export type JobDeps = { store: EngineStore; catalog: CatalogSource; own: OwnSource };

const asImg = async (bytes: Uint8Array): Promise<Img> => {
  const p = await prepareInput(bytes);
  return { bytes: p.bytes, mime: p.mime };
};

/** Builds the request for a queued photo. No network; throws EngineError when something it needs is gone. */
export async function buildJob(photo: Photo, deps: JobDeps): Promise<Job> {
  const { store, catalog, own } = deps;
  const shoot = await store.shoot(photo.shootId);
  if (!shoot) throw engineError("UNKNOWN", "no", "The shoot was deleted");
  const product = await store.product(shoot.productId);
  if (!product) throw engineError("UNKNOWN", "no", "The product was deleted");
  const reading = product.reading;
  const quality = shoot.quality;

  // Edits start from a finished photo.
  if (photo.change.kind === "fix" || photo.change.kind === "colour") {
    const parent = photo.parentId ? await store.photo(photo.parentId) : null;
    if (!parent?.path) throw engineError("UNKNOWN", "no", "The photo to change is missing");
    const target: EditTarget = parent.shot.kind === "flat-lay" ? "flat-lay" : parent.shot.kind === "ghost" ? "ghost" : "model";
    const item = itemOf(reading, product);
    const prompt =
      photo.change.kind === "fix"
        ? fixEditPrompt(target, item, photo.change.words)
        : colourEditPrompt(target, item, colourWords(photo.change.name, photo.change.hex));
    return { prompt, images: [await asImg(await store.readPhotoFile(parent))], size: PRODUCT_SIZE, quality };
  }

  const photos = productPhotosFor(product);
  if (!photos.length) throw engineError("UNKNOWN", "no", "The product has no photos");
  const productImgs = await Promise.all(photos.map(async (p) => asImg(await store.readProductPhoto(p.path))));
  const roles = photos.map((p) => p.role);
  const item = itemOf(reading, product);
  const shot = photo.shot;

  if (shot.kind === "flat-lay") {
    return {
      prompt: flatLayPrompt({ item, section: sectionOf(reading), style: shot.style, side: shot.side, sources: roles }),
      images: productImgs,
      size: PRODUCT_SIZE,
      quality,
    };
  }

  if (shot.kind === "ghost") {
    const images: Img[] = [];
    let frontReference = false;
    if (shot.angle !== "front") {
      const front = (await store.shootPhotos(shoot.id))
        .filter((p) => p.shot.kind === "ghost" && p.shot.angle === "front" && p.status === "done" && p.path)
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))[0];
      if (front) {
        images.push(await asImg(await store.readPhotoFile(front)));
        frontReference = true;
      }
    }
    return {
      prompt: ghostPrompt({ item, angle: shot.angle, sources: roles, frontReference }),
      images: [...images, ...productImgs],
      size: PRODUCT_SIZE,
      quality,
    };
  }

  // A model photo.
  if (!shoot.model) throw engineError("UNKNOWN", "no", "No model chosen");
  const identity: Img[] = [];
  let modelName: string;
  let sheet = true;
  if (shoot.model.source === "studio") {
    const model = await catalog.model(shoot.model.id);
    if (!model) throw engineError("UNKNOWN", "no", "The model is no longer in the catalogue");
    modelName = model.name;
    if (model.sheetUrl) identity.push(await asImg(await catalog.pictureBytes(model.sheetUrl)));
    else {
      sheet = false;
      for (const url of model.photoUrls.slice(0, MAX_IDENTITY_PHOTOS)) identity.push(await asImg(await catalog.pictureBytes(url)));
      if (!identity.length) identity.push(await asImg(await catalog.pictureBytes(model.cardUrl)));
    }
  } else {
    const model = await own.model(shoot.model.id);
    if (!model?.sheetPath) throw engineError("UNKNOWN", "no", "Your model's sheet is not ready");
    modelName = model.name;
    identity.push(await asImg(await own.readFile(model.sheetPath)));
  }

  const pose = shot.pose;
  let poseImg: Img | null = null;
  let poseText: string | undefined;
  let poseFraming: string | null = null;
  let poseAngle: string | undefined;
  if (pose.source === "studio") {
    const found = await catalog.pose(shoot.model, pose.id);
    if (!found) throw engineError("UNKNOWN", "no", "The pose is no longer in the catalogue");
    poseImg = await asImg(await catalog.pictureBytes(found.imageUrl));
    poseFraming = found.framing;
    poseText = found.direction ?? undefined;
    poseAngle = found.angle ?? undefined;
  } else if (pose.source === "own") {
    const found = await own.pose(pose.id);
    if (!found?.imagePath && !found?.words) throw engineError("UNKNOWN", "no", "Your pose is missing");
    if (found.imagePath) poseImg = await asImg(await own.readFile(found.imagePath));
    if (found.words) poseText = found.words;
  } else poseText = pose.words;

  let sceneImg: Img | null = null;
  let sceneWords: string | null = null;
  const sceneRef = shoot.scene;
  if (sceneRef?.source === "studio") {
    const found = await catalog.scene(sceneRef.id);
    if (!found) throw engineError("UNKNOWN", "no", "The scene is no longer in the catalogue");
    sceneImg = await asImg(await catalog.pictureBytes(found.imageUrl));
  } else if (sceneRef?.source === "own") {
    const found = await own.scene(sceneRef.id);
    if (!found?.imagePath) throw engineError("UNKNOWN", "no", "Your scene is missing");
    sceneImg = await asImg(await own.readFile(found.imagePath));
  } else if (sceneRef?.source === "colour") sceneWords = colourSceneText(sceneRef.name, sceneRef.hex);

  const prompt = modelPhotoPrompt({
    modelName,
    identity: { count: identity.length, sheet },
    hasPoseImage: !!poseImg,
    poseText,
    poseFraming,
    poseAngle,
    frame: FRAME_OF[shot.frame],
    expression: EXPRESSION_OF[shot.expression],
    scene: sceneImg ? { kind: "image" } : sceneWords ? { kind: "words", text: sceneWords } : { kind: "none" },
    products: roles,
    productType: reading?.label,
    note: photo.change.kind === "again" ? photo.change.note : undefined,
  });
  return {
    prompt,
    images: [...identity, ...(poseImg ? [poseImg] : []), ...(sceneImg ? [sceneImg] : []), ...productImgs],
    size: PRODUCT_SIZE,
    quality,
  };
}

/** The paid "white or grey background" edit (kept for the marketplace save later). */
export const whiteBackgroundPrompt = (target: EditTarget, item: string, colour: "white" | "grey") =>
  backgroundEditPrompt(target, item, colour);
