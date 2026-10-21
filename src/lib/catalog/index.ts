import { fetch } from "@tauri-apps/plugin-http";
import type { DataLayer } from "../data";
import { createDiskStore } from "./cacheStore";
import { createCatalogCore, type HttpGet } from "./catalog";

export type { Catalog } from "./catalog";
export type { SuggestOptions } from "./suggestFor";

/** The catalogue backed by the app's disk cache and the CORS-free HTTP plugin. Call once at app start. */
export async function createCatalog(data: Pick<DataLayer, "files" | "settings">) {
  const store = await createDiskStore(await data.files.appPath("catalog-cache"));
  const get: HttpGet = (url) => fetch(url, { method: "GET", connectTimeout: 15_000 });
  return createCatalogCore({ store, get, offlineWanted: async () => (await data.settings.get()).offlineCatalogue });
}
