/**
 * Ported from Aaina (packages/contracts/src/modelDetails.ts): the one model ranking Aaina's website and phone use.
 * Pinned models first, then models suggested for the product (how many of their own poses suit it, and who it is for),
 * then everyone else. Same logic and wording as the original; only the zod id lists were dropped.
 */
import { pinnedFirst, REGION_LOOK, type ProductAudience } from "./audience";
import { matchesSearch } from "./searchText";
import { POSE_CATEGORIES, withTwinCategories } from "./poseTaxonomy";

type Option<T extends string> = { id: T; label: string; one: string };

/** Filter labels (plural) and the admin's words for one model (`one`). */
export const MODEL_GENDERS = [
  { id: "woman", label: "Women", one: "Woman" },
  { id: "man", label: "Men", one: "Man" },
  { id: "girl", label: "Girls", one: "Girl" },
  { id: "boy", label: "Boys", one: "Boy" },
] as const satisfies readonly Option<string>[];
export const MODEL_AGE_GROUPS = [
  { id: "baby", label: "Babies", one: "Baby (under 3)" },
  { id: "kids", label: "Kids", one: "Child (under 13)" },
  { id: "teen", label: "Teens", one: "Teen (13–17)" },
  { id: "adult", label: "Adults", one: "Adult" },
  { id: "mature", label: "Mature", one: "Mature (50+)" },
] as const satisfies readonly Option<string>[];
export const MODEL_LOOKS = [
  { id: "south_asian", label: "South Asian", one: "South Asian" },
  { id: "east_asian", label: "East Asian", one: "East Asian" },
  { id: "southeast_asian", label: "Southeast Asian", one: "Southeast Asian" },
  { id: "black", label: "Black", one: "Black" },
  { id: "middle_eastern", label: "Middle Eastern", one: "Middle Eastern" },
  { id: "latin", label: "Hispanic / Latino", one: "Hispanic / Latino" },
  { id: "white", label: "White", one: "White" },
  { id: "mixed", label: "Multiracial", one: "Multiracial" },
  { id: "indigenous", label: "Indigenous", one: "Indigenous" },
] as const satisfies readonly Option<string>[];
export const MODEL_BODIES = [
  { id: "slim", label: "Slim", one: "Slim" },
  { id: "average", label: "Average", one: "Average" },
  { id: "athletic", label: "Athletic", one: "Athletic" },
  { id: "curvy", label: "Curvy", one: "Curvy" },
  { id: "plus", label: "Plus size", one: "Plus size" },
] as const satisfies readonly Option<string>[];
export const MODEL_TAGS = [
  { id: "modest", label: "Modest wear", one: "Modest wear" },
  { id: "maternity", label: "Maternity", one: "Maternity" },
  { id: "adaptive", label: "Adaptive", one: "Adaptive" },
  { id: "supermodel", label: "Supermodels", one: "Supermodel" },
] as const satisfies readonly Option<string>[];

export type ModelGender = (typeof MODEL_GENDERS)[number]["id"];
export type ModelAgeGroup = (typeof MODEL_AGE_GROUPS)[number]["id"];
export type ModelLook = (typeof MODEL_LOOKS)[number]["id"];
export type ModelBody = (typeof MODEL_BODIES)[number]["id"];
export type ModelTag = (typeof MODEL_TAGS)[number]["id"];

/** A model's details (each may be unknown until an admin fills it in). */
export type ModelDetails = {
  gender?: ModelGender | null;
  ageGroup?: ModelAgeGroup | null;
  /**
   * The model's age in years (Admin → Models; a sheet model's from its traits). Optional: older lists and apps don't have
   * it. Suggestions order by it ("Adult" spans 18 to 49); the filters still use `ageGroup`.
   */
  age?: number | null;
  look?: ModelLook | null;
  body?: ModelBody | null;
  tags?: ModelTag[];
};

/**
 * How many of a model's own studio poses are tagged for each product type (POSE_CATEGORIES id):
 * `[best, also]`. Only types with at least one pose are listed.
 */
export type ModelPoseSuits = Record<string, [number, number]>;

export type ModelLike = ModelDetails & {
  id: string;
  name: string;
  minor?: boolean;
  appearance?: string | null;
  suits?: ModelPoseSuits;
  /** Its poses come from the shared pool (other models' studio poses): among equals, models with their own poses lead. */
  sharedPoses?: boolean;
};

/** The filter groups, in the order they are shown. */
export const MODEL_FILTER_GROUPS = [
  { key: "gender", title: "Gender", all: "All", options: MODEL_GENDERS },
  { key: "ageGroup", title: "Age", all: "All ages", options: MODEL_AGE_GROUPS },
  { key: "look", title: "Ethnicity", all: "All ethnicities", options: MODEL_LOOKS },
  { key: "body", title: "Body type", all: "All body types", options: MODEL_BODIES },
  { key: "tags", title: "Collections", all: "All collections", options: MODEL_TAGS },
] as const;
export type ModelFilterKey = (typeof MODEL_FILTER_GROUPS)[number]["key"];
/** The chosen value of each filter ("all" or missing: no filter). */
export type ModelFilters = Partial<Record<ModelFilterKey, string>>;

const valuesOf = (model: ModelLike, key: ModelFilterKey): string[] =>
  key === "tags" ? [...(model.tags ?? [])] : model[key] ? [model[key]] : [];

/**
 * The filter groups worth showing for these models: a group only when it tells them apart (at
 * least two of its values among them; "Collections" when some models have a tag and others don't), with
 * only the values some model has.
 */
export function modelFilterGroups(models: readonly ModelLike[]) {
  return MODEL_FILTER_GROUPS.map((group) => {
    const present = new Set(models.flatMap((model) => valuesOf(model, group.key)));
    const options = group.options.filter((option) => present.has(option.id)).map(({ id, label }) => ({ id, label }));
    const useful = group.key === "tags" ? options.length > 0 && models.some((model) => !model.tags?.length) : options.length >= 2;
    return { key: group.key, title: group.title, all: group.all, options: useful ? options : [] };
  }).filter((group) => group.options.length > 0);
}

/** Extra words people type for a gender ("male", "lady"), found along with the label. */
const GENDER_WORDS: Record<ModelGender, string> = { woman: "female lady", man: "male guy", girl: "female", boy: "male" };

/**
 * Hair, eye and facial-hair phrases ("short wavy black hair", "brown eyes", "a trimmed beard") are
 * left out of what search reads, so "black" finds Black models and "white" White models, not
 * everyone with black or white hair.
 */
const LOOKS_WORDS =
  /\b(?:(?!with\b|and\b|a\b|an\b|the\b|in\b|her\b|his\b|of\b|has\b)[a-z'-]+[\s,]+){0,4}(?:hair|haired|hairstyle|ponytail|braids?|locs|curls|eyes?|eyed|brows?|beard|bearded|moustache|mustache|stubble|goatee)\b/gi;
export function withoutHairAndEyes(appearance: string): string {
  return appearance.replace(LOOKS_WORDS, " ").replace(/\s+/g, " ").trim();
}

/** The words a model is found by: its name, what it looks like (minus hair and eye colours), and every detail's label. */
export function modelSearchText(model: ModelLike): string {
  const labels = MODEL_FILTER_GROUPS.flatMap((group) =>
    valuesOf(model, group.key).flatMap((id) => {
      const option = (group.options as readonly Option<string>[]).find((item) => item.id === id);
      return option ? [option.label, option.one] : [];
    }),
  );
  const gender = model.gender ? [GENDER_WORDS[model.gender]] : [];
  return [model.name, model.appearance ? withoutHairAndEyes(model.appearance) : "", ...labels, ...gender]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Product types only made for women, or only for men (anything else could be either). */
const WOMENS_TYPES = new Set([
  "blouses",
  "mini_skirts",
  "midi_skirts",
  "maxi_skirts",
  "mini_dresses",
  "midi_dresses",
  "maxi_dresses",
  "sarees",
  "lehengas",
  "half_sarees",
  "kurta_sets",
  "heels",
  "womens_innerwear",
  "bodysuits",
  "shapewear",
  "hijabs",
  "abayas",
  "cheongsam",
  "kebaya_baju_kurung",
  "tunics",
]);
const MENS_TYPES = new Set([
  "formal_shirts",
  "two_piece_suits",
  "waistcoats",
  "kurta_pajama_sets",
  "nehru_jackets",
  "kurta_jacket_sets",
  "sherwanis",
  "jodhpuri_suits",
  "veshti_dhoti",
  "formal_laceups",
  "ties_bowties",
  "pocket_squares",
  "safa_turbans",
  "ethnic_malas",
  "mens_innerwear",
  "swim_shorts",
  "athletic_tanks",
  "thobes",
  "smocks_fugu",
  "senator_sets",
  "agbada",
  "kufi_caps",
]);
/** Never suggested with anyone under 18, whatever the product's words say (intimate or swim wear). */
const ADULT_ONLY_TYPES = new Set(["womens_innerwear", "mens_innerwear", "shapewear", "bodysuits"]);
const ADULT_ONLY_WORDS = /\b(lingerie|innerwear|underwear|bra|bras|panty|panties|briefs|boxers|shapewear|bridal|nightwear|negligee)\b/;
/** Swim wear is adult-only too, unless the product is clearly labelled for children. */
const SWIM_TYPES = new Set(["swimwear", "swim_shorts"]);
const SWIM_WORDS = /\b(swimsuit|swimsuits|swimwear|bikini|bikinis|swim|trunks)\b/;
const CHILD_WORDS =
  /\b(girl|girls|girl's|girls'|boy|boys|boy's|boys'|kid|kids|kid's|kids'|child|children|children's|toddler|baby(?!\s+(?:pink|blue|yellow|green|lilac|purple|peach|mint|white|grey|gray|orange|red|lavender|doll|tee|tees|t-shirt|tshirt))|infant|teen|teens|teenage|teenager|teenagers|tween)\b/;
/** Modest wear, by type and by words: modest models lead for these. */
const MODEST_TYPES = new Set(["hijabs", "abayas", "kaftans", "headwraps", "kebaya_baju_kurung"]);
const MODEST_WORDS = /\b(modest|hijab|hijabs|abaya|abayas|jilbab|burqa|niqab|burkini)\b/;
const MATERNITY_WORDS = /\b(maternity|pregnancy|pregnant|nursing|expecting|expectant|bump)\b/;
const ADAPTIVE_WORDS = /\b(adaptive|wheelchair|prosthetic|disability|disabled)\b/;
/** Baby and toddler wear ("baby pink" and the like are colours, not babies). */
const BABY_WORDS =
  /\b(baby(?!\s+(?:pink|blue|yellow|green|lilac|purple|peach|mint|white|grey|gray|orange|red|lavender|doll|tee|tees|t-shirt|tshirt))|babies|infant|infants|newborn|newborns|toddler|toddlers|onesie|onesies|romper|rompers)\b/;
const TEEN_WORDS = /\b(teen|teens|teenage|teenager|teenagers|tween)\b/;

const textOf = (value?: string | null) => ` ${(value ?? "").toLowerCase().replace(/[’`]/g, "'")} `;

/**
 * Garments that belong to a region: models of that look lead their suggestions, right after who the product is for
 * (owner, 2026-10-07: "I uploaded a saree, a South Asian model should be on top"). Data, not rules: a new regional type
 * is one more entry. Indian wear and African wear count as whole families.
 */
export const REGIONAL_LOOKS: Readonly<Record<string, readonly string[]>> = {
  juttis_mojaris: ["south_asian"],
  ethnic_malas: ["south_asian"],
  safa_turbans: ["south_asian"],
  thobes: ["middle_eastern"],
  abayas: ["middle_eastern"],
  kimono_yukata: ["east_asian"],
  cheongsam: ["east_asian"],
  hanbok: ["east_asian"],
  kebaya_baju_kurung: ["southeast_asian"],
  filipiniana: ["southeast_asian"],
  headwraps: ["black"],
};
/** Whole families of regional wear. */
const REGIONAL_FAMILIES: Readonly<Record<string, string>> = { indian_wear: "south_asian", african_wear: "black" };
/** The looks a product's types call for (none for everyday clothes, which suit everyone). */
export function productLooks(targets: readonly string[]): Set<string> {
  const looks = new Set<string>();
  for (const id of targets) {
    const family = REGIONAL_FAMILIES[POSE_CATEGORIES[id]?.family ?? ""];
    if (family) looks.add(family);
    for (const look of REGIONAL_LOOKS[id] ?? []) looks.add(look);
  }
  return looks;
}

/** Plus-size and mature lines, in the seller's own words (the photo reading rarely sees either). */
const PLUS_WORDS = /\b(plus[- ]size|plus[- ]sized|curve|curvy|big and tall|extended sizes?|[2-6]xl)\b/;
const MATURE_WORDS = /\b(mother of the (?:bride|groom)|mother-of-the-(?:bride|groom)|mature|senior|older women|older men)\b/;

/** What the product asks of a model beyond who wears it: by its words and its types. */
export function productFocus(input: { targets: readonly string[]; text?: string | null }) {
  const text = textOf(input.text);
  const targets = input.targets.filter((id) => POSE_CATEGORIES[id]);
  return {
    // A baby bodysuit is baby wear, not an adult bodysuit.
    adultOnly:
      (targets.some((id) => ADULT_ONLY_TYPES.has(id)) && !BABY_WORDS.test(text)) ||
      ADULT_ONLY_WORDS.test(text) ||
      ((targets.some((id) => SWIM_TYPES.has(id)) || SWIM_WORDS.test(text)) && !CHILD_WORDS.test(text)),
    maternity: MATERNITY_WORDS.test(text),
    modest: targets.some((id) => MODEST_TYPES.has(id)) || MODEST_WORDS.test(text),
    adaptive: ADAPTIVE_WORDS.test(text),
    teen: TEEN_WORDS.test(text),
    baby: BABY_WORDS.test(text),
    plus: PLUS_WORDS.test(text),
    mature: MATURE_WORDS.test(text),
  };
}

/** Who the product is for, when it says: its words ("Men's kurta", "girls' frock"), else its type. */
export type ProductWearer = "women" | "men" | "girls" | "boys" | "kids";

export function productWearer(input: { targets: readonly string[]; text?: string | null }): ProductWearer | null {
  const text = textOf(input.text);
  const focus = productFocus(input);
  if (!focus.adultOnly) {
    if (/\b(girl|girls|girl's|girls')\b/.test(text)) return "girls";
    if (/\b(boy|boys|boy's|boys')\b/.test(text)) return "boys";
    if (CHILD_WORDS.test(text)) return "kids";
  }
  if (/\b(women|women's|womens|woman|woman's|ladies|lady|female)\b/.test(text)) return "women";
  if (/\b(men|men's|mens|man|man's|gents|male)\b/.test(text)) return "men";
  const targets = input.targets.filter((id) => POSE_CATEGORIES[id]);
  if (!targets.length) return focus.maternity ? "women" : null;
  if (!focus.adultOnly && targets.every((id) => id === "frocks")) return "girls";
  if (!focus.adultOnly && targets.every((id) => id === "frocks" || id === "school_uniforms")) return "kids";
  if (targets.every((id) => WOMENS_TYPES.has(id))) return "women";
  if (targets.every((id) => MENS_TYPES.has(id))) return "men";
  return focus.maternity ? "women" : null;
}

const CHILD_AGES: readonly string[] = ["baby", "kids", "teen"];
/** Whether a model is a child or teen: the flag, the age group, or a girl or boy. */
export function isChildModel(model: ModelLike) {
  return Boolean(model.minor) || CHILD_AGES.includes(model.ageGroup ?? "") || model.gender === "girl" || model.gender === "boy";
}

/**
 * The ages most fashion catalogues are shot on (owner, 2026-10-08: "Adults" put 38 to 48-year-olds near the top for an everyday
 * top). Suggestions lead with models up to this age unless the product asks for another (mother-of-the-bride wear: mature).
 */
export const PRIME_AGE_MAX = 34;
export type ModelAgeBand = "child" | "prime" | "older" | "mature";
/**
 * Where a model sits by age: a child or teen, prime (18 to 34), older (35 to 49) or mature (50 and over). Its `age` when known,
 * else its age group (an adult of unknown age counts as prime, as before ages were stored); null when neither is set.
 */
export function modelAgeBand(model: ModelLike): ModelAgeBand | null {
  if (isChildModel(model)) return "child";
  if (model.ageGroup === "mature" || (typeof model.age === "number" && model.age >= 50)) return "mature";
  if (typeof model.age === "number") return model.age <= PRIME_AGE_MAX ? "prime" : "older";
  return model.ageGroup === "adult" ? "prime" : null;
}
const SPECIFIC_TAGS: readonly string[] = ["modest", "maternity", "adaptive"];
/** A model from a specific line (plus size, modest, maternity, adaptive): it leads when the product asks for it, not by default. */
export function specificModel(model: ModelLike): boolean {
  return model.body === "plus" || Boolean(model.tags?.some((tag) => SPECIFIC_TAGS.includes(tag)));
}
/** How far a model's age is from a catalogue's usual 25 (unknown: 5): the last tie-break before the studio's order. */
const ageGap = (model: ModelLike) => (typeof model.age === "number" ? Math.abs(model.age - 25) : 5);

/**
 * Whether the model can wear the product: true (right for it), false (wrong for it: a men's
 * model for a saree, a child for an adult's product) or null (can't tell).
 */
export function modelWearerFit(model: ModelLike, wearer: ProductWearer | null): boolean | null {
  const child = isChildModel(model);
  if (!wearer) return child ? false : null;
  if (wearer === "kids") return child;
  if (wearer === "girls" || wearer === "boys") {
    if (!child) return false;
    if (!model.gender) return null;
    return model.gender === (wearer === "girls" ? "girl" : "boy");
  }
  if (child) return false;
  if (!model.gender) return null;
  return model.gender === (wearer === "women" ? "woman" : "man");
}

/** At least this many of a model's poses made for the product before the model is suggested. */
export const MODEL_SUGGEST_MIN_POSES = 3;

/**
 * How well a model's own studio poses suit the product: poses made for the product's own types
 * count most ("best" 3, "also" 1), poses made for their men's or women's twin less ("best" 1).
 * `poses` is how many of its poses are made ("best") for the product or a twin.
 */
export function modelPoseFit(model: ModelLike, targets: readonly string[]) {
  const suits = model.suits ?? {};
  const own = new Set(targets);
  let score = 0;
  let poses = 0;
  for (const id of withTwinCategories([...targets])) {
    const [best, also] = suits[id] ?? [0, 0];
    poses += best;
    score += own.has(id) ? 3 * best + also : best;
  }
  return { score, poses };
}

type Rank = { tier: number; score: number };

/**
 * Best tier first; inside a tier, take the model whose ethnicity, then body type, has been shown
 * least so far (so the top shows variety, not six look-alikes), then a model with poses of its own
 * before one using the shared pool, then the higher pose score, then the age nearest 25, then
 * the studio's order. Deterministic.
 */
function diversify<T extends ModelLike>(items: { model: T; index: number }[], rank: Map<string, Rank>): T[] {
  const left = [...items];
  const looks = new Map<string, number>();
  const bodies = new Map<string, number>();
  const out: T[] = [];
  while (left.length) {
    const top = Math.max(...left.map(({ model }) => rank.get(model.id)!.tier));
    const pool = left.filter(({ model }) => rank.get(model.id)!.tier === top);
    pool.sort(
      (a, b) =>
        (looks.get(a.model.look ?? "") ?? 0) - (looks.get(b.model.look ?? "") ?? 0) ||
        (bodies.get(a.model.body ?? "") ?? 0) - (bodies.get(b.model.body ?? "") ?? 0) ||
        Number(Boolean(a.model.sharedPoses)) - Number(Boolean(b.model.sharedPoses)) ||
        rank.get(b.model.id)!.score - rank.get(a.model.id)!.score ||
        ageGap(a.model) - ageGap(b.model) ||
        a.index - b.index,
    );
    const pick = pool[0];
    left.splice(left.indexOf(pick), 1);
    out.push(pick.model);
    looks.set(pick.model.look ?? "", (looks.get(pick.model.look ?? "") ?? 0) + 1);
    bodies.set(pick.model.body ?? "", (bodies.get(pick.model.body ?? "") ?? 0) + 1);
  }
  return out;
}

/** A tier without its pose-count part (the lowest two bits): who it suits, special, region, age, market. */
const signalTier = (tier: number) => Math.floor(tier / 4);
/**
 * Tier by tier, from the best: two of the own-pose list, then one of the pooled list, the other list filling in when one
 * runs out. A pooled model in a higher tier (a pregnant model for maternity wear, a hijab model for an abaya) still leads
 * the own-pose models of a lower one; the pose-count part of the tier is left out, since a pooled model always carries
 * its best pool model's count.
 */
const OWN_PER_POOLED = 2;
function mergeOwnAndPooled<T>(own: T[], pooled: T[], signal: (model: T) => number): T[] {
  const out: T[] = [];
  const tiers = [...new Set([...own, ...pooled].map(signal))].sort((a, b) => b - a);
  for (const tier of tiers) {
    const a = own.filter((model) => signal(model) === tier),
      b = pooled.filter((model) => signal(model) === tier);
    let i = 0,
      j = 0;
    while (i < a.length || j < b.length) {
      for (let k = 0; k < OWN_PER_POOLED && i < a.length; k++) out.push(a[i++]);
      if (j < b.length) out.push(b[j++]);
    }
  }
  return out;
}

export type ModelSuggestionOrder<T> = {
  filtering: boolean;
  visible: T[];
  /** How many of `visible` are the person's pinned models, at the very top. */
  pinned: number;
  /** How many of `visible` (after the pinned ones) are suggested for the product. */
  lead: number;
};

/**
 * Pinned models first (newest pin first), then the models suggested for the product (enough of
 * their own poses made for it, and right for who the product is for; most suitable first), then
 * everyone else, ordered the same way (supermodels and catalogue age first, varied by look; never the bare studio order). No product type yet: no suggestions. Filters and a search
 * narrow the list (pinned matches still lead). `video`: children and teens are left out.
 */
export function orderModelSuggestions<T extends ModelLike>(input: {
  models: readonly T[];
  /** The product's type ids (contracts `productCategories(facts)`). */
  targets: readonly string[];
  /** Words that may say who the product is for (its name, the reading's type). */
  wearerText?: string | null;
  search?: string;
  filters?: ModelFilters;
  /** The person's pinned model ids, newest first. */
  pinned?: readonly string[];
  /** A product video: no one under 18. */
  video?: boolean;
  /** Who the product is made for, from the fast photo check (`ProductAudience`); null before it is known. */
  audience?: ProductAudience | null;
  /** The looks of the seller's own market (their marketplaces), for everyday clothes with no region of their own. */
  marketLooks?: readonly string[];
  /** The model this person last used for this kind of product: it leads the suggestions. */
  lastUsed?: string | null;
}): ModelSuggestionOrder<T> {
  const filters = input.filters ?? {};
  const words = (input.search ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const active = MODEL_FILTER_GROUPS.filter((group) => filters[group.key] && filters[group.key] !== "all");
  const filtering = active.length > 0 || words.length > 0;
  const audience = input.audience ?? null;
  const fromAudience: ProductWearer | null = audience?.for && audience.for !== "unisex" ? audience.for : null;
  // The product's own words and type first; the photo check's answer when they don't say.
  const wearer =
    (input.targets.length || input.wearerText ? productWearer({ targets: input.targets, text: input.wearerText }) : null) ?? fromAudience;
  const allowed = input.models.filter((model) => !(input.video && isChildModel(model)));
  const visible = allowed.filter((model) => {
    if (!active.every((group) => valuesOf(model, group.key).includes(filters[group.key]!))) return false;
    const text = modelSearchText(model);
    return matchesSearch(text, input.search ?? "");
  });
  const said = productFocus({ targets: input.targets, text: input.wearerText });
  // The seller's words and the photo check together (either is enough).
  const focus = {
    ...said,
    maternity: said.maternity || Boolean(audience?.sizes.includes("maternity")),
    adaptive: said.adaptive || Boolean(audience?.adaptive),
    modest: said.modest || Boolean(audience?.modest),
    teen: said.teen || Boolean(audience?.ages.includes("teen")),
    baby: said.baby || Boolean(audience?.ages.includes("baby")),
    plus: said.plus || Boolean(audience?.sizes.includes("plus")),
    // Mature models lead only when the seller's words say so (mother-of-the-bride, "older women"): the photo check's age
    // guess put 16 mature models over everyone for an everyday pink top on a hanger (2026-10-08, after 156 new models).
    mature: said.mature,
  };
  // A regional garment's own looks (by its type, or the region the photo check names); else the seller's market.
  const looks = productLooks(input.targets);
  for (const region of audience?.regions ?? []) looks.add(REGION_LOOK[region]);
  const market = looks.size ? new Set<string>() : new Set(input.marketLooks ?? []);
  const kidsProduct = wearer === "girls" || wearer === "boys" || wearer === "kids";
  /** Nothing specific asked of the model: the supermodels lead. */
  const everyday =
    !kidsProduct && !focus.maternity && !focus.modest && !focus.adaptive && !focus.teen && !focus.baby && !focus.plus && !focus.mature;
  /**
   * The age (and, for everyday products, the line) the product asks for (owner, 2026-10-08: "most of the time people want
   * super models; only in specific cases mature, plus size etc."): mother-of-the-bride wear, mature models; children's wear,
   * no one by age; anything else, models of catalogue age (18 to 34), and for everyday products not from a specific line
   * (plus size, modest, maternity, adaptive), which lead only when asked for. Adults of 35 to 49 and mature models follow.
   */
  const usualFor = (model: T) => {
    const band = modelAgeBand(model);
    if (focus.mature) return band === "mature";
    if (kidsProduct || focus.teen || focus.baby) return false;
    // A modest-wear model is everyday wear in her own market (a seller on noon): only elsewhere does she wait to be asked for.
    const ownMarketModest =
      Boolean(model.look && market.has(model.look)) &&
      model.body !== "plus" &&
      !model.tags?.some((tag) => tag === "maternity" || tag === "adaptive");
    return band === "prime" && !(everyday && specificModel(model) && !ownMarketModest);
  };
  const rank = new Map<string, Rank>();
  const fits = new Map<string, boolean | null>();
  if (input.targets.length || input.wearerText) for (const model of visible) fits.set(model.id, modelWearerFit(model, wearer));
  if (input.targets.length)
    for (const model of visible) {
      const fit = fits.get(model.id)!;
      const poses = modelPoseFit(model, input.targets);
      // Babies are suggested only for baby wear, and for it even without studio poses of their own (no shared pose set
      // suits a baby: they are posed from words, "Describe your own").
      const baby = model.ageGroup === "baby";
      if (baby && !focus.baby) continue;
      if (fit === false || (poses.poses < MODEL_SUGGEST_MIN_POSES && !(baby && kidsProduct))) continue;
      // An ordinary product doesn't push a maternity model; a maternity product leads with them.
      const maternity = model.tags?.includes("maternity") ?? false;
      if (maternity && !focus.maternity) continue;
      const special =
        (focus.maternity && maternity) ||
        (focus.modest && model.tags?.includes("modest")) ||
        (focus.adaptive && model.tags?.includes("adaptive")) ||
        (focus.teen && model.ageGroup === "teen") ||
        (focus.baby && baby) ||
        (focus.plus && model.body === "plus");
      // Tiers: right for who it's for (or a children's product's own children), a matching
      // collection, then how many of its poses are made for the product (capped, so one model
      // with 200 doesn't hide the rest).
      // Then, in order: a regional garment's own look (a saree: South Asian models), the age it is made for (`usualFor`:
      // mother-of-the-bride wear, mature models; otherwise catalogue age), the seller's own market (everyday clothes only), and
      // last how many poses are made for it (capped, so one model with 200 doesn't hide the rest).
      const regional = Boolean(model.look && looks.has(model.look));
      const aged = usualFor(model);
      const local = Boolean(model.look && market.has(model.look));
      // A model on the shared pose pool doesn't get the seller's-market bonus: with dozens of pooled models of one look it
      // made a block of one look (2026-10-08: ten pooled East Asian models led a tunic for a seller on Rakuten).
      // Supermodels lead everyday products (owner, 2026-10-08: "most of the time people want super models; only in specific
      // cases mature, plus size etc."): after who it's for and a regional garment's own look, before age and market. A product
      // asking for something specific (plus, maternity, modest, adaptive, mature, teen, baby, kidswear) gets no such lift.
      const star = everyday && Boolean(model.tags?.includes("supermodel"));
      // Each signal outweighs every later one together (a regional garment's own look, 32, beats star + age + market, 24).
      const tier =
        (fit || (kidsProduct && fit !== false) ? 128 : 0) +
        (special ? 64 : 0) +
        (regional ? 32 : 0) +
        (star ? 12 : 0) +
        (aged ? 8 : 0) +
        (local && !model.sharedPoses ? 4 : 0) +
        Math.min(Math.floor(poses.score / 15), 3);
      rank.set(model.id, { tier, score: poses.score });
    }
  // Models with their own studio poses (the customer sees that very model in each pose) and models on the shared pose pool
  // are ranked apart, then merged two of their own to one pooled: pooled models (most of the catalogue since 2026-10-08) can't
  // crowd out the models with real poses, and still show up, varied by look.
  const ranked = visible.map((model, index) => ({ model, index })).filter(({ model }) => rank.has(model.id));
  const diversified = mergeOwnAndPooled(
    diversify(
      ranked.filter(({ model }) => !model.sharedPoses),
      rank,
    ),
    diversify(
      ranked.filter(({ model }) => model.sharedPoses),
      rank,
    ),
    (model) => signalTier(rank.get(model.id)!.tier),
  );
  // The model this person last used for this kind of product leads (a seller's house model), when it is suggested at all.
  const last = input.lastUsed ? diversified.find((model) => model.id === input.lastUsed) : undefined;
  const suggested = last ? [last, ...diversified.filter((model) => model !== last)] : diversified;
  // Everyone else (and everyone, before there is a product or while filtering one without poses for it), in the same
  // spirit: models that could wear it before those that can't (a child for an adult's product or with no product yet, an
  // adult for kidswear), the product's own or the seller's market looks, supermodels, catalogue age, then variety by look
  // (2026-10-08: with no rule here, "Adults + Slim" listed each look's oldest model first, the roster's order).
  const restRank = new Map<string, Rank>();
  const unranked = visible.map((model, index) => ({ model, index })).filter(({ model }) => !rank.has(model.id));
  for (const { model } of unranked) {
    const fit = fits.has(model.id) ? fits.get(model.id)! : modelWearerFit(model, wearer);
    // The product's own looks lead (a saree: South Asian models); the seller's market is only a small lift, and none for a
    // pooled model, as in the suggestions above: weighted like a regional look, it made one-look blocks (2026-10-08, a seller
    // on Rakuten filtering Men for a kurti: thirteen East Asian men in a row).
    const regional = Boolean(model.look && looks.has(model.look));
    const local = Boolean(model.look && market.has(model.look)) && !model.sharedPoses;
    const star = everyday && Boolean(model.tags?.includes("supermodel"));
    restRank.set(model.id, {
      tier: (fit === false ? 0 : 128) + (regional ? 32 : 0) + (star ? 12 : 0) + (usualFor(model) ? 8 : 0) + (local ? 4 : 0),
      score: 0,
    });
  }
  const rest = mergeOwnAndPooled(
    diversify(
      unranked.filter(({ model }) => !model.sharedPoses),
      restRank,
    ),
    diversify(
      unranked.filter(({ model }) => model.sharedPoses),
      restRank,
    ),
    (model) => signalTier(restRank.get(model.id)!.tier),
  );
  const ordered = [...suggested, ...rest];
  const pins = pinnedFirst(ordered, input.pinned, (model) => model.id);
  return {
    filtering,
    visible: pins.items,
    pinned: pins.pinned,
    lead: filtering ? 0 : pins.items.slice(pins.pinned).filter((model) => rank.has(model.id)).length,
  };
}
