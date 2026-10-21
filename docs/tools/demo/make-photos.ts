// Makes the demo photos for the tutorials and the video with the app's own prompts and engine settings.
// Paid: each step costs what the app would charge for it. Run one step at a time:
//   OPENAI_API_KEY=… npx tsx docs/tools/demo/make-photos.ts <step> [...]
// Results land in docs/tools/demo/out/<step>.png and are reused by later steps.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createOpenAI, type Img } from "../../../src/lib/engine/openai";
import { flatLayPrompt, ghostPrompt, modelPhotoPrompt } from "../../../src/lib/engine/prompts";
import { nodeCatalog } from "./catalog";

const OUT = join(import.meta.dirname, "out");
mkdirSync(OUT, { recursive: true });
const openai = createOpenAI({ getKey: async () => process.env.OPENAI_API_KEY ?? null, fetcher: (u, i) => fetch(u, i) });
const catalog = nodeCatalog();

const mimeOf = (b: Uint8Array) => (b[0] === 0x89 ? "image/png" : b[0] === 0xff ? "image/jpeg" : "image/webp");
const img = (bytes: Uint8Array): Img => ({ bytes, mime: mimeOf(bytes) });
const saved = (name: string) => img(new Uint8Array(readFileSync(join(OUT, `${name}.png`))));

const PRODUCTS = {
  dress: {
    item: "Silk satin midi slip dress",
    packshot:
      "Ecommerce product photograph of a single emerald green silk satin midi slip dress with a soft cowl neckline, thin adjustable straps and a bias-cut skirt, hanging on a slim wooden hanger against a plain light grey wall, soft even studio light, the whole dress in frame, no person, no text.",
  },
  coat: {
    item: "Wool double-breasted overcoat",
    packshot:
      "Ecommerce product photograph of a single men's camel wool double-breasted overcoat with peak lapels, six dark horn buttons and flap pockets, knee length, hanging on a wooden hanger against a plain light grey wall, soft even studio light, the whole coat in frame, no person, no text.",
  },
} as const;
type ProductKey = keyof typeof PRODUCTS;

async function modelPhoto(modelId: string, product: ProductKey, sceneId: string, poseIndex: number) {
  const model = (await catalog.models()).find((m) => m.id === modelId);
  if (!model?.sheetUrl) throw new Error(`No sheet for ${modelId}`);
  const poses = await catalog.posesFor({ source: "studio", id: modelId });
  const pose = poses[poseIndex];
  const scene = (await catalog.scenes()).find((s) => s.id === sceneId);
  if (!pose || !scene) throw new Error("Pose or scene missing");
  console.log(`pose: ${pose.name} (${pose.framing ?? "?"}) · scene: ${scene.name}`);
  const prompt = modelPhotoPrompt({
    modelName: model.name,
    identity: { count: 1, sheet: true },
    hasPoseImage: true,
    poseText: pose.direction ?? undefined,
    poseFraming: pose.framing,
    poseAngle: pose.angle ?? undefined,
    scene: { kind: "image" },
    products: ["front"],
    productType: PRODUCTS[product].item,
  });
  return openai.editImage({
    prompt,
    images: [
      img(await catalog.pictureBytes(model.sheetUrl)),
      img(await catalog.pictureBytes(pose.imageUrl)),
      img(await catalog.pictureBytes(scene.imageUrl)),
      saved(`${product}-product`),
    ],
    size: "1536x1536",
    quality: "high",
  });
}

async function poses(modelId: string) {
  const list = await catalog.posesFor({ source: "studio", id: modelId });
  list.forEach((p, i) => console.log(i, p.id, p.name, p.framing, p.angle, p.best.join(",")));
}

const [step, ...args] = process.argv.slice(2);
const write = (name: string, bytes: Uint8Array) => {
  const path = join(OUT, `${name}.png`);
  if (existsSync(path)) writeFileSync(join(OUT, `${name}.previous-${Date.now()}.png`), readFileSync(path));
  writeFileSync(path, bytes);
  console.log("saved", path);
};

if (step === "poses") await poses(args[0]);
else if (step === "product") {
  const key = args[0] as ProductKey;
  write(`${key}-product`, await openai.generateImage({ prompt: PRODUCTS[key].packshot, size: "1024x1536", quality: "high" }));
} else if (step === "model") {
  const [modelId, product, sceneId, poseIndex, name] = args;
  write(name, await modelPhoto(modelId, product as ProductKey, sceneId, Number(poseIndex)));
} else if (step === "flatlay") {
  const key = args[0] as ProductKey;
  const prompt = flatLayPrompt({ item: PRODUCTS[key].item, section: "clothing", style: "styled", side: "front", sources: ["front"] });
  write(`${key}-flatlay`, await openai.editImage({ prompt, images: [saved(`${key}-product`)], size: "1536x1536", quality: "high" }));
} else if (step === "ghost") {
  const key = args[0] as ProductKey;
  const prompt = ghostPrompt({ item: PRODUCTS[key].item, angle: "front", sources: ["front"], frontReference: false });
  write(`${key}-ghost`, await openai.editImage({ prompt, images: [saved(`${key}-product`)], size: "1536x1536", quality: "high" }));
} else console.log("steps: poses <model> | product <dress|coat> | model <model> <product> <scene> <poseIndex> <name> | flatlay <p> | ghost <p>");
