/**
 * The pose in a studio pose's title, without the outfit. Studio poses keep the outfit the model wore when the pose was
 * made ("Straight front, tee and jeans", "White top and jeans, three-quarter with glasses", "Grey tee and tailored
 * trousers"). Shown to a seller or a customer it would contradict their own product, so every garment, color and
 * accessory word is dropped and only the pose is kept. When nothing pose-like remains, the pose's own facing says it
 * ("Front view"), else "Model photo". Pure: display only, never used for ids, tags or prompts. Ported from Aaina.
 */

/** Words that name what a model wears (or carries), never how she stands. */
const OUTFIT_WORDS = new Set(
  (
    "tee tees tshirt tshirts t-shirt t-shirts top tops shirt shirts blouse blouses camisole cami tank vest polo bodysuit " +
    "jeans jean denim trouser trousers pants pant chinos chino shorts short skirt skirts dress dresses gown gowns maxi midi mini " +
    "kurta kurtas kurti saree sari lehenga salwar dupatta sherwani nehru abaya kaftan caftan hijab turban headscarf scarf shawl stole " +
    "jacket jackets coat coats blazer blazers suit suits tuxedo hoodie hoodies sweatshirt sweater sweaters jumper cardigan cardigans knit knits " +
    "jumpsuit romper coord co-ord set sets leggings legging joggers jogger sweatpants tracksuit swimsuit bikini swimwear loungewear activewear sportswear " +
    "wrap wide-leg wideleg bootcut flared straight-leg tailored slim oversized cropped fitted relaxed-fit cable-knit crew crewneck crew-neck " +
    "linen cotton silk satin wool fleece suede leather canvas corduroy velvet chiffon lace " +
    "sneakers sneaker shoes shoe sandals sandal boots boot heels heel loafers flats pumps trainers footwear socks " +
    "belt belts bag bags tote clutch handbag backpack crossbody purse wallet hat hats cap caps beanie sunglasses glasses spectacles " +
    "watch bracelet bracelets necklace earrings earring ring rings jewellery jewelry pendant chain " +
    "black white grey gray navy cream ivory beige tan brown camel red maroon burgundy pink blush rose orange rust yellow mustard green olive sage mint teal " +
    "blue sky royal cobalt denim-blue purple lavender lilac mauve plum charcoal silver gold khaki stone sand nude mocha chocolate coffee off-white " +
    "striped stripes checked plaid printed floral solid plain patterned pleated ribbed " +
    "boubou mundu singlet henley flannel button-down buttondown pumps uniform watch-cap utility halter strapless racer-back square-neck off-shoulder one-shoulder puff-sleeve sleeve sleeves sleeveless neck neckline collar " +
    "slip duffel gym compression singlet puffer parka trench overshirt shacket gilet bomber windbreaker raincoat anorak poncho cape kimono robe pajama pyjama nightgown lingerie bra briefs " +
    "emerald champagne cobalt burgundy crimson scarlet coral peach salmon turquoise aqua indigo violet magenta fuchsia ochre terracotta taupe oatmeal graphite slate " +
    "adaptive work buckle cross-body side-zip panel turned-up turn-up handle handles page-boy tiered baggy slouched wear indian festive resort optical wrapper bell beads sports pouch drawstring drawcords kangaroo tweed quilted huggies huggie kara ribbon signet sacoche jinbei varsity runners guayabera slides sunga cuban-link link messenger hobo panama sundress pleats baguette frock waistcoat kalgi smartwatch flip-flops biker veil dhoti tunic overcoat placket raffia stiletto ghutra bandhgala mala kanjivaram safa briefcase belted pearls jasmine gajra aviators bangles bifold holder card-holder cardholder smock jersey weekender straw nighty front-button agbada senator potli hood mom jhumka palazzo davani steel basket warm-up hoops studs scrunchie clip mesh padded keyhole slit western cosy-knit fair isle crepe maternity sun wide-calf occasion headband sling juttis jutti mojari mojaris kolhapuri woven rain open cargos cargo bucket knee-high thigh-high ankle-high high-top high-tops low-top low-tops longline slip-on slip-ons mid-rise high-rise low-rise high-waist high-waisted ankle-length knee-length midi-length bow tie tie-knot knot bowtie strap straps crossed-strap washed-black heather heather-grey brick brick-red forest forest-green bottle bottle-green mustard-yellow midnight pastel neon metallic sequin sequined embroidered"
  ).split(/\s+/),
);
const FILLER = new Set(["and", "with", "in", "on", "of", "the", "a", "an", "over", "under", "plus", "&", "at", "to", "by"]);

/** Words that say how someone stands, sits or moves: a part of a title that has one of them is the pose; the rest is the outfit. */
const POSE_PART = new RegExp(
  `(?<![\\w-])(?:${[
    "front",
    "back",
    "side",
    "profile",
    "three[- ]quarter",
    "3/4",
    "facing",
    "camera",
    "walk\\w*",
    "strid\\w*",
    "step\\w*",
    "seated",
    "sitting",
    "sit",
    "perch\\w*",
    "cube",
    "lean\\w*",
    "standing",
    "contrapposto",
    "arms?",
    "hands?",
    "pockets?",
    "hips?",
    "legs?",
    "cross(?:ed|ing)?",
    "cross-?legged",
    "cross-step",
    "folded",
    "looking",
    "look",
    "glanc\\w*",
    "turn\\w*",
    "twirl\\w*",
    "pivot\\w*",
    "crouch\\w*",
    "kneel\\w*",
    "jump\\w*",
    "hop",
    "laugh\\w*",
    "smil\\w*",
    "tilt\\w*",
    "waist-up",
    "waist up",
    "head to",
    "close-up",
    "crop",
    "view",
    "stance",
    "weight",
    "shift\\w*",
    "held",
    "holding",
    "carry\\w*",
    "away",
    "toward\\w*",
    "pull",
    "peace",
    "point\\w*",
    "wave",
    "floor",
    "wall",
    "pose",
    "45°",
    "portrait",
    "full[- ]length",
    "namaste",
    "thumbs?(?:-| )up",
    "wav\\w*",
    "lunge",
    "squat\\w*",
    "balance",
    "shrug",
    "hug\\w*",
    "clap",
    "together",
    "feet",
    "foot",
    "knees?",
    "calves",
    "ankles?",
    "mid-\\w+",
    "raised",
    "stretch\\w*",
    "hello",
  ].join("|")})(?![\\w])`,
  "i",
);

/** The pose words in one comma-separated part of a title (clothes and accessories taken out), or "" when the part is only the outfit. */
function poseWordsOf(raw: string): string {
  // "crop top" is clothing; "waist crop" is the framing.
  const part = raw.replace(/\bcrop(?=\s+(?:top|tops|tee|tees|t-shirt|shirt|hoodie|jacket|cardigan|sweater|tank|blouse)\b)\s*/gi, "");
  if (!POSE_PART.test(part)) return "";
  const words = part.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((word) => {
    const bare = word.toLowerCase().replace(/[.,;:!?]+$/g, "");
    // A compound ("royal-blue", "top-handle", "rib-knit") is clothing when any of its pieces is.
    return !(OUTFIT_WORDS.has(bare) || bare.split("-").some((piece) => OUTFIT_WORDS.has(piece)));
  });
  let phrase = kept.join(" ").trim();
  if (phrase.split(" ").every((word) => FILLER.has(word.toLowerCase()))) return "";
  phrase = phrase
    .replace(/^(?:(?:and|with|in|on|of|the|a|an|over|under|plus|&|at|to|by)\s+)+/i, "")
    .replace(/(?:\s+(?:and|with|in|on|of|the|a|an|over|under|plus|&|at|to|by))+$/i, "");
  return phrase;
}

const FACING: Record<string, string> = {
  front: "Front view",
  side: "Side view",
  true_side: "Side view",
  back: "Back view",
  true_back: "Back view",
  rear: "Back view",
};
const sentence = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** The plain pose words for a phrase that has none of the outfit left. */
function plainPose(phrase: string): string {
  let text = phrase.replace(/\s+/g, " ").trim();
  const squashed = text.toLowerCase().replace(/[-_]/g, " ");
  if (/^(?:straight )?(?:front|front on|front facing|facing front|facing camera)$/.test(squashed) || /^straight$/.test(squashed))
    return "Front view";
  if (/^three quarter$/.test(squashed)) return "Three-quarter view";
  if (/^(?:side|profile|side profile)$/.test(squashed)) return "Side view";
  if (/^(?:back|rear|from behind|back view)$/.test(squashed)) return "Back view";
  text = text
    .replace(/\bthree quarter\b/gi, "three-quarter")
    .replace(/\b3\/4\b/g, "three-quarter")
    .replace(/45°\s*(?:facing\s*)?(camera-(?:left|right))/gi, "three-quarter, facing $1")
    .replace(/45°/g, "three-quarter")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s]+$/, "");
  if (/^three-quarter$/i.test(text)) return "Three-quarter view";
  return sentence(text);
}

const DANGLING = new Set(
  "hand hands hip pull looking holding carry feet held together ankle camera pointed raised crop cube arms".split(" "),
);

/** A studio title (no " · ") as its pose alone. `facing` (front, side, true_back ...) is the pose record's own, when known. */
export function outfitFreePoseName(title: string, facing?: string | null): string {
  // A ghost mannequin's angle names ("Front", "Three-quarter", "Back") are already plain.
  if (/^(?:front|three-quarter|back)$/i.test((title ?? "").trim()))
    return `${title.trim()[0].toUpperCase()}${title.trim().slice(1).toLowerCase()}`;
  const parts = (title ?? "")
    .split(/\s*(?:,|;| - | – )\s*/)
    .map(poseWordsOf)
    .filter(Boolean);
  const named = parts.length ? plainPose(parts.join(", ")) : "";
  // A lone leftover word ("Hand", "Pull", "Held") says nothing once the product is taken out: the facing says more.
  if (named && !DANGLING.has(named.toLowerCase())) return named;
  return (facing && FACING[facing.toLowerCase()]) || "Model photo";
}
