// For the tutorials and the demo video only: with `?catalog=live` in the address, the sample Api shows Aaina's real public
// catalogue (models, faces, poses, scenes) instead of its built-in samples. The page must be allowed to read
// static.aaina.world (the docs tool relays it); everything else stays sample data in memory.
import type { CatalogPose } from "../contract";
import { createCatalogCore } from "../catalog/catalog";
import type { CacheStore } from "../catalog/cacheStore";

export type LiveCatalog = ReturnType<typeof createLiveCatalog>;

export function createLiveCatalog() {
  const files = new Map<string, string | Uint8Array>();
  const store: CacheStore = {
    readText: async (name) => (typeof files.get(name) === "string" ? (files.get(name) as string) : null),
    writeText: async (name, text) => void files.set(name, text),
    readBytes: async (name) => (files.get(name) instanceof Uint8Array ? (files.get(name) as Uint8Array) : null),
    writeBytes: async (name, bytes) => void files.set(name, bytes),
    has: () => false,
    urlFor: (name) => name,
    size: async () => 0,
    clear: async () => files.clear(),
  };
  const catalog = createCatalogCore({ store, get: (url) => fetch(url), offlineWanted: async () => false });
  /** Every pose shown so far, so a photo can be named after its pose. */
  const seen = new Map<string, CatalogPose>();
  const posesFor: typeof catalog.posesFor = async (model) => {
    const poses = await catalog.posesFor(model);
    for (const pose of poses) seen.set(pose.id, pose);
    return poses;
  };
  return { ...catalog, posesFor, seenPose: (id: string) => seen.get(id) };
}
