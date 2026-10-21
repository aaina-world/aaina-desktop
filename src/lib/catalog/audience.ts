// Ported from Aaina (packages/contracts/src/productAudience.ts): who a product is made for. Only the types and the
// region → model look table; the desktop app has no photo-check call that fills `regions`, `sizes` or `modest`.
export type ProductAudience = {
  for: "women" | "men" | "unisex" | "girls" | "boys" | "kids" | null;
  ages: Array<"baby" | "kids" | "teen" | "young_adult" | "adult" | "mature">;
  regions: Array<keyof typeof REGION_LOOK>;
  sizes: Array<"plus" | "petite" | "tall" | "maternity">;
  modest: boolean;
  adaptive: boolean;
};

/** The model look a region's dress leads with. */
export const REGION_LOOK = {
  south_asia: "south_asian",
  east_asia: "east_asian",
  southeast_asia: "southeast_asian",
  africa: "black",
  middle_east: "middle_eastern",
  latin_america: "latin",
  europe: "white",
} as const;

/** Pinned items first, in pin order. */
export function pinnedFirst<T>(items: T[], pinned: readonly string[] | undefined, idOf: (item: T) => string) {
  if (!pinned?.length) return { items, pinned: 0 };
  const rank = new Map(pinned.map((id, index) => [id, index]));
  const lead = items.filter((item) => rank.has(idOf(item))).sort((a, b) => rank.get(idOf(a))! - rank.get(idOf(b))!);
  return { items: [...lead, ...items.filter((item) => !rank.has(idOf(item)))], pinned: lead.length };
}
