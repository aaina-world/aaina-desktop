import type { CatalogModel, CatalogPose, CatalogScene, CatalogStatus, ModelRef, ProductReading } from "../contract";
import { logWarning } from "../log";
import type { CacheStore } from "./cacheStore";
import { mapModels, mapPoses, mapScenes } from "./map";
import { CDN_BASE, type RawModels, type RawPointer, type RawPoses, type RawScenes, type RawSheets, type RawSheetsPointer } from "./raw";
import { suggestModelsFor, type SuggestOptions } from "./suggestFor";
import { atWidth, catalogRelative, cdnUrl, CARD_WIDTH, ENGINE_WIDTH } from "./urls";

/** The little of `fetch` we use. In the app it is plugin-http's fetch (no CORS). */
export type HttpGet = (
  url: string,
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }>;

export type CatalogDeps = {
  store: CacheStore;
  get: HttpGet;
  /** Whether to keep pictures on this computer (Settings → offline catalogue). */
  offlineWanted: () => Promise<boolean>;
  clock?: () => string;
};

const POINTER = "current.json";
const SHEETS_POINTER = "sheets/current.json";
const META = "meta.json";
const PICTURE_CONCURRENCY = 3;

export type Catalog = ReturnType<typeof createCatalogCore>;

/** The catalogue without Tauri: everything it needs comes in through `deps`, so tests can fake the network and the disk. */
export function createCatalogCore(deps: CatalogDeps) {
  const { store, get } = deps;
  const clock = deps.clock ?? (() => new Date().toISOString());

  let pointer: RawPointer | null = null;
  let rawModels: RawModels | null = null;
  let rawScenes: RawScenes | null = null;
  let sheets = new Map<string, RawSheets["items"][number]>();
  const poseLists = new Map<string, RawPoses>();
  let checkedAt: string | null = null;
  let state: CatalogStatus["state"] = "never-loaded";
  let progress: CatalogStatus["progress"];
  let cacheLoaded: Promise<void> | null = null;
  let loaded: Promise<void> | null = null;
  let refreshing: Promise<CatalogStatus> | null = null;
  let downloadRun = 0; // bumped to cancel a background download
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  // ---- pictures ----
  /** Displayable address of a CDN-relative picture: the cached copy when we have it, else the CDN. */
  function show(relative: string, width = CARD_WIDTH): string {
    const rel = catalogRelative(relative) ?? relative;
    const name = atWidth(rel, width);
    return store.has(name) ? store.urlFor(name) : cdnUrl(name);
  }
  const showCard = (relative: string) => show(relative, CARD_WIDTH);

  async function download(relative: string): Promise<Uint8Array> {
    const response = await get(cdnUrl(relative));
    if (!response.ok) throw new Error(`Catalogue picture ${relative} answered ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  /**
   * The bytes of a catalogue picture, for the engine to send to OpenAI. Poses, scenes and cards are fetched at 1080
   * (or the width asked); sheets are one size. Cached after the first download. Accepts a relative path, a CDN URL or
   * the displayable address a catalogue item handed out.
   */
  async function pictureBytes(address: string, width: number = ENGINE_WIDTH): Promise<Uint8Array> {
    const relative = catalogRelative(address);
    if (!relative) throw new Error("Not a catalogue picture");
    const name = atWidth(relative, width);
    const cached = await store.readBytes(name);
    if (cached) return cached;
    const bytes = await download(name);
    await store.writeBytes(name, bytes);
    return bytes;
  }

  // ---- lists ----
  async function readCachedJson<T>(name: string): Promise<T | null> {
    const text = await store.readText(name);
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  /** Lists are immutable by name: cached, else downloaded once. */
  async function list<T>(relative: string): Promise<T> {
    const cached = await readCachedJson<T>(relative);
    if (cached) return cached;
    const response = await get(cdnUrl(relative));
    if (!response.ok) throw new Error(`Catalogue list ${relative} answered ${response.status}`);
    const text = await response.text();
    const value = JSON.parse(text) as T;
    await store.writeText(relative, text);
    return value;
  }

  async function loadSheets(fresh: boolean): Promise<void> {
    let sheetsPointer = await readCachedJson<RawSheetsPointer>(SHEETS_POINTER);
    if (fresh) {
      try {
        const response = await get(cdnUrl(SHEETS_POINTER));
        if (response.ok) {
          const text = await response.text();
          sheetsPointer = JSON.parse(text) as RawSheetsPointer;
          await store.writeText(SHEETS_POINTER, text);
        } // 404: no sheets published yet
      } catch {
        /* keep what we have */
      }
    }
    if (!sheetsPointer) return;
    try {
      const all = await list<RawSheets>(sheetsPointer.list);
      sheets = new Map(all.items.map((item) => [item.modelId, item]));
    } catch {
      /* offline and never downloaded: models fall back to their own sheet photo */
    }
  }

  /** Reads whatever is cached (instant, offline-safe). */
  async function loadFromCache(): Promise<void> {
    pointer = await readCachedJson<RawPointer>(POINTER);
    checkedAt = (await readCachedJson<{ checkedAt: string }>(META))?.checkedAt ?? null;
    if (!pointer) return;
    rawModels = await readCachedJson<RawModels>(pointer.lists.models);
    rawScenes = await readCachedJson<RawScenes>(pointer.lists.scenes);
    await loadSheets(false);
    state = rawModels && rawScenes ? "offline" : "never-loaded";
  }

  const readCache = () => (cacheLoaded ??= loadFromCache());

  /** Cached data is available at once; with nothing cached yet the first call waits for the download. */
  const ensureLoaded = () =>
    (loaded ??= readCache().then(async () => {
      if (!rawModels) await refresh();
      else void refresh().catch(() => undefined); // pick up a newer catalogue without making the screen wait
    }));

  async function doRefresh(): Promise<CatalogStatus> {
    await readCache();
    state = "loading";
    changed();
    try {
      const response = await get(cdnUrl(POINTER));
      if (!response.ok) throw new Error(`Catalogue answered ${response.status}`);
      const text = await response.text();
      const next = JSON.parse(text) as RawPointer;
      const models = await list<RawModels>(next.lists.models);
      const scenes = await list<RawScenes>(next.lists.scenes);
      await store.writeText(POINTER, text); // last, so the cache never points at lists we don't have
      pointer = next;
      rawModels = models;
      rawScenes = scenes;
      await loadSheets(true);
      checkedAt = clock();
      await store.writeText(META, JSON.stringify({ checkedAt }));
      state = "ready";
      changed();
      void deps
        .offlineWanted()
        .then((wanted) => (wanted ? startOfflineDownload() : undefined))
        .catch(() => undefined);
    } catch (error) {
      void logWarning("Catalogue refresh failed", error);
      state = rawModels ? "offline" : "never-loaded";
      changed();
    }
    return status();
  }

  function refresh(): Promise<CatalogStatus> {
    refreshing ??= doRefresh().finally(() => (refreshing = null));
    return refreshing;
  }

  // ---- reads ----
  async function status(): Promise<CatalogStatus> {
    return {
      state,
      publishedAt: pointer?.publishedAt ?? null,
      checkedAt,
      modelCount: rawModels?.items.length ?? 0,
      cacheBytes: await store.size(),
      ...(progress ? { progress } : {}),
    };
  }

  async function models(): Promise<CatalogModel[]> {
    await ensureLoaded();
    return rawModels ? mapModels(rawModels, sheets, showCard) : [];
  }

  async function scenes(): Promise<CatalogScene[]> {
    await ensureLoaded();
    return rawScenes ? mapScenes(rawScenes.items, showCard) : [];
  }

  async function poseList(name: string): Promise<RawPoses | null> {
    const known = poseLists.get(name);
    if (known) return known;
    try {
      const value = await list<RawPoses>(name);
      poseLists.set(name, value);
      return value;
    } catch {
      return null;
    }
  }

  /** The poses of a model: its own studio set, or its pool's shared poses. Studio models only; the own models' poses live in the data layer. */
  async function posesFor(model: ModelRef | string): Promise<CatalogPose[]> {
    await ensureLoaded();
    const id = typeof model === "string" ? model : model.id;
    const name = pointer?.lists.poses[id];
    if (!name) return [];
    const value = await poseList(name);
    return value ? mapPoses(value.looks, value.studio, value.modelId, showCard) : [];
  }

  async function sheetUrlFor(modelId: string): Promise<string | null> {
    await ensureLoaded();
    const sheet = sheets.get(modelId);
    return sheet ? show(sheet.url) : ((await models()).find((model) => model.id === modelId)?.sheetUrl ?? null);
  }

  async function suggestModels(reading: ProductReading | null, options?: SuggestOptions): Promise<CatalogModel[]> {
    return suggestModelsFor(await models(), reading, options);
  }

  // ---- offline pictures ----
  /** Every picture worth keeping for browsing offline, at card width. */
  async function offlineNames(): Promise<string[]> {
    const names = new Set<string>();
    const add = (relative: string | null | undefined) => {
      const rel = relative && catalogRelative(relative);
      if (rel) names.add(atWidth(rel, CARD_WIDTH));
    };
    for (const model of rawModels?.items ?? []) {
      add(model.previewImageUrl);
      add(model.faceImageUrl);
    }
    for (const scene of rawScenes?.items ?? []) add(scene.imageUrl);
    const uniqueLists = [...new Set(Object.values(pointer?.lists.poses ?? {}))];
    for (const name of uniqueLists) {
      const value = await poseList(name);
      for (const pose of [...(value?.looks ?? []), ...(value?.studio ?? [])]) add(pose.imageUrl);
    }
    return [...names];
  }

  /** Downloads card-width pictures in the background, three at a time, skipping what is cached. Safe to call again. */
  async function startOfflineDownload(): Promise<void> {
    const run = ++downloadRun;
    const names = (await offlineNames()).filter((name) => !store.has(name));
    if (!names.length) {
      progress = undefined;
      changed();
      return;
    }
    let done = 0;
    progress = { done, total: names.length };
    changed();
    let next = 0;
    const worker = async () => {
      while (run === downloadRun && next < names.length) {
        const name = names[next++];
        try {
          await store.writeBytes(name, await download(name));
        } catch {
          /* a picture that fails is fetched from the CDN when shown */
        }
        done += 1;
        progress = { done, total: names.length };
        if (done % 25 === 0 || done === names.length) changed();
      }
    };
    await Promise.all(Array.from({ length: PICTURE_CONCURRENCY }, worker));
    if (run === downloadRun) progress = undefined;
    changed();
  }

  function stopOfflineDownload(): void {
    downloadRun += 1;
    progress = undefined;
    changed();
  }

  /** Deletes cached pictures and lists (the catalogue is downloaded again when needed). */
  async function clearCache(): Promise<void> {
    stopOfflineDownload();
    await store.clear();
    poseLists.clear();
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };

  return {
    status,
    refresh,
    models,
    scenes,
    posesFor,
    sheetUrlFor,
    suggestModels,
    pictureBytes,
    startOfflineDownload,
    stopOfflineDownload,
    clearCache,
    subscribe,
    CDN_BASE,
  };
}
