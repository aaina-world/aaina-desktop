import type { CatalogModel, ProductReading } from "../contract";
import type { ProductAudience } from "./audience";
import { orderModelSuggestions, type ModelLike } from "./suggest";

export type SuggestOptions = {
  /** The seller's product name: it may say who it is for ("Men's kurta"). */
  productName?: string | null;
  pinned?: readonly string[];
  /** The model last used for this kind of product: it leads. */
  lastUsed?: string | null;
};

const AUDIENCE_FOR: Record<NonNullable<ProductReading["audience"]>, ProductAudience["for"]> = {
  women: "women",
  men: "men",
  girls: "girls",
  boys: "boys",
  babies: "kids",
  unisex: "unisex",
};

/** What the desktop app knows about a product, in the form Aaina's ranking takes. No regions, sizes or modest flag: the
 *  desktop reading doesn't ask for them (the ranking still reads them from the product's words and type). */
export function audienceFromReading(reading: ProductReading): ProductAudience {
  return {
    for: reading.audience ? AUDIENCE_FOR[reading.audience] : null,
    ages: reading.audience === "babies" ? ["baby"] : [],
    regions: [],
    sizes: [],
    modest: false,
    adaptive: false,
  };
}

const asModelLike = (model: CatalogModel): ModelLike => ({
  id: model.id,
  name: model.name,
  gender: model.gender,
  ageGroup: model.ageGroup as ModelLike["ageGroup"],
  age: model.age,
  look: model.look as ModelLike["look"],
  body: model.body as ModelLike["body"],
  tags: model.tags as ModelLike["tags"],
  appearance: model.appearance,
  minor: model.minor,
  suits: model.suits ?? undefined,
  sharedPoses: model.poolKey !== null,
});

/** Models in suggestion order for a product reading (null: no product yet, so the general order). */
export function suggestModelsFor(models: CatalogModel[], reading: ProductReading | null, options: SuggestOptions = {}): CatalogModel[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  const text = [options.productName, reading?.label].filter(Boolean).join(" ") || null;
  const { visible } = orderModelSuggestions({
    models: models.map(asModelLike),
    targets: reading?.productType ? [reading.productType] : [],
    wearerText: text,
    audience: reading ? audienceFromReading(reading) : null,
    pinned: options.pinned,
    lastUsed: options.lastUsed ?? null,
  });
  return visible.map((model) => byId.get(model.id)!);
}
