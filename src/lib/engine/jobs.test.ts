import { describe, expect, it, vi } from "vitest";
import type { CatalogModel, CatalogPose, Photo, Product, ProductReading, Shoot, ShotPlan } from "../contract";
import { ESTIMATE_USD } from "../contract";
import { buildJob, estimateFor, itemOf, productPhotosFor, sectionOf, whiteBackgroundPrompt, type JobDeps } from "./jobs";

vi.mock("./images", () => ({ prepareInput: async (bytes: Uint8Array) => ({ bytes, mime: "image/png", width: 1, height: 1 }) }));

const bytes = (n: number) => new Uint8Array([n]);
// Every read returns one byte: its position in `reads`, so a test can tell which source each sent picture came from.
const order = (job: { images: Array<{ bytes: Uint8Array }> }, reads: string[]) => job.images.map((i) => reads[i.bytes[0] - 1]);
const reading = (over: Partial<ProductReading> = {}): ProductReading => ({
  productType: "crewneck_tshirts",
  label: "T-shirt",
  audience: "women",
  colour: null,
  material: null,
  details: null,
  reach: "upper",
  readBy: "key",
  readAt: "",
  ...over,
});
const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "Cobalt tee",
  photos: [
    { id: "a", path: "products/p1/detail.jpg", url: "", role: "detail", width: 1, height: 1 },
    { id: "b", path: "products/p1/front.jpg", url: "", role: "front", width: 1, height: 1 },
    { id: "c", path: "products/p1/back.jpg", url: "", role: "back", width: 1, height: 1 },
  ],
  reading: reading(),
  createdAt: "",
  updatedAt: "",
  ...over,
});
const shoot = (over: Partial<Shoot> = {}): Shoot => ({
  id: "s1",
  name: "Cobalt tee",
  kind: "model",
  productId: "p1",
  model: { source: "studio", id: "m1" },
  scene: null,
  quality: "standard",
  plan: [],
  status: "making",
  draftStep: null,
  coverUrl: null,
  photoCount: 0,
  createdAt: "",
  updatedAt: "",
  ...over,
});
const photo = (shot: ShotPlan, over: Partial<Photo> = {}): Photo => ({
  id: "ph1",
  shootId: "s1",
  shotKey: "k",
  shot,
  title: "t",
  version: 1,
  parentId: null,
  change: { kind: "new" },
  status: "queued",
  error: null,
  path: null,
  url: null,
  width: null,
  height: null,
  estimateUsd: 0.05,
  startedAt: null,
  finishedAt: null,
  createdAt: "",
  ...over,
});
const modelShot: ShotPlan = { kind: "model", pose: { source: "words", words: "hands on hips" }, frame: "as-posed", expression: "as-posed" };
const studioModel = (over: Partial<CatalogModel> = {}): CatalogModel => ({
  id: "m1",
  name: "Hana",
  gender: "woman",
  ageGroup: "adult",
  age: 26,
  look: null,
  body: null,
  tags: [],
  appearance: null,
  minor: false,
  cardUrl: "card",
  faceUrl: null,
  sheetUrl: "sheet",
  photoUrls: [],
  poolKey: null,
  suits: null,
  ...over,
});

function deps(over: { shoot?: Shoot | null; product?: Product | null; photos?: Photo[]; model?: CatalogModel | null } = {}) {
  const reads: string[] = [];
  const d = {
    store: {
      shoot: async () => (over.shoot === undefined ? shoot() : over.shoot),
      product: async () => (over.product === undefined ? product() : over.product),
      photo: async (id: string) => (over.photos ?? []).find((p) => p.id === id) ?? null,
      shootPhotos: async () => over.photos ?? [],
      readProductPhoto: async (path: string) => (reads.push(path), bytes(reads.length)),
      readPhotoFile: async (p: Photo) => (reads.push(`photo:${p.id}`), bytes(reads.length)),
    },
    catalog: {
      model: async () => (over.model === undefined ? studioModel() : over.model),
      pose: async (): Promise<CatalogPose | null> => ({
        id: "po1",
        name: "Pose",
        imageUrl: "pose-img",
        modelId: "m1",
        shownOn: null,
        best: [],
        also: [],
        style: [],
        framing: "head_to_knee",
        direction: "turned left",
        angle: "three-quarter",
      }),
      scene: async () => ({
        id: "sc1",
        name: "Beach",
        imageUrl: "scene-img",
        bestFor: [],
        also: [],
        style: [],
        region: null,
        plain: false,
      }),
      pictureBytes: async (a: string) => (reads.push(`pic:${a}`), bytes(reads.length)),
    },
    own: {
      model: async () => ({ id: "o1", name: "Mine", gender: "woman" as const, appearance: "", sheetPath: "own-models/o1/sheet.png" }),
      pose: async () => ({ words: "arms crossed", imagePath: null }),
      scene: async () => ({ imagePath: "scenes/x.png" }),
      readFile: async (p: string) => (reads.push(`own:${p}`), bytes(reads.length)),
    },
  };
  return { deps: d as unknown as JobDeps, reads };
}

describe("product helpers", () => {
  it("orders product photos front, back, then close-ups and keeps six", () => {
    expect(productPhotosFor(product()).map((p) => p.role)).toEqual(["front", "back", "detail"]);
    const many = product({
      photos: Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, path: `${i}`, url: "", role: "detail" as const, width: 1, height: 1 })),
    });
    expect(productPhotosFor(many)).toHaveLength(6);
  });
  it("names the item from the reading, then the product name", () => {
    expect(itemOf(reading({ label: "  Kurta " }), product())).toBe("Kurta");
    expect(itemOf(null, product())).toBe("Cobalt tee");
    expect(itemOf(null, product({ name: "" }))).toBe("product");
  });
  it("tells accessories from clothing by reach, else by the label's words", () => {
    expect(sectionOf(reading({ reach: "accessory" }))).toBe("accessories");
    expect(sectionOf(reading({ reach: "upper", label: "Handbag" }))).toBe("clothing");
    expect(sectionOf(reading({ reach: null, label: "Leather handbag" }))).toBe("accessories");
    expect(sectionOf(reading({ reach: null, label: "Kurta" }))).toBe("clothing");
    expect(sectionOf(null)).toBe("clothing");
  });
  it("estimates by quality for photos and a flat price for edits", () => {
    expect(estimateFor("standard", "photo")).toBe(ESTIMATE_USD.photo.standard);
    expect(estimateFor("high", "photo")).toBe(ESTIMATE_USD.photo.high);
    expect(estimateFor("high", "edit")).toBe(ESTIMATE_USD.edit);
  });
  it("builds the paid white or grey background prompt", () => {
    expect(whiteBackgroundPrompt("model", "T-shirt", "white")).toContain("white");
  });
});

describe("buildJob: things that are gone fail before anything is sent", () => {
  it("the shoot, the product, the photos, the model, pose and scene", async () => {
    const cases: Array<[string, Parameters<typeof deps>[0], Photo]> = [
      ["shoot was deleted", { shoot: null }, photo(modelShot)],
      ["product was deleted", { product: null }, photo(modelShot)],
      ["no photos", { product: product({ photos: [] }) }, photo(modelShot)],
      ["No model chosen", { shoot: shoot({ model: null }) }, photo(modelShot)],
      ["no longer in the catalogue", { model: null }, photo(modelShot)],
      ["photo to change is missing", {}, photo(modelShot, { change: { kind: "fix", words: "x" }, parentId: "nope" })],
    ];
    for (const [text, over, p] of cases) {
      const { deps: d } = deps(over);
      await expect(buildJob(p, d)).rejects.toMatchObject({ charged: "no", message: expect.stringContaining(text) });
    }
  });
  it("your own sheet, pose or scene is missing", async () => {
    const own = shoot({ model: { source: "own", id: "o1" } });
    const base = deps({ shoot: own });
    (base.deps.own as { model: unknown }).model = async () => ({ id: "o1", name: "M", gender: "woman", appearance: "", sheetPath: null });
    await expect(buildJob(photo(modelShot), base.deps)).rejects.toThrow(/sheet is not ready/);

    const noPose = deps();
    (noPose.deps.own as { pose: unknown }).pose = async () => null;
    await expect(buildJob(photo({ ...modelShot, pose: { source: "own", id: "x" } }), noPose.deps)).rejects.toThrow(/pose is missing/);

    const noScene = deps({ shoot: shoot({ scene: { source: "own", id: "x" } }) });
    (noScene.deps.own as { scene: unknown }).scene = async () => ({ imagePath: null });
    await expect(buildJob(photo(modelShot), noScene.deps)).rejects.toThrow(/scene is missing/);
  });
});

describe("buildJob: what is sent, in which order", () => {
  it("a model photo sends identity, pose, scene, then product photos front first", async () => {
    const { deps: d, reads } = deps({ shoot: shoot({ scene: { source: "studio", id: "sc1" } }) });
    const job = await buildJob(photo({ ...modelShot, pose: { source: "studio", id: "po1" } }), d);
    expect(order(job, reads)).toEqual([
      "pic:sheet",
      "pic:pose-img",
      "pic:scene-img",
      "products/p1/front.jpg",
      "products/p1/back.jpg",
      "products/p1/detail.jpg",
    ]);
    expect(job.size).toBe("1536x1536");
    expect(job.prompt).toContain("Hana");
  });
  it("a studio pose's direction and framing reach the prompt", async () => {
    const { deps: d } = deps();
    const job = await buildJob(photo({ ...modelShot, pose: { source: "studio", id: "po1" } }), d);
    expect(job.prompt).toContain("turned left");
  });
  it("an older model without a sheet sends up to four reference photos, or its card", async () => {
    const withPhotos = deps({ model: studioModel({ sheetUrl: null, photoUrls: ["a", "b", "c", "d", "e"] }) });
    const j1 = await buildJob(photo(modelShot), withPhotos.deps);
    expect(j1.images).toHaveLength(4 + 3);
    const cardOnly = deps({ model: studioModel({ sheetUrl: null, photoUrls: [] }) });
    await buildJob(photo(modelShot), cardOnly.deps);
    expect(cardOnly.reads).toContain("pic:card");
  });
  it("your own model, words pose and a solid colour scene send no extra pictures", async () => {
    const { deps: d, reads } = deps({
      shoot: shoot({ model: { source: "own", id: "o1" }, scene: { source: "colour", hex: "#223344", name: "Navy" } }),
    });
    const job = await buildJob(photo(modelShot), d);
    expect(order(job, reads)[0]).toBe("own:own-models/o1/sheet.png");
    expect(job.images).toHaveLength(1 + 3);
    expect(job.prompt).toContain("#223344");
  });
  it("your own pose with a picture and words, and your own scene", async () => {
    const { deps: d, reads } = deps({ shoot: shoot({ scene: { source: "own", id: "sc" } }) });
    (d.own as { pose: unknown }).pose = async () => ({ words: "leaning", imagePath: "poses/p.png" });
    const job = await buildJob(photo({ ...modelShot, pose: { source: "own", id: "x" } }), d);
    expect(reads).toContain("own:poses/p.png");
    expect(reads).toContain("own:scenes/x.png");
    expect(job.prompt).toContain("leaning");
  });
  it("Make again carries the customer's note", async () => {
    const { deps: d } = deps();
    const job = await buildJob(photo(modelShot, { change: { kind: "again", note: "softer light please" } }), d);
    expect(job.prompt).toContain("softer light please");
  });
  it("flat-lay uses only product photos", async () => {
    const { deps: d, reads } = deps({ shoot: shoot({ kind: "flat-lay", model: null }) });
    const job = await buildJob(photo({ kind: "flat-lay", style: "folded", side: "front" }), d);
    expect(job.images).toHaveLength(3);
    expect(reads.every((r) => r.startsWith("products/"))).toBe(true);
  });
  it("another ghost angle is anchored on the latest finished front view", async () => {
    const front = (id: string, finishedAt: string) =>
      photo({ kind: "ghost", angle: "front" }, { id, status: "done", path: `${id}.png`, finishedAt });
    const { deps: d, reads } = deps({
      shoot: shoot({ kind: "ghost", model: null }),
      photos: [front("f1", "2026-01-01"), front("f2", "2026-02-01")],
    });
    const job = await buildJob(photo({ kind: "ghost", angle: "side" }), d);
    expect(order(job, reads)[0]).toBe("photo:f2");
    expect(job.images).toHaveLength(1 + 3);
    const first = deps({ shoot: shoot({ kind: "ghost", model: null }) });
    expect((await buildJob(photo({ kind: "ghost", angle: "front" }), first.deps)).images).toHaveLength(3);
    expect((await buildJob(photo({ kind: "ghost", angle: "back" }), first.deps)).images).toHaveLength(3);
  });
  it("Fix something and Other colours start from the finished photo only", async () => {
    const parent = photo(modelShot, { id: "parent", status: "done", path: "a.png" });
    const fix = deps({ photos: [parent] });
    const j = await buildJob(photo(modelShot, { change: { kind: "fix", words: "remove the tag" }, parentId: "parent" }), fix.deps);
    expect(j.images).toHaveLength(1);
    expect(j.prompt).toContain("remove the tag");
    const colour = await buildJob(
      photo({ kind: "ghost", angle: "front" }, { change: { kind: "colour", hex: "#ff0000", name: "Red" }, parentId: "parent" }),
      deps({ photos: [parent] }).deps,
    );
    expect(colour.prompt.toLowerCase()).toContain("red");
    const flat = deps({ photos: [photo({ kind: "flat-lay", style: "clean", side: "front" }, { id: "parent", path: "x.png" })] });
    await buildJob(photo(modelShot, { change: { kind: "fix", words: "x" }, parentId: "parent" }), flat.deps);
  });
});
