// The product reading. Composed from Aaina's own wording: the product type rules (contracts quickReading.ts, QUICK_PRODUCT_TYPE_INSTRUCTION),
// the audience question (productAudience.ts) and the "inspect only the actual product photos" opening of the full reader (reading.ts posePrompt).
// One short call: what it is, who it is for, its colour, material and details, and which part of the body it covers.
import type { ProductReading } from "../../contract";

export const PRODUCT_TYPE_INSTRUCTION =
  "Judge by what the item is, not by one of its parts: an Indian two-piece of a short fitted or jacket-style top over a long flared skirt is lehengas; a kurta or tunic top on its own (even worn with jeans) is kurtas; kurta_sets only when matching bottoms or a dupatta are part of the product, or for an anarkali (a long flared kurta, usually with a dupatta); a draped saree is sarees; a western matching top and bottom is coordinated_sets.";

export const READING_REACH = ["upper", "lower", "full", "feet", "accessory"] as const;
export const READING_AUDIENCE = ["women", "men", "girls", "boys", "babies", "unisex"] as const;

export function readingPrompt(productTypes: string[] | null, names: Array<[string, string]> = [], productName?: string | null): string {
  const types = productTypes?.length
    ? ` Set productType to the one product type that best names the main item for sale, or null when none fits: ${productTypes.map((id) => `${id}${names.find(([k]) => k === id) ? ` (${names.find(([k]) => k === id)![1]})` : ""}`).join(", ")}. ${PRODUCT_TYPE_INSTRUCTION}`
    : " Set productType to null.";
  return `A seller's photos of one product for sale. Inspect only the actual product photos and judge only the item for sale, never the person shown.${productName?.trim() ? ` The seller's product name: ${JSON.stringify(productName.trim().slice(0, 200))}.` : ""} Answer: label (the product in one to four plain words, such as "T-shirt" or "silk saree"); audience (who the product is made for: women, men, girls, boys, babies or unisex, or null if you cannot tell); colour (one or two words, or null); material (how the fabric or material looks, without naming a fibre you cannot see, or null); details (one short line of visible details such as print, buttons or embroidery, or null); reach (which part of the body it covers: upper, lower, full for dresses and full outfits, feet for footwear, accessory for bags, jewellery and the like).${types} Do not invent details that are not visible.`;
}

export const readingSchema = (productTypes: string[] | null) =>
  ({
    type: "object",
    additionalProperties: false,
    required: ["label", "productType", "audience", "colour", "material", "details", "reach"],
    properties: {
      label: { type: "string", maxLength: 60 },
      productType: productTypes?.length ? { type: ["string", "null"], enum: [...productTypes, null] } : { type: "null" },
      audience: { type: ["string", "null"], enum: [...READING_AUDIENCE, null] },
      colour: { type: ["string", "null"], maxLength: 40 },
      material: { type: ["string", "null"], maxLength: 60 },
      details: { type: ["string", "null"], maxLength: 160 },
      reach: { type: ["string", "null"], enum: [...READING_REACH, null] },
    },
  }) as const;

const text = (v: unknown, max: number) =>
  typeof v === "string" && v.replace(/[\u0000-\u001f]+/g, " ").trim()
    ? v
        .replace(/[\u0000-\u001f]+/g, " ")
        .trim()
        .slice(0, max)
    : null;

/** Cleans the reader's answer into a ProductReading (anything malformed is dropped, never the reading). */
export function readingFromAnswer(
  raw: unknown,
  productTypes: string[] | null,
  by: ProductReading["readBy"],
  now = new Date(),
): ProductReading | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Readers differ in case ("jacket", "Jacket"); names shown as a field start with a capital, colours stay as said.
  const raise = (value: string | null) => (value ? value[0].toUpperCase() + value.slice(1) : value);
  const label = raise(text(r.label, 60));
  if (!label) return null;
  const type = typeof r.productType === "string" && (!productTypes || productTypes.includes(r.productType)) ? r.productType : null;
  return {
    productType: type,
    label,
    audience: (READING_AUDIENCE as readonly unknown[]).includes(r.audience) ? (r.audience as ProductReading["audience"]) : null,
    colour: text(r.colour, 40),
    material: raise(text(r.material, 60)),
    details: text(r.details, 160),
    reach: (READING_REACH as readonly unknown[]).includes(r.reach) ? (r.reach as ProductReading["reach"]) : null,
    readBy: by,
    readAt: now.toISOString(),
  };
}
