// The real Api end to end, with the system boundaries faked: SQLite is node:sqlite, the disk is in memory, the keychain is a Map,
// and the network (plugin-http) answers from fixtures and a scripted OpenAI. Nothing here touches the network or costs money.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakePng, installCanvas } from "../../test/fakeCanvas";
import { keychain, putFile, resetFs, vfs } from "../../test/fakeFs";
import current from "../catalog/fixtures/current.json";
import models from "../catalog/fixtures/models.json";
import posesAaina from "../catalog/fixtures/poses-aaina.json";
import posesHana from "../catalog/fixtures/poses-hana.json";
import scenes from "../catalog/fixtures/scenes.json";
import sheets from "../catalog/fixtures/sheets.json";
import sheetsPointer from "../catalog/fixtures/sheets-current.json";
import type { Api, Photo, ShotPlan } from "../contract";
import { bytesToB64 } from "../engine";
import { createApi } from "./index";

vi.mock("@tauri-apps/plugin-fs", async () => (await import("../../test/fakeFs")).fsModule);
vi.mock("@tauri-apps/api/path", async () => (await import("../../test/fakeFs")).pathModule);
vi.mock("@tauri-apps/api/core", async () => (await import("../../test/fakeFs")).coreModule);
vi.mock("@tauri-apps/plugin-sql", async () => {
  const { memoryDb } = await import("../data/sqlite.testkit");
  const { putFile } = await import("../../test/fakeFs");
  return {
    default: {
      load: async () => {
        const db = memoryDb();
        return {
          ...db,
          // VACUUM INTO would write a real file at the fake path: the copy is faked into the in-memory disk instead.
          execute: async (q: string, p?: unknown[]) => {
            const m = /^VACUUM INTO '(.*)'$/.exec(q);
            if (m) {
              putFile(m[1].replace(/''/g, "'"), "DB-COPY");
              return { rowsAffected: 0 };
            }
            return db.execute(q, p);
          },
          close: async () => true,
        };
      },
    },
  };
});

const h = vi.hoisted(() => ({
  fetch: vi.fn(),
  openDialog: vi.fn(),
  openUrl: vi.fn(),
  reveal: vi.fn(),
  relaunch: vi.fn(),
  writeImage: vi.fn(),
  sendNotification: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: unknown[]) => h.fetch(...a) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (...a: unknown[]) => h.openDialog(...a) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: (u: string) => h.openUrl(u), revealItemInDir: (p: string) => h.reveal(p) }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: () => h.relaunch() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeImage: (b: Uint8Array) => h.writeImage(b) }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: async () => true,
  requestPermission: async () => "granted",
  sendNotification: (n: unknown) => h.sendNotification(n),
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "0.1.0-test" }));

const B = "https://static.aaina.world/catalog/";
const KEY = "sk-test-1234567890abcdef";
const PICTURE = bytesToB64(fakePng(1536, 1536, 300));
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const message = (obj: unknown) => ok({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(obj) }] }] });
const READING = {
  label: "Kurta",
  productType: "kurtas",
  audience: "women",
  colour: "blue",
  material: "cotton",
  details: null,
  reach: "upper",
};

type OpenAIHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let openai: OpenAIHandler;
let openaiCalls: string[];

const catalogRoutes: Record<string, unknown> = {
  [`${B}current.json`]: current,
  [`${B}${current.lists.models}`]: models,
  [`${B}${current.lists.scenes}`]: scenes,
  [`${B}${current.lists.poses.aaina}`]: posesAaina,
  [`${B}${current.lists.poses.hana}`]: posesHana,
  [`${B}sheets/current.json`]: sheetsPointer,
  [`${B}${sheetsPointer.list}`]: sheets,
};

function route(url: string, init?: RequestInit): Response | Promise<Response> {
  if (url.startsWith(B)) {
    if (/\.webp$/.test(url)) return new Response(fakePng(640, 640, 150) as BodyInit, { status: 200 });
    const body = catalogRoutes[url];
    return body === undefined ? new Response("no", { status: 404 }) : ok(body);
  }
  if (url.startsWith("https://api.openai.com/")) {
    openaiCalls.push(url.replace("https://api.openai.com/v1", ""));
    return openai(url, init);
  }
  throw new Error(`Unexpected request to ${url}`);
}

const PLAN: ShotPlan[] = [
  { kind: "model", pose: { source: "words", words: "standing, hands on hips" }, frame: "as-posed", expression: "as-posed" },
];
let api: Api;

/** Polls until `fn` gives an answer (counted in tries, not time, so tests that fake the clock still work). */
async function until<T>(fn: () => Promise<T | false | null | undefined>): Promise<T> {
  for (let i = 0; i < 300; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("Gave up waiting");
}
const bodyOf = (init?: RequestInit) => (typeof init?.body === "string" ? init.body : "");
const SHEET_OK = {
  panels: 6,
  onePersonEach: true,
  samePerson: true,
  extraLimbsOrHands: false,
  textOrLogos: false,
  appearsUnder18: false,
  faults: [],
};

async function connect() {
  openai = (url) => (url.endsWith("/models") ? ok({ data: [] }) : new Response("{}", { status: 500 }));
  await api.setKey(KEY);
}
async function productWithShoot() {
  putFile("/Users/me/Desktop/kurta.jpg", fakePng(800, 1200));
  const product = await api.createProduct([{ path: "/Users/me/Desktop/kurta.jpg", role: "front" }]);
  let shoot = await api.createShoot({ kind: "model", productId: product.id });
  const model = (await api.models()).find((m) => m.sheetUrl) ?? (await api.models())[0];
  shoot = await api.updateShoot(shoot.id, { model: { source: "studio", id: model.id }, plan: PLAN });
  return { product, shoot };
}
const photosOf = async (shootId: string): Promise<Photo[]> => api.photos(shootId);

beforeEach(async () => {
  resetFs();
  keychain.clear();
  installCanvas();
  openaiCalls = [];
  Object.values(h).forEach((m) => m.mockReset());
  h.fetch.mockImplementation(async (url: string, init?: RequestInit) => route(url, init));
  api = await createApi();
});

describe("start", () => {
  it("opens an empty library, and a catalogue from the network", async () => {
    expect(await api.products()).toEqual([]);
    expect(await api.shoots()).toEqual([]);
    expect((await api.models()).length).toBeGreaterThan(0);
    expect(await api.catalogStatus()).toMatchObject({ state: "ready" });
    expect(await api.appVersion()).toBe("0.1.0-test");
    expect(await api.settings()).toMatchObject({ onboarded: false, photosFolder: "/Pictures/Aaina", quality: "standard" });
  });
  it("lists scenes and poses, and suggests models for a product", async () => {
    expect((await api.scenes()).length).toBeGreaterThan(0);
    const { product } = await productWithShoot();
    expect((await api.suggestModels(product.id)).length).toBeGreaterThan(0);
    expect((await api.suggestModels(null)).length).toBeGreaterThan(0);
    const first = (await api.models())[0];
    await api.posesFor({ source: "studio", id: first.id });
    expect(await api.posesFor({ source: "own", id: "nobody" })).toEqual([]);
  });
  it("clears the catalogue cache and refreshes it", async () => {
    await api.models();
    expect((await api.clearCatalogCache()).cacheBytes).toBe(0);
    expect((await api.refreshCatalog()).state).toBe("ready");
  });
});

describe("connection", () => {
  it("rejects what is not a key, a refused key, and keeps a good key only in the keychain", async () => {
    await expect(api.setKey("hello")).rejects.toThrow(/starts with sk-/);
    openai = () => new Response("{}", { status: 401 });
    await expect(api.setKey(KEY)).rejects.toThrow();
    expect(keychain.has("openai_api_key")).toBe(false);
    openai = () => ok({ data: [] });
    const c = await api.setKey(`  ${KEY} `);
    expect(c).toMatchObject({ key: { present: true, last4: KEY.slice(-4), status: "works" }, canMakePhotos: true, canRead: true });
    expect(keychain.get("openai_api_key")).toBe(KEY);
    // the key is in no table and no file
    expect(JSON.stringify([...vfs.entries()].map(([k, v]) => [k, v ? new TextDecoder().decode(v) : null]))).not.toContain(KEY);
    expect(await api.removeKey()).toMatchObject({ key: { present: false }, canMakePhotos: false, canRead: false });
    expect(keychain.has("openai_api_key")).toBe(false);
  });
  it("a network failure while checking the key says so in plain words", async () => {
    openai = () => {
      throw new Error("dns error: failed to lookup");
    };
    await expect(api.setKey(KEY)).rejects.toThrow(/internet/i);
  });
  it("tells subscribers the connection changed", async () => {
    const seen: string[] = [];
    api.subscribe((e) => seen.push(e.type));
    await connect();
    expect(seen).toContain("connection");
  });
  it("a refused key during work shows up in the connection at once", async () => {
    const { shoot } = await productWithShoot();
    await connect();
    openai = () => new Response(JSON.stringify({ error: { code: "invalid_api_key" } }), { status: 401 });
    await api.makeShoot(shoot.id);
    await until(async () => (await api.connection()).key.status === "refused");
  });
});

describe("products", () => {
  it("creates a product from files named after the first file, and edits it", async () => {
    putFile("/p/Red Dress.png", fakePng(100, 200));
    putFile("/p/back.png", fakePng(100, 200));
    const p = await api.createProduct([
      { path: "/p/Red Dress.png", role: "front" },
      { path: "/p/back.png", role: "back" },
    ]);
    expect(p.name).toBe("Red Dress");
    expect(p.photos.map((x) => x.role)).toEqual(["front", "back"]);
    await expect(api.createProduct([])).rejects.toThrow(/at least one photo/);
    const renamed = await api.updateProduct(p.id, { name: "  ", photos: [{ id: p.photos[1].id, role: "detail" }] });
    expect(renamed.name).toBe("Product");
    expect(renamed.photos.find((x) => x.id === p.photos[1].id)?.role).toBe("detail");
    const more = await api.addProductPhotos(p.id, [{ path: "/p/back.png", role: "detail" }]);
    expect(more.photos).toHaveLength(3);
    expect(await api.product(p.id)).toMatchObject({ id: p.id });
  });
  it("reads a product with the key and stores the reading", async () => {
    await connect();
    const { product } = await productWithShoot();
    openai = (url) => (url.endsWith("/responses") ? message(READING) : new Response("{}", { status: 500 }));
    const reading = await api.readProduct(product.id);
    expect(reading).toMatchObject({ label: "Kurta", readBy: "key" });
    expect((await api.product(product.id))!.reading).toMatchObject({ label: "Kurta" });
    await expect(api.readProduct("nope")).rejects.toThrow(/no photos/);
  });
  it("deleting a product removes its copied photos from the app folder", async () => {
    const { product } = await productWithShoot();
    const path = `/data/${product.photos[0].path}`;
    expect(vfs.has(path)).toBe(true);
    await api.deleteProduct(product.id);
    expect(vfs.has(path)).toBe(false);
    expect(await api.product(product.id)).toBeNull();
  });
});

describe("making a shoot: the money rules", () => {
  it("needs a key, a plan and a model before anything is queued", async () => {
    const { shoot, product } = await productWithShoot();
    await expect(api.makeShoot(shoot.id)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
    await connect();
    await expect(api.makeShoot("nope")).rejects.toThrow(/gone/);
    const empty = await api.createShoot({ kind: "model", productId: product.id });
    await expect(api.makeShoot(empty.id)).rejects.toThrow(/Choose what to make/);
    const noModel = await api.updateShoot(empty.id, { plan: PLAN });
    await expect(api.makeShoot(noModel.id)).rejects.toThrow(/Choose a model/);
    await expect(api.createShoot({ kind: "model", productId: "gone" })).rejects.toThrow(/gone/);
  });

  it("saves `sending` before the paid request, then writes the photo and tells the person", async () => {
    await connect();
    const { shoot } = await productWithShoot();
    let statusAtRequest: string | undefined;
    openai = async (url) => {
      if (url.endsWith("/images/edits")) {
        statusAtRequest = (await photosOf(shoot.id))[0].status;
        return ok({ data: [{ b64_json: PICTURE }] });
      }
      return new Response("{}", { status: 500 });
    };
    const events: string[] = [];
    api.subscribe((e) => events.push(e.type));
    const queued = await api.makeShoot(shoot.id);
    expect(queued).toHaveLength(1);
    expect(queued[0].status).toBe("queued");
    const done = await until(async () => (await photosOf(shoot.id)).find((p) => p.status === "done"));
    expect(statusAtRequest).toBe("sending");
    expect(done).toMatchObject({ width: 1536, height: 1536 });
    expect(done.url).toContain("/Pictures/Aaina/");
    expect(vfs.has(`/Pictures/Aaina/${done.path}`)).toBe(true);
    expect(["making", "done"]).toContain((await api.shoot(shoot.id))!.status);
    await until(async () => h.sendNotification.mock.calls.length > 0);
    expect(h.sendNotification.mock.calls[0][0]).toMatchObject({ title: "Your photos are ready" });
    expect(events).toContain("shoot");
    expect((await api.recentPhotos(5)).map((p) => p.id)).toContain(done.id);
    expect(openaiCalls.filter((c) => c === "/images/edits")).toHaveLength(1);
  });

  it("tells the screens about every change, so an open page never shows old names or misses a waiting photo", async () => {
    const done = await (async () => {
      await connect();
      const { shoot } = await productWithShoot();
      openai = () => ok({ data: [{ b64_json: PICTURE }] });
      await api.makeShoot(shoot.id);
      return until(async () => (await photosOf(shoot.id)).find((p) => p.status === "done"));
    })();
    const events: string[] = [];
    api.subscribe((e) => events.push(`${e.type}:${e.id ?? ""}`));
    await api.updateShoot(done.shootId, { name: "Olive jacket" });
    expect(events).toContain(`shoot:${done.shootId}`);
    openai = () => new Promise<Response>(() => undefined); // stays on its way, so the photo is still waiting below
    const again = await api.makeAgain(done.id);
    expect(events).toContain(`photo:${again.id}`);
    const fixed = await api.fixPhoto(done.id, "Straighten the collar");
    expect(events).toContain(`photo:${fixed.id}`);
    const [navy] = await api.otherColours(done.id, [{ hex: "#1f2a4d", name: "Navy" }]);
    expect(events).toContain(`photo:${navy.id}`);
  });

  it("a content refusal is failed and not charged; Try again puts the same photo back in the queue", async () => {
    await connect();
    const { shoot } = await productWithShoot();
    openai = () => new Response(JSON.stringify({ error: { code: "moderation_blocked" } }), { status: 400 });
    await api.makeShoot(shoot.id);
    const failed = await until(async () => (await photosOf(shoot.id)).find((p) => p.status === "failed"));
    expect(failed.error).toMatchObject({ code: "CONTENT_REFUSED", charged: "no" });
    openai = () => ok({ data: [{ b64_json: PICTURE }] });
    const again = await api.tryAgain(failed.id);
    expect(again.id).toBe(failed.id);
    await until(async () => (await api.photo(failed.id))?.status === "done");
  });

  it("a lost connection is interrupted, never resent by itself, and Try again makes a new version", async () => {
    await connect();
    const { shoot } = await productWithShoot();
    const clock = vi.spyOn(Date, "now").mockImplementation(() => 10_000_000);
    openai = () => {
      clock.mockImplementation(() => 10_100_000); // the request ran long before it dropped
      throw new Error("error sending request: connection reset");
    };
    await api.makeShoot(shoot.id);
    const interrupted = await until(async () => (await photosOf(shoot.id)).find((p) => p.status === "interrupted"));
    clock.mockRestore();
    expect(interrupted.error).toMatchObject({ code: "INTERRUPTED", charged: "maybe" });
    expect(openaiCalls.filter((c) => c === "/images/edits")).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(openaiCalls.filter((c) => c === "/images/edits")).toHaveLength(1);

    openai = () => ok({ data: [{ b64_json: PICTURE }] });
    const next = await api.tryAgain(interrupted.id);
    expect(next.id).not.toBe(interrupted.id);
    expect(next.version).toBe(2);
    await until(async () => (await api.photo(next.id))?.status === "done");
    expect((await api.photo(interrupted.id))!.status).toBe("interrupted");
  });

  it("Try again refuses a photo that is queued, being sent or finished, so nothing is paid for twice", async () => {
    await connect();
    const { shoot } = await productWithShoot();
    openai = () => ok({ data: [{ b64_json: PICTURE }] });
    await api.makeShoot(shoot.id);
    const done = await until(async () => (await photosOf(shoot.id)).find((p) => p.status === "done"));
    await expect(api.tryAgain(done.id)).rejects.toThrow(/didn't work/);
    expect(await photosOf(shoot.id)).toHaveLength(1);
  });

  it("Make again, Fix something, Other colours and delete work on a finished photo", async () => {
    await connect();
    const { shoot } = await productWithShoot();
    openai = () => ok({ data: [{ b64_json: PICTURE }] });
    await api.makeShoot(shoot.id);
    const first = await until(async () => (await photosOf(shoot.id)).find((p) => p.status === "done"));

    const again = await api.makeAgain(first.id, "  warmer light ", { frame: "waist-up", expression: "soft-smile" });
    expect(again).toMatchObject({
      version: 2,
      change: { kind: "again", note: "warmer light" },
      shot: { frame: "waist-up", expression: "soft-smile" },
    });

    await expect(api.fixPhoto("nope", "remove the tag")).rejects.toThrow(/finished photo/);
    await expect(api.fixPhoto(first.id, "  \u0001  ")).rejects.toThrow(/Say what to fix/);
    const fix = await api.fixPhoto(first.id, "remove the tag");
    expect(fix).toMatchObject({ parentId: first.id, change: { kind: "fix", words: "remove the tag" } });

    const colours = await api.otherColours(
      first.id,
      Array.from({ length: 8 }, (_, i) => ({ hex: `#00000${i}`, name: `C${i}` })),
    );
    expect(colours).toHaveLength(6);
    await expect(api.otherColours("nope", [{ hex: "#fff", name: "White" }])).rejects.toThrow(/finished photo/);

    await until(async () => (await photosOf(shoot.id)).every((p) => p.status === "done"));
    const file = `/Pictures/Aaina/${first.path}`;
    expect(vfs.has(file)).toBe(true);
    await api.deletePhoto(first.id);
    expect(vfs.has(file)).toBe(false);
    await api.deleteShoot(shoot.id);
    expect(await api.shoot(shoot.id)).toBeNull();
    expect([...vfs.keys()].filter((k) => k.startsWith("/Pictures/Aaina/") && vfs.get(k))).toEqual([]);
  });

  it("a flat-lay and a ghost shoot are queued with their own names", async () => {
    await connect();
    putFile("/p/a.png", fakePng(100, 200));
    const product = await api.createProduct([{ path: "/p/a.png", role: "front" }]);
    const flat = await api.createShoot({ kind: "flat-lay", productId: product.id });
    await api.updateShoot(flat.id, { plan: [{ kind: "flat-lay", style: "folded", side: "back" }] });
    const ghost = await api.createShoot({ kind: "ghost", productId: product.id });
    await api.updateShoot(ghost.id, { plan: [{ kind: "ghost", angle: "back-three-quarter" }] });
    openai = () => ok({ data: [{ b64_json: PICTURE }] });
    const [f] = await api.makeShoot(flat.id);
    const [g] = await api.makeShoot(ghost.id);
    expect(f.title).toBe("Folded flat-lay, back");
    expect(g.title).toBe("Back three-quarter view");
    await until(async () => (await api.photo(g.id))?.status === "done");
  });
});

describe("saving and sharing", () => {
  async function aDonePhoto() {
    await connect();
    const { shoot } = await productWithShoot();
    openai = () => ok({ data: [{ b64_json: PICTURE }] });
    await api.makeShoot(shoot.id);
    return until(async () => (await photosOf(shoot.id)).find((p) => p.status === "done"));
  }
  it("saves in the chosen shape and format into a folder, without overwriting", async () => {
    const photo = await aDonePhoto();
    putFile("/Out/.keep", "");
    const one = await api.savePhotos({ photoIds: [photo.id, "missing"], format: "jpeg", shape: "portrait-4x5", folder: "/Out" });
    const two = await api.savePhotos({ photoIds: [photo.id], format: "png", shape: "original", folder: "/Out", fileName: "mine" });
    expect(one.paths).toHaveLength(1);
    expect(one.paths[0]).toMatch(/^\/Out\/.+-v1\.jpg$/);
    expect(two.paths[0]).toBe("/Out/mine.png");
    // Both carry the AI-made mark, with the synthetic-person keyword for a photo of a model.
    for (const path of [one.paths[0], two.paths[0]]) {
      const saved = new TextDecoder().decode(vfs.get(path)!);
      expect(saved).toContain("trainedAlgorithmicMedia");
      expect(saved).toContain("contains-synthetic-performer");
    }
  });
  it("never lets a pose title or a chosen name leave the folder", async () => {
    await connect();
    const { shoot } = await productWithShoot();
    const odd: ShotPlan[] = [{ ...PLAN[0], pose: { source: "words", words: "arms / crossed: calm" } } as ShotPlan];
    await api.updateShoot(shoot.id, { plan: odd });
    openai = () => ok({ data: [{ b64_json: PICTURE }] });
    await api.makeShoot(shoot.id);
    const photo = await until(async () => (await photosOf(shoot.id)).find((p) => p.status === "done"));
    const byTitle = await api.savePhotos({ photoIds: [photo.id], format: "png", shape: "original", folder: "/Out" });
    const byName = await api.savePhotos({ photoIds: [photo.id], format: "png", shape: "original", folder: "/Out", fileName: "a/b.png" });
    expect(byTitle.paths[0]).toBe("/Out/arms crossed calm-v1.png");
    expect(byName.paths[0]).toBe("/Out/a b.png");
  });
  it("copies a photo to the clipboard and refuses one that is not finished", async () => {
    const photo = await aDonePhoto();
    await api.copyPhoto(photo.id);
    expect(h.writeImage).toHaveBeenCalled();
    await expect(api.copyPhoto("nope")).rejects.toThrow(/isn't finished/);
  });
  it("shows files in the folder manager, relative to the photos folder or absolute", async () => {
    await api.showInFolder("Shoot/a.png");
    await api.showInFolder("/Elsewhere/b.png");
    expect(h.reveal.mock.calls.map((c) => c[0])).toEqual(["/Pictures/Aaina/Shoot/a.png", "/Elsewhere/b.png"]);
  });
  it("opens web links only", async () => {
    await api.openUrl("https://aaina.world");
    expect(h.openUrl).toHaveBeenCalledWith("https://aaina.world");
    await expect(api.openUrl("file:///etc/passwd")).rejects.toThrow(/web links/);
    await expect(api.openUrl("javascript:alert(1)")).rejects.toThrow();
  });
  it("picks files and folders through the dialog", async () => {
    h.openDialog.mockResolvedValueOnce(null).mockResolvedValueOnce("/a.png").mockResolvedValueOnce(["/a.png", "/b.png"]);
    expect(await api.pickFiles({ multiple: true })).toEqual([]);
    expect(await api.pickFiles({ multiple: false })).toEqual(["/a.png"]);
    expect(await api.pickFiles({ multiple: true })).toEqual(["/a.png", "/b.png"]);
    h.openDialog.mockResolvedValueOnce("/Folder").mockResolvedValueOnce(null);
    expect(await api.pickFolder()).toBe("/Folder");
    expect(await api.pickFolder()).toBeNull();
  });
});

describe("your own models, poses and scenes", () => {
  const traits = { name: "  ", gender: "woman" as const, age: 30, look: "south_asian", hair: "long black hair" };
  it("only adults between 18 and 90, and needs a key", async () => {
    await expect(api.createOwnModelFromWords(traits)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
    await connect();
    await expect(api.createOwnModelFromWords({ ...traits, gender: "girl" })).rejects.toThrow(/adult models only/);
    await expect(api.createOwnModelFromWords({ ...traits, age: 17 })).rejects.toThrow(/between 18 and 90/);
    await expect(api.createOwnModelFromWords({ ...traits, age: 91 })).rejects.toThrow(/between 18 and 90/);
  });
  it("makes three faces, then the sheet from the chosen face, and checks it", async () => {
    await connect();
    openai = (url) => (url.endsWith("/images/generations") ? ok({ data: [{ b64_json: PICTURE }] }) : new Response("{}", { status: 500 }));
    const m = await api.createOwnModelFromWords(traits);
    expect(m).toMatchObject({ name: "My model", status: "draft", madeFrom: "description" });
    const choosing = await until(async () => (await api.ownModel(m.id))?.status === "choosing-face" && (await api.ownModel(m.id)));
    expect(choosing.faceOptions).toHaveLength(3);
    expect(openaiCalls.filter((c) => c === "/images/generations")).toHaveLength(3);

    openai = (url) => {
      if (url.endsWith("/images/edits")) return ok({ data: [{ b64_json: PICTURE }] });
      if (url.endsWith("/responses")) return message(SHEET_OK);
      return new Response("{}", { status: 500 });
    };
    await expect(api.chooseFace(m.id, "face-9")).rejects.toThrow(/Choose one of the three/);
    const making = await api.chooseFace(m.id, "face-2");
    expect(making.status).toBe("making-sheet");
    const ready = await until(async () => (await api.ownModel(m.id))?.status === "ready" && (await api.ownModel(m.id)));
    expect(ready.sheetPath).toBe(`own-models/${m.id}/sheet.png`);
    expect(vfs.has(`/data/own-models/${m.id}/face-1.png`)).toBe(false); // the other faces are deleted
    expect((await api.renameOwnModel(m.id, " Meera ")).name).toBe("Meera");
    expect((await api.renameOwnModel(m.id, " ")).name).toBe("My model");
    expect(await api.ownModels()).toHaveLength(1);
    await api.remakeSheet(m.id);
    await until(async () => (await api.ownModel(m.id))?.status === "ready");
  });
  it("a sheet the check rejects is failed; a check that cannot run does not block the person", async () => {
    await connect();
    openai = (url) => (url.endsWith("/images/generations") ? ok({ data: [{ b64_json: PICTURE }] }) : new Response("{}", { status: 500 }));
    const m = await api.createOwnModelFromWords(traits);
    await until(async () => (await api.ownModel(m.id))?.status === "choosing-face");
    openai = (url) =>
      url.endsWith("/images/edits")
        ? ok({ data: [{ b64_json: PICTURE }] })
        : message({
            panels: 5,
            onePersonEach: true,
            samePerson: true,
            extraLimbsOrHands: false,
            textOrLogos: false,
            appearsUnder18: false,
            faults: ["only five panels"],
          });
    await api.chooseFace(m.id, "face-1");
    await until(async () => (await api.ownModel(m.id))?.status === "failed");
    openai = (url) => (url.endsWith("/images/edits") ? ok({ data: [{ b64_json: PICTURE }] }) : new Response("{}", { status: 500 }));
    await api.remakeSheet(m.id);
    await until(async () => (await api.ownModel(m.id))?.status === "ready");
  });
  it("faces that all fail leave the model failed", async () => {
    await connect();
    openai = () => new Response("{}", { status: 500 });
    const m = await api.createOwnModelFromWords(traits);
    await until(async () => (await api.ownModel(m.id))?.status === "failed");
  });
  it("makes a model from photos only after consent, with 1 to 3 photos, each checked", async () => {
    await connect();
    putFile("/me/1.jpg", fakePng(500, 700));
    putFile("/me/2.jpg", fakePng(500, 700));
    putFile("/me/bad.txt", "not a picture");
    const base = { name: "Me", paths: ["/me/1.jpg"], consent: true as const };
    await expect(api.createOwnModelFromPhotos({ ...base, consent: false as never })).rejects.toThrow(/agreed/);
    await expect(api.createOwnModelFromPhotos({ ...base, paths: [] })).rejects.toThrow(/1 to 3/);
    await expect(api.createOwnModelFromPhotos({ ...base, paths: ["/me/1.jpg", "/me/1.jpg", "/me/1.jpg", "/me/1.jpg"] })).rejects.toThrow(
      /1 to 3/,
    );
    await expect(api.createOwnModelFromPhotos({ ...base, paths: ["/me/bad.txt"] })).rejects.toThrow(/JPEG, PNG or WebP/);

    const check = (over: object = {}) =>
      message({ onePerson: true, faceClear: true, adult: true, publicFigure: false, reason: "", gender: "man", ageYears: 44, ...over });
    openai = (url) => (url.endsWith("/responses") ? check({ publicFigure: true }) : new Response("{}", { status: 500 }));
    await expect(api.createOwnModelFromPhotos(base)).rejects.toThrow(/Photo 1: .*public figure/);
    expect(await api.ownModels()).toEqual([]); // nothing was made, nothing was charged

    openai = (url, init) => {
      if (url.endsWith("/responses")) return bodyOf(init).includes("aaina_sheet_check") ? message(SHEET_OK) : check();
      if (url.endsWith("/images/edits")) return ok({ data: [{ b64_json: PICTURE }] });
      return new Response("{}", { status: 500 });
    };
    const m = await api.createOwnModelFromPhotos({ ...base, paths: ["/me/1.jpg", "/me/2.jpg"] });
    expect(m).toMatchObject({ gender: "man", age: 44, madeFrom: "photos", status: "making-sheet" });
    await until(async () => (await api.ownModel(m.id))?.status === "ready");
    expect(vfs.has(`/data/own-models/${m.id}/photo-2.bin`)).toBe(true);
    await api.remakeSheet(m.id);
    await until(async () => (await api.ownModel(m.id))?.status === "ready");
  });
  it("makes an own pose and scene in the background, and deleting a model removes its poses and files", async () => {
    await connect();
    putFile("/me/1.jpg", fakePng(500, 700));
    openai = (url, init) => {
      if (url.endsWith("/responses"))
        return bodyOf(init).includes("aaina_sheet_check")
          ? message(SHEET_OK)
          : message({ onePerson: true, faceClear: true, adult: true, publicFigure: false, reason: "", gender: "woman", ageYears: 30 });
      if (url.endsWith("/images/edits") || url.endsWith("/images/generations")) return ok({ data: [{ b64_json: PICTURE }] });
      return new Response("{}", { status: 500 });
    };
    const m = await api.createOwnModelFromPhotos({ name: "Me", paths: ["/me/1.jpg"], consent: true });
    await until(async () => (await api.ownModel(m.id))?.status === "ready");

    await expect(api.makePose({ model: { source: "own", id: m.id } })).rejects.toThrow(/Describe the pose/);
    const pose = await api.makePose({ model: { source: "own", id: m.id }, words: "  leaning on a wall " });
    expect(pose).toMatchObject({ status: "making", name: "leaning on a wall" });
    await until(async () => (await api.ownPoses({ source: "own", id: m.id })).find((p) => p.status === "ready"));
    await expect(api.makePose({ model: { source: "own", id: "gone" }, words: "x" })).rejects.toThrow(/sheet/);

    await expect(api.makeScene({ words: " " })).rejects.toThrow(/Describe the scene/);
    const scene = await api.makeScene({ words: "a sunny terrace" });
    expect(scene.status).toBe("making");
    await until(async () => (await api.ownScenes()).find((s) => s.status === "ready"));

    openai = () => new Response("{}", { status: 500 });
    const bad = await api.makeScene({ words: "this will fail" });
    await until(async () => (await api.ownScenes()).find((s) => s.id === bad.id && s.status === "failed"));

    await api.deleteOwnModel(m.id);
    expect(await api.ownModels()).toEqual([]);
    expect(await api.ownPoses({ source: "own", id: m.id })).toEqual([]);
    expect([...vfs.keys()].some((k) => k.includes(`own-models/${m.id}`))).toBe(false);
  });
});

describe("settings, backup and starting over", () => {
  it("updates settings and keeps them", async () => {
    const next = await api.updateSettings({ theme: "dark", parallel: 4, onboarded: true });
    expect(next).toMatchObject({ theme: "dark", parallel: 4, onboarded: true });
    expect(await api.settings()).toMatchObject({ theme: "dark" });
  });
  it("backs up to a folder, restores from it and relaunches", async () => {
    putFile("/Backups/.keep", "");
    const folder = await api.backup("/Backups");
    expect(folder).toMatch(/^\/Backups\/Aaina backup /);
    putFile(`${folder}/aaina.db`, "restored-db");
    await api.restore(folder);
    expect(h.relaunch).toHaveBeenCalled();
    expect(new TextDecoder().decode(vfs.get("/data/aaina.db")!)).toBe("restored-db");
    await expect(api.restore("/not-a-backup")).rejects.toThrow(/not an Aaina backup/);
  });
  it("deleting everything forgets rows, folders and keychain entries but leaves finished photo files", async () => {
    await connect();
    const { shoot } = await productWithShoot();
    openai = () => ok({ data: [{ b64_json: PICTURE }] });
    await api.makeShoot(shoot.id);
    const done = await until(async () => (await photosOf(shoot.id)).find((p) => p.status === "done"));
    await api.deleteEverything();
    expect(await api.products()).toEqual([]);
    expect(await api.shoots()).toEqual([]);
    expect(keychain.size).toBe(0);
    expect(vfs.has(`/Pictures/Aaina/${done.path}`)).toBe(true);
    expect(vfs.get("/data/products")).toBeNull(); // folders are recreated empty
  });
});

describe("ChatGPT sign in", () => {
  it("signing out when never signed in is harmless and reports the connection", async () => {
    const c = await api.signOutChatGPT();
    expect(c.chatgpt.signedIn).toBe(false);
  });
});
