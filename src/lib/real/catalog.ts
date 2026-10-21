import type { Catalog } from "../catalog";
import type { Api } from "../contract";
import type { DataLayer } from "../data";
import type { Sources } from "./sources";

type Deps = { catalog: Catalog; data: Pick<DataLayer, "own" | "products" | "settings">; sources: Pick<Sources, "poolPosesFor"> };

export function createCatalogApi({
  catalog,
  data,
  sources,
}: Deps): Pick<Api, "catalogStatus" | "refreshCatalog" | "clearCatalogCache" | "models" | "posesFor" | "scenes" | "suggestModels"> {
  return {
    catalogStatus: () => catalog.status(),
    refreshCatalog: () => catalog.refresh(),
    async clearCatalogCache() {
      await catalog.clearCache();
      return catalog.status();
    },
    models: () => catalog.models(),
    async posesFor(model) {
      if (model.source === "studio") return catalog.posesFor(model);
      const own = await data.own.model(model.id);
      return own ? sources.poolPosesFor(own.gender) : [];
    },
    scenes: () => catalog.scenes(),
    async suggestModels(productId) {
      const product = productId ? await data.products.get(productId) : null;
      const { pins } = await data.settings.get();
      return catalog.suggestModels(product?.reading ?? null, { productName: product?.name, pinned: pins.models });
    },
  };
}
