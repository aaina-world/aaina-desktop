// Ported from Aaina (packages/contracts/src/poseTaxonomy.ts): product types, their families and twins. Only the parts model suggestions need.
export type PoseFamily = {
  id: string;
  label: string;
  section: "clothing" | "accessories";
};

export const POSE_FAMILIES: PoseFamily[] = [
  { id: "tops", label: "Tops & shirts", section: "clothing" },
  { id: "casual_tops", label: "Hoodies & sweatshirts", section: "clothing" },
  { id: "knit_tops", label: "Knitwear", section: "clothing" },
  { id: "outerwear", label: "Jackets & coats", section: "clothing" },
  { id: "bottoms", label: "Trousers & jeans", section: "clothing" },
  { id: "skirts", label: "Skirts", section: "clothing" },
  { id: "dresses", label: "Dresses", section: "clothing" },
  { id: "one_piece", label: "Jumpsuits & co-ords", section: "clothing" },
  { id: "indian_wear", label: "Indian wear", section: "clothing" },
  { id: "activewear", label: "Active & lounge", section: "clothing" },
  { id: "bags", label: "Bags", section: "accessories" },
  { id: "footwear", label: "Footwear", section: "accessories" },
  { id: "jewellery_hand", label: "Watches, rings & bracelets", section: "accessories" },
  { id: "jewellery_neck", label: "Necklaces & earrings", section: "accessories" },
  { id: "eyewear", label: "Eyewear", section: "accessories" },
  { id: "headwear", label: "Caps & hats", section: "accessories" },
  { id: "scarves", label: "Scarves", section: "accessories" },
  { id: "belts", label: "Belts", section: "accessories" },
  { id: "neckwear", label: "Ties & pocket squares", section: "accessories" },
  { id: "innerwear", label: "Innerwear & shapewear", section: "clothing" },
  { id: "hair", label: "Hair accessories", section: "accessories" },
  { id: "african_wear", label: "African wear", section: "clothing" },
  { id: "asian_wear", label: "East & Southeast Asian wear", section: "clothing" },
  { id: "modest_wear", label: "Modest & Arabic wear", section: "clothing" },
  { id: "kidswear", label: "Kidswear", section: "clothing" },
  { id: "festival_wear", label: "Festival & carnival wear", section: "clothing" },
];

type CategoryInfo = { label: string; family: string; words: string[] };

/**
 * Every bank category, with the words that point to it. Longer, more specific phrases win
 * over short ones ("oversized t-shirt" beats "t-shirt"), so order within `words` doesn't matter.
 * Umbrella words ("dress", "skirt", "shoes") are left out on purpose: they match a whole family
 * through the broad product kind instead of pinning one length or style.
 */
export const POSE_CATEGORIES: Record<string, CategoryInfo> = {
  smocks_fugu: { label: "Smocks (fugu)", family: "african_wear", words: ["smock", "fugu", "batakari", "northern smock"] },
  thobes: { label: "Thobes & kanduras", family: "modest_wear", words: ["thobe", "thawb", "kandura", "dishdasha", "jubba"] },
  carnival_wear: {
    label: "Carnival wear",
    family: "festival_wear",
    words: ["carnival costume", "mas costume", "feathered headpiece", "carnival bodysuit"],
  },
  frocks: { label: "Frocks (kids)", family: "kidswear", words: ["frock", "kids dress", "girls dress", "party frock", "pavadai"] },
  school_uniforms: { label: "School uniforms", family: "kidswear", words: ["school uniform", "uniform", "pinafore", "school shirt"] },
  sports_jerseys: {
    label: "Sports jerseys",
    family: "activewear",
    words: ["jersey", "football shirt", "soccer jersey", "cricket jersey", "basketball jersey", "team shirt"],
  },
  kimono_yukata: { label: "Kimono, yukata & haori", family: "asian_wear", words: ["kimono", "yukata", "jinbei", "haori", "kimono jacket"] },
  hijabs: { label: "Hijabs", family: "modest_wear", words: ["hijab", "headscarf", "shayla", "khimar", "al-amira", "underscarf"] },
  abayas: { label: "Abayas", family: "modest_wear", words: ["abaya", "jilbab", "open abaya", "closed abaya"] },
  kebaya_baju_kurung: {
    label: "Kebaya & baju kurung",
    family: "asian_wear",
    words: ["kebaya", "baju kurung", "baju kebaya", "baju melayu"],
  },
  cheongsam: { label: "Cheongsam & qipao", family: "asian_wear", words: ["cheongsam", "qipao", "mandarin collar dress"] },
  filipiniana: {
    label: "Filipiniana & barong",
    family: "asian_wear",
    words: ["filipiniana", "terno", "maria clara", "barong", "barong tagalog"],
  },
  hanbok: { label: "Hanbok", family: "asian_wear", words: ["hanbok", "modern hanbok", "jeogori", "chima"] },
  senator_sets: {
    label: "Senator & kaftan sets",
    family: "african_wear",
    words: ["senator", "senator wear", "men's kaftan set", "dashiki set", "native wear"],
  },
  kufi_caps: { label: "Kufi & fila caps", family: "headwear", words: ["kufi", "fila", "taqiyah", "prayer cap", "skull cap"] },
  agbada: { label: "Agbada", family: "african_wear", words: ["agbada", "grand boubou", "babariga"] },
  crewneck_tshirts: {
    label: "T-shirts",
    family: "tops",
    words: ["t-shirt", "t shirt", "tshirt", "tee", "crew neck", "crewneck", "round neck", "graphic tee", "printed tee"],
  },
  oversized_tshirts: {
    label: "Oversized T-shirts",
    family: "tops",
    words: ["oversized t-shirt", "oversized tee", "oversized tshirt", "drop shoulder", "boxy tee", "baggy tee"],
  },
  shirts: {
    label: "Shirts",
    family: "tops",
    words: ["shirt", "button down", "button-up", "formal shirt", "casual shirt", "linen shirt", "denim shirt", "flannel"],
  },
  blouses: { label: "Blouses", family: "tops", words: ["blouse", "peplum", "saree blouse", "chiffon top", "silk top"] },
  sleeveless_tops: {
    label: "Sleeveless tops",
    family: "tops",
    words: ["sleeveless", "tank top", "tank", "camisole", "cami", "crop top", "halter", "vest top", "spaghetti"],
  },
  hoodies: { label: "Hoodies", family: "casual_tops", words: ["hoodie", "hooded", "zip hoodie"] },
  sweatshirts: { label: "Sweatshirts", family: "casual_tops", words: ["sweatshirt", "crewneck sweatshirt", "pullover"] },
  sweaters: {
    label: "Sweaters",
    family: "knit_tops",
    words: ["sweater", "jumper", "knit top", "knitted", "turtleneck", "woollen", "woolen"],
  },
  cardigans: { label: "Cardigans", family: "knit_tops", words: ["cardigan", "shrug"] },
  blazers: { label: "Blazers", family: "outerwear", words: ["blazer", "suit jacket", "sport coat"] },
  casual_jackets: {
    label: "Jackets",
    family: "outerwear",
    words: ["jacket", "denim jacket", "bomber", "leather jacket", "puffer", "windcheater", "shacket", "gilet"],
  },
  long_coats: { label: "Coats", family: "outerwear", words: ["coat", "overcoat", "trench", "long coat", "parka"] },
  jeans: { label: "Jeans", family: "bottoms", words: ["jeans", "jean", "denim pants", "denims"] },
  joggers: { label: "Joggers", family: "bottoms", words: ["jogger", "joggers", "track pants", "trackpants", "sweatpants", "cargo"] },
  leggings: { label: "Leggings", family: "bottoms", words: ["legging", "leggings", "jeggings", "churidar", "tights"] },
  shorts: { label: "Shorts", family: "bottoms", words: ["shorts", "short", "bermuda", "hot pants"] },
  straight_trousers: {
    label: "Trousers",
    family: "bottoms",
    words: ["trouser", "trousers", "pants", "chinos", "formal pants", "slacks", "palazzo"],
  },
  wide_leg_trousers: {
    label: "Wide-leg trousers",
    family: "bottoms",
    words: ["wide leg", "wide-leg", "flared pants", "palazzo pants", "culottes", "bell bottom"],
  },
  mini_skirts: { label: "Mini skirts", family: "skirts", words: ["mini skirt", "short skirt", "skort"] },
  midi_skirts: { label: "Midi skirts", family: "skirts", words: ["midi skirt", "pencil skirt", "pleated skirt", "a-line skirt"] },
  maxi_skirts: { label: "Maxi skirts", family: "skirts", words: ["maxi skirt", "long skirt", "ghagra"] },
  mini_dresses: {
    label: "Mini dresses",
    family: "dresses",
    words: ["mini dress", "short dress", "bodycon", "shift dress", "skater dress"],
  },
  midi_dresses: { label: "Midi dresses", family: "dresses", words: ["midi dress", "wrap dress", "shirt dress", "sundress", "frock"] },
  maxi_dresses: { label: "Maxi dresses", family: "dresses", words: ["maxi dress", "long dress", "gown", "evening dress", "anarkali gown"] },
  jumpsuits: { label: "Jumpsuits", family: "one_piece", words: ["jumpsuit", "romper", "playsuit", "dungaree", "overall", "boiler suit"] },
  coordinated_sets: {
    label: "Co-ord sets",
    family: "one_piece",
    words: ["co-ord", "coord", "co ord", "matching set", "two piece", "2 piece"],
  },
  kurtas: { label: "Kurtas", family: "indian_wear", words: ["kurta", "kurti", "short kurta", "pathani"] },
  kurta_sets: {
    label: "Kurta sets",
    family: "indian_wear",
    words: [
      "kurta set",
      "kurta pajama",
      "kurta pyjama",
      "salwar",
      "salwar suit",
      "suit set",
      "sharara",
      "dupatta set",
      "ethnic set",
      "anarkali",
    ],
  },
  sarees: { label: "Sarees", family: "indian_wear", words: ["saree", "sari", "drape", "pallu"] },
  lehengas: {
    label: "Lehengas",
    family: "indian_wear",
    words: [
      "lehenga",
      "lehnga",
      "chaniya choli",
      "bridal",
      "ghagra choli",
      "choli",
      "two piece traditional",
      "traditional two piece",
      "crop top and skirt set",
      "ethnic skirt set",
    ],
  },
  activewear_sets: {
    label: "Activewear",
    family: "activewear",
    words: ["activewear", "gym", "sports bra", "workout", "yoga", "athleisure", "sportswear", "track suit", "tracksuit"],
  },
  loungewear_sets: {
    label: "Loungewear",
    family: "activewear",
    words: ["loungewear", "nightwear", "night suit", "pyjama", "pajama", "sleepwear", "nightdress", "lounge set"],
  },
  structured_handbags: {
    label: "Handbags",
    family: "bags",
    words: ["handbag", "hand bag", "structured bag", "satchel", "top handle", "purse"],
  },
  shoulder_bags: { label: "Shoulder bags", family: "bags", words: ["shoulder bag", "hobo", "baguette"] },
  crossbody_bags: { label: "Crossbody bags", family: "bags", words: ["crossbody", "cross body", "sling bag", "sling", "messenger"] },
  tote_bags: { label: "Tote bags", family: "bags", words: ["tote", "tote bag", "shopper", "jhola", "canvas bag"] },
  clutches: { label: "Clutches", family: "bags", words: ["clutch", "potli", "evening bag", "pouch"] },
  backpacks: { label: "Backpacks", family: "bags", words: ["backpack", "rucksack", "school bag", "laptop bag"] },
  sneakers: {
    label: "Sneakers",
    family: "footwear",
    words: ["sneaker", "sneakers", "trainer", "trainers", "sports shoe", "running shoe", "canvas shoe", "casual shoes"],
  },
  heels: { label: "Heels", family: "footwear", words: ["heel", "heels", "stiletto", "pumps", "wedges", "block heel"] },
  flats: { label: "Flats", family: "footwear", words: ["flats", "ballet", "kolhapuri", "mules"] },
  sandals: { label: "Sandals", family: "footwear", words: ["sandal", "sandals", "slides", "flip flop", "slipper", "chappal"] },
  boots: { label: "Boots", family: "footwear", words: ["boot", "boots", "ankle boot", "chelsea"] },
  watches: { label: "Watches", family: "jewellery_hand", words: ["watch", "smartwatch", "wristwatch"] },
  rings: { label: "Rings", family: "jewellery_hand", words: ["ring", "rings", "band"] },
  bracelets: { label: "Bracelets", family: "jewellery_hand", words: ["bracelet", "bangle", "bangles", "kada", "cuff"] },
  necklaces: { label: "Necklaces", family: "jewellery_neck", words: ["necklace", "chain", "pendant", "mangalsutra", "choker", "haar"] },
  earrings: {
    label: "Earrings",
    family: "jewellery_neck",
    words: ["earring", "earrings", "jhumka", "jhumkas", "studs", "hoops", "danglers"],
  },
  sunglasses: { label: "Sunglasses", family: "eyewear", words: ["sunglasses", "sunglass", "shades", "aviator"] },
  optical_frames: {
    label: "Spectacle frames",
    family: "eyewear",
    words: ["spectacles", "eyeglasses", "glasses", "optical frame", "frames", "specs"],
  },
  caps: { label: "Caps", family: "headwear", words: ["cap", "caps", "baseball cap", "snapback"] },
  flat_caps: { label: "Flat caps", family: "headwear", words: ["flat cap", "newsboy cap", "baker boy cap", "ivy cap"] },
  headwraps: { label: "Headwraps & gele", family: "headwear", words: ["gele", "headwrap", "head wrap", "turban wrap", "head tie", "duku"] },
  beanies: { label: "Beanies", family: "headwear", words: ["beanie", "woolly hat", "knit cap"] },
  bucket_hats: { label: "Hats", family: "headwear", words: ["bucket hat", "hat", "hats", "fedora", "sun hat"] },
  scarves: { label: "Scarves & stoles", family: "scarves", words: ["scarf", "scarves", "stole", "dupatta", "shawl", "muffler"] },
  belts: { label: "Belts", family: "belts", words: ["belt", "belts", "waist belt"] },
  // Men's types (studio model Ansh). Types shared with women's wear reuse the ids above.
  polos: { label: "Polos", family: "tops", words: ["polo", "polo shirt", "polo t-shirt", "polo tee", "collared t-shirt"] },
  casual_shirts: {
    label: "Casual shirts",
    family: "tops",
    words: [
      "casual shirt",
      "linen shirt",
      "denim shirt",
      "flannel shirt",
      "printed shirt",
      "cuban collar",
      "resort shirt",
      "half sleeve shirt",
    ],
  },
  formal_shirts: {
    label: "Formal shirts",
    family: "tops",
    words: ["formal shirt", "office shirt", "dress shirt", "french cuff", "business shirt"],
  },
  overshirts: { label: "Overshirts", family: "outerwear", words: ["overshirt", "over shirt", "shirt jacket", "flannel overshirt"] },
  athletic_tanks: {
    label: "Vests & tanks",
    family: "activewear",
    words: ["gym vest", "gym tank", "muscle tee", "sleeveless tee", "stringer", "athletic tank"],
  },
  two_piece_suits: {
    label: "Suits",
    family: "outerwear",
    words: ["suit", "two piece suit", "2 piece suit", "three piece suit", "business suit", "tuxedo"],
  },
  waistcoats: { label: "Waistcoats", family: "outerwear", words: ["waistcoat", "waist coat", "suit vest", "ethnic waistcoat"] },
  chinos: { label: "Chinos", family: "bottoms", words: ["chino", "chinos", "chino pants", "chino trousers"] },
  formal_trousers: {
    label: "Formal trousers",
    family: "bottoms",
    words: ["formal trousers", "formal pants", "suit trousers", "dress pants", "office trousers"],
  },
  cargo_trousers: {
    label: "Cargo trousers",
    family: "bottoms",
    words: ["cargo", "cargos", "cargo pants", "cargo trousers", "utility pants"],
  },
  swim_shorts: { label: "Swim shorts", family: "activewear", words: ["swim shorts", "swim trunks", "board shorts", "boardies"] },
  kurta_pajama_sets: {
    label: "Kurta pajama sets",
    family: "indian_wear",
    words: ["kurta pajama", "kurta pyjama", "men's kurta set", "kurta churidar"],
  },
  nehru_jackets: { label: "Nehru jackets", family: "indian_wear", words: ["nehru jacket", "modi jacket", "bundi", "ethnic jacket"] },
  kurta_jacket_sets: {
    label: "Kurta jacket sets",
    family: "indian_wear",
    words: ["kurta jacket set", "kurta with jacket", "kurta and jacket"],
  },
  sherwanis: { label: "Sherwanis", family: "indian_wear", words: ["sherwani", "achkan", "groom wear", "wedding sherwani"] },
  indo_western_sets: { label: "Indo-western", family: "indian_wear", words: ["indo western", "indo-western", "fusion wear"] },
  jodhpuri_suits: { label: "Jodhpuri suits", family: "indian_wear", words: ["jodhpuri", "bandhgala", "bandh gala", "prince coat"] },
  veshti_dhoti: { label: "Veshti & dhoti", family: "indian_wear", words: ["veshti", "dhoti", "mundu", "lungi", "dhoti kurta"] },
  duffel_bags: { label: "Duffel bags", family: "bags", words: ["duffel", "duffle", "gym bag", "travel bag", "weekender"] },
  briefcases: {
    label: "Briefcases & work bags",
    family: "bags",
    words: ["briefcase", "work bag", "office bag", "attache", "document bag", "portfolio bag"],
  },
  wallets: { label: "Wallets", family: "bags", words: ["wallet", "card holder", "cardholder", "money clip", "billfold"] },
  formal_laceups: {
    label: "Formal shoes",
    family: "footwear",
    words: ["oxford", "oxfords", "derby", "brogue", "brogues", "formal shoes", "lace up shoes", "dress shoes"],
  },
  loafers: { label: "Loafers", family: "footwear", words: ["loafer", "loafers", "moccasin", "moccasins", "driving shoes", "penny loafer"] },
  sandals_slides: {
    label: "Sandals & slides",
    family: "footwear",
    words: ["men's sandals", "slides", "sliders", "flip flops", "floaters"],
  },
  juttis_mojaris: {
    label: "Juttis & mojaris",
    family: "footwear",
    words: ["jutti", "juttis", "mojari", "mojaris", "nagra", "ethnic shoes"],
  },
  chains_pendants: {
    label: "Chains & pendants",
    family: "jewellery_neck",
    words: ["men's chain", "neck chain", "pendant chain", "silver chain", "gold chain", "dog tag"],
  },
  ties_bowties: { label: "Ties & bow ties", family: "neckwear", words: ["tie", "necktie", "bow tie", "bowtie", "cravat"] },
  pocket_squares: { label: "Pocket squares", family: "neckwear", words: ["pocket square", "pocket squares", "handkerchief"] },
  brooches: {
    label: "Brooches & lapel pins",
    family: "neckwear",
    words: ["brooch", "lapel pin", "collar pin", "tie pin", "cufflink", "cufflinks"],
  },
  safa_turbans: { label: "Safas & turbans", family: "headwear", words: ["safa", "turban", "pagdi", "pagri", "pheta"] },
  ethnic_malas: {
    label: "Ethnic malas",
    family: "jewellery_neck",
    words: ["mala", "rudraksha", "groom necklace", "kantha", "ethnic mala"],
  },
  // Types added with the new studio models (2026-09).
  swimwear: {
    label: "Swimwear",
    family: "activewear",
    words: [
      "swimsuit",
      "swimwear",
      "bikini",
      "one piece",
      "monokini",
      "burkini",
      "modest swimwear",
      "tankini",
      "bathers",
      "swimmers",
      "rash vest",
    ],
  },
  kaftans: {
    label: "Kaftans",
    family: "dresses",
    words: ["kaftan", "caftan", "jalabiya", "boubou", "beach cover-up", "cover up", "sarong"],
  },
  half_sarees: { label: "Half sarees", family: "indian_wear", words: ["half saree", "langa voni", "pavadai davani", "pattu pavadai"] },
  tunics: { label: "Tunics", family: "tops", words: ["tunic", "tunic top", "longline top", "smock top"] },
  bodysuits: { label: "Bodysuits", family: "tops", words: ["bodysuit", "body suit", "leotard top"] },
  womens_innerwear: { label: "Women's innerwear", family: "innerwear", words: ["bra", "bralette", "panties", "lingerie", "lingerie set"] },
  mens_innerwear: {
    label: "Men's innerwear",
    family: "innerwear",
    words: ["men's vest", "brief", "briefs", "trunk", "trunks", "boxer", "boxers", "undershirt"],
  },
  shapewear: { label: "Shapewear", family: "innerwear", words: ["shapewear", "faja", "body shaper", "tummy control", "waist trainer"] },
  hair_accessories: {
    label: "Hair accessories",
    family: "hair",
    words: ["hair clip", "claw clip", "scrunchie", "headband", "hairband", "maang tikka", "hair pin", "hair bow"],
  },
};

/**
 * Men's and women's names for the same kind of product. The photo reader picks one type, and
 * each model's poses are tagged in its own words (Aaina's bank says "straight_trousers", Ansh's
 * poses say "chinos"), so a type also matches the poses tagged with its twins.
 */
const TWINS: string[][] = [
  ["smocks_fugu", "senator_sets"],
  ["thobes", "kurtas"],
  ["frocks", "midi_dresses"],
  ["sports_jerseys", "crewneck_tshirts"],
  ["hijabs", "scarves"],
  ["abayas", "kaftans"],
  ["kebaya_baju_kurung", "kurta_sets"],
  ["cheongsam", "midi_dresses"],
  ["senator_sets", "kurta_pajama_sets"],
  ["kufi_caps", "caps"],
  ["agbada", "sherwanis"],
  ["shirts", "casual_shirts", "formal_shirts"],
  ["crewneck_tshirts", "polos"],
  ["straight_trousers", "chinos", "formal_trousers"],
  ["joggers", "cargo_trousers"],
  ["shorts", "swim_shorts"],
  ["sleeveless_tops", "athletic_tanks"],
  ["blazers", "two_piece_suits", "waistcoats"],
  ["casual_jackets", "overshirts"],
  ["kurtas", "kurta_sets", "kurta_pajama_sets", "kurta_jacket_sets"],
  ["necklaces", "chains_pendants", "ethnic_malas"],
  ["clutches", "wallets"],
  ["tote_bags", "duffel_bags"],
  ["flats", "loafers", "juttis_mojaris"],
  ["sandals", "sandals_slides"],
  ["swimwear", "swim_shorts"],
  ["kaftans", "maxi_dresses"],
  ["flat_caps", "caps"],
  ["briefcases", "backpacks"],
  ["half_sarees", "lehengas"],
  ["tunics", "blouses"],
  ["bodysuits", "sleeveless_tops"],
];

/** The types themselves first, then their twins (see TWINS), without repeats. */
export function withTwinCategories(ids: string[]): string[] {
  const out = [...ids];
  for (const id of ids)
    for (const group of TWINS) if (group.includes(id)) for (const twin of group) if (!out.includes(twin)) out.push(twin);
  return out;
}
