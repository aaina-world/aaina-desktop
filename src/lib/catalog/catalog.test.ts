import { describe, expect, it } from "vitest";
import type { CacheStore } from "./cacheStore";
import { createCatalogCore, type HttpGet } from "./catalog";
import current from "./fixtures/current.json";
import models from "./fixtures/models.json";
import posesAaina from "./fixtures/poses-aaina.json";
import posesHana from "./fixtures/poses-hana.json";
import scenes from "./fixtures/scenes.json";
import sheets from "./fixtures/sheets.json";
import sheetsPointer from "./fixtures/sheets-current.json";

function memoryStore(): CacheStore & { files: Map<string, Uint8Array | string> } {
  const files = new Map<string, Uint8Array | string>();
  return {
    files,
    readText: async (name) => (typeof files.get(name) === "string" ? (files.get(name) as string) : null),
    writeText: async (name, text) => void files.set(name, text),
    readBytes: async (name) => (files.get(name) instanceof Uint8Array ? (files.get(name) as Uint8Array) : null),
    writeBytes: async (name, bytes) => void files.set(name, bytes),
    has: (name) => files.has(name),
    urlFor: (name) => `asset://${name}`,
    size: async () => [...files.values()].reduce((sum, value) => sum + value.length, 0),
    clear: async () => files.clear(),
  };
}

const B = "https://static.aaina.world/catalog/";
function network(options: { sheets?: boolean; down?: boolean } = {}) {
  const hits: string[] = [];
  const routes: Record<string, unknown> = {
    [`${B}current.json`]: current,
    [`${B}${current.lists.models}`]: models,
    [`${B}${current.lists.scenes}`]: scenes,
    [`${B}${current.lists.poses.aaina}`]: posesAaina,
    [`${B}${current.lists.poses.hana}`]: posesHana,
  };
  if (options.sheets !== false) {
    routes[`${B}sheets/current.json`] = sheetsPointer;
    routes[`${B}${sheetsPointer.list}`] = sheets;
  }
  const get: HttpGet = async (url) => {
    hits.push(url);
    if (options.down) throw new Error("offline");
    const body = routes[url];
    const text = body === undefined ? "Not found" : JSON.stringify(body);
    return {
      ok: body !== undefined || /\.webp$/.test(url),
      status: body !== undefined || /\.webp$/.test(url) ? 200 : 404,
      text: async () => text,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    };
  };
  return { get, hits };
}

const make = (store: CacheStore, net: ReturnType<typeof network>, offline = false) =>
  createCatalogCore({ store, get: net.get, offlineWanted: async () => offline });

describe("catalogue", () => {
  it("downloads the pointer and lists once, then reads from the cache", async () => {
    const store = memoryStore();
    const net = network();
    const catalog = make(store, net);
    const status = await catalog.refresh();
    expect(status).toMatchObject({ state: "ready", publishedAt: current.publishedAt, modelCount: 2 });
    expect((await catalog.models()).map((m) => m.id)).toEqual(["aaina", "hana"]);
    expect((await catalog.models())[0].sheetUrl).toContain("sheets/");

    // A second run, offline: everything comes from the cache.
    const offline = make(store, network({ down: true }));
    expect((await offline.models()).length).toBe(2);
    expect((await offline.status()).state).toBe("offline");
  });

  it("serves poses on demand (own set, pooled with shownOn) and caches the list", async () => {
    const catalog = make(memoryStore(), network());
    await catalog.refresh();
    expect((await catalog.posesFor("aaina")).length).toBe(4);
    const pooled = await catalog.posesFor({ source: "studio", id: "hana" });
    expect(pooled[0].shownOn?.name).toBe("Zara");
    expect(await catalog.posesFor("unknown")).toEqual([]);
  });

  it("treats 404 for the sheets as 'no sheets yet' (the model's own sheet photo is used)", async () => {
    const catalog = make(memoryStore(), network({ sheets: false }));
    await catalog.refresh();
    const hana = (await catalog.models()).find((m) => m.id === "hana")!;
    expect(hana.sheetUrl).toMatch(/^https:\/\/static\.aaina\.world\/catalog\/img\//);
  });

  it("never reports a failure before it has tried, and refreshes quietly when a catalogue is cached", async () => {
    const store = memoryStore();
    const first = make(store, network());
    expect((await first.status()).state).toBe("loading");
    await first.refresh();
    const next = make(store, network());
    const seen: string[] = [];
    next.subscribe(() => void next.status().then((s) => seen.push(s.state)));
    expect((await next.refresh()).state).toBe("ready");
    expect(seen).not.toContain("loading");
    expect(seen).not.toContain("never-loaded");
  });

  it("is never-loaded when the first download fails", async () => {
    const catalog = make(memoryStore(), network({ down: true }));
    expect((await catalog.refresh()).state).toBe("never-loaded");
    expect(await catalog.models()).toEqual([]);
  });

  it("pictureBytes fetches a pose picture at 1080 once and caches it", async () => {
    const store = memoryStore();
    const net = network();
    const catalog = make(store, net);
    await catalog.refresh();
    const [pose] = await catalog.posesFor("aaina");
    const bytes = await catalog.pictureBytes(pose.imageUrl);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    const again = await catalog.pictureBytes(pose.imageUrl);
    expect(again).toEqual(bytes);
    expect(net.hits.filter((url) => url.endsWith("-1080.webp")).length).toBe(1);
    await expect(catalog.pictureBytes("https://example.com/x.png")).rejects.toThrow();
  });

  it("downloads card pictures for offline use with progress, then shows the cached copy", async () => {
    const store = memoryStore();
    const catalog = make(store, network());
    await catalog.refresh();
    await catalog.startOfflineDownload();
    const cards = [...store.files.keys()].filter((name) => name.startsWith("img/") && name.endsWith("-640.webp"));
    expect(cards.length).toBeGreaterThan(5);
    expect((await catalog.scenes())[0].imageUrl).toMatch(/^asset:\/\/img\//);
    expect((await catalog.status()).progress).toBeUndefined();
  });

  it("orders suggestions for a reading and for none", async () => {
    const catalog = make(memoryStore(), network());
    await catalog.refresh();
    expect((await catalog.suggestModels(null)).length).toBe(2);
    const reading = {
      productType: "crewneck_tshirts",
      label: "T-shirt",
      audience: "women" as const,
      colour: null,
      material: null,
      details: null,
      reach: "upper" as const,
      readBy: "key" as const,
      readAt: "",
    };
    const ordered = await catalog.suggestModels(reading);
    expect(ordered[0].id).toBe("aaina"); // the only one with its own poses for a T-shirt
  });
});
