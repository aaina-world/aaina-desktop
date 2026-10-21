// Node helper for the docs tools: Aaina's public catalogue, read with the app's own catalogue code.
import { createCatalogCore } from "../../../src/lib/catalog/catalog";
import type { CacheStore } from "../../../src/lib/catalog/cacheStore";

export function nodeCatalog() {
  const files = new Map<string, string | Uint8Array>();
  const store = {
    readText: async (n: string) => (typeof files.get(n) === "string" ? (files.get(n) as string) : null),
    writeText: async (n: string, t: string) => void files.set(n, t),
    readBytes: async (n: string) => (files.get(n) instanceof Uint8Array ? (files.get(n) as Uint8Array) : null),
    writeBytes: async (n: string, b: Uint8Array) => void files.set(n, b),
    has: () => false,
    urlFor: (n: string) => n,
    size: async () => 0,
    clear: async () => files.clear(),
  } as unknown as CacheStore;
  return createCatalogCore({ store, get: (url) => fetch(url), offlineWanted: async () => false });
}
