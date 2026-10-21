// Ported from Aaina: packages/contracts/src/modelSheet.ts (traits sentence, face and sheet prompts, the sheet check's pass rule),
// openrouter/sheetCheck.ts and openrouter/ownModelPhotoCheck.ts (the two vision checks). Adults only in the desktop app.
const clean = (value: string | undefined | null, max: number) =>
  (value ?? "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export type Traits = {
  gender: "woman" | "man";
  age: number;
  /** A look id ("south_asian") or any words. */
  look?: string | null;
  /** A body id ("curvy") or any words. */
  body?: string | null;
  hair?: string | null;
  /** Anything else that defines the person. */
  extra?: string | null;
};

const LOOKS: Record<string, string> = {
  south_asian: "South Asian",
  east_asian: "East Asian",
  southeast_asian: "Southeast Asian",
  black: "Black",
  middle_eastern: "Middle Eastern",
  latin: "Hispanic / Latino",
  white: "White",
  mixed: "Multiracial",
  indigenous: "Indigenous",
};
const BODIES: Record<string, string> = {
  slim: "a slim build",
  average: "an average build",
  athletic: "an athletic build",
  curvy: "a curvy build",
  plus: "a plus-size build",
};
export const hairWords = (text: string) =>
  /\b(hair|braids?|locs|dreadlocks|afro|bob|bun|ponytail|curls|waves|plaits?|pixie|buzz ?cut|crop|fringe|bangs|hijab|turban|bald)\b/i.test(
    text,
  )
    ? text
    : `${text} hair`;

/** "The person:" sentence built from the traits. */
export function traitsSentence(t: Traits): string {
  const look = clean(t.look, 60);
  const parts = [
    `a professional fashion model, a ${t.gender === "man" ? "man" : "woman"} aged ${Math.round(t.age)}${look ? `, ${LOOKS[look] ?? look} appearance` : ""}`,
    clean(t.hair, 120) ? hairWords(clean(t.hair, 120)) : "",
    t.body ? (BODIES[t.body] ?? clean(t.body, 60)) : "",
  ].filter(Boolean);
  const extra = clean(t.extra, 200);
  return `${parts.join(", ")}${extra ? `; ${extra}` : ""}.`;
}

function fullLengthNotes(extraText: string) {
  const extra = extraText.toLowerCase();
  const wheelchair = /wheelchair/.test(extra);
  const prosthetic = /prosthe/.test(extra);
  const pregnant = /pregnan|maternity|baby bump/.test(extra);
  const five = wheelchair
    ? "full length above head through the wheel rims and feet, seated in the wheelchair facing camera, hands in lap, same plain clothes"
    : "full length above head through shoes, relaxed facing camera, arms by sides";
  const six = wheelchair
    ? "full length above head through the wheel rims and feet, seated in the wheelchair turned three-quarters toward right, one hand on the wheel"
    : "full length above head through shoes, standing three-quarters toward right, one hand in pocket";
  const tail = [
    prosthetic ? "The prosthetic limb is clearly visible in both full-length panels." : "",
    pregnant ? "The pregnancy bump is clearly visible in both full-length panels." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { wheelchair, five, six, tail };
}

const SHEET_OPENING_NEW =
  "Create ONE square image, 1024 × 1024 pixels: a model reference sheet of six photorealistic photographs of ONE entirely new fictional person. Invent an original face, never copy or resemble a real or famous person. Keep identical face, skin tone, natural skin texture, hairstyle and body across all six photos. Do not add inconsistent moles, freckles, scars or marks between panels.";

function sheetPanelLines(notes: ReturnType<typeof fullLengthNotes>): string[] {
  const shoes = notes.wheelchair ? "" : ", slim dark trousers, white sneakers";
  const outfitSix = notes.wheelchair
    ? "navy unstructured jacket over white T-shirt, stone chinos"
    : "navy unstructured jacket over white T-shirt, stone chinos, brown loafers";
  return [
    "Top row: three equal portrait-shaped photos, tightly framed head and shoulders, whole head and all hair visible with space above.",
    "1. Left: straight facing camera, calm natural expression, plain white crew-neck T-shirt.",
    "2. Middle: head and shoulders turned 45 degrees, nose toward LEFT edge of image, eyes at camera, plain black T-shirt.",
    "3. Right: head and shoulders turned 45 degrees, nose toward RIGHT edge of image, eyes at camera, plain black T-shirt.",
    "Bottom row:",
    "4. Left, half sheet width: strict 90-degree side profile, nose LEFT, only one eye and one ear visible, looking straight ahead rather than camera; olive crew-neck T-shirt; whole head and shoulders visible.",
    `5. Middle, quarter sheet width: ${notes.five}, plain grey T-shirt${shoes}.`,
    `6. Right, quarter sheet width: ${notes.six}, ${outfitSix}.`,
  ];
}
const SHEET_COMMON =
  "All six: natural unretouched photographic appearance, light-grey paper studio backdrop, soft daylight from one side, 85 mm portrait lens look, natural colour, visible pores, no makeup look. Full-length camera far back at hip height; natural realistic body proportions, no foreshortening, no artificially short legs. Clear space above head and below shoes. Exactly one person per panel; no text, labels, numbers, logos, jewellery, watermarks or borders except thin white dividing lines. Exactly six panels, top row three equal widths, bottom row half/quarter/quarter widths. Preserve age and body type, do not make everyone thin or young.";

/** The sheet made from words alone (used when the customer skips the face step; the app normally goes through a chosen face). */
export function modelSheetPrompt(t: Traits): string {
  const notes = fullLengthNotes(t.extra ?? "");
  return [
    SHEET_OPENING_NEW,
    ...sheetPanelLines(notes),
    SHEET_COMMON + (notes.tail ? ` ${notes.tail}` : ""),
    `The person: ${traitsSentence(t)}`,
  ].join("\n");
}

/** One of the 3 face options of a described own model (1024 x 1536). */
export function modelFacePrompt(t: Traits): string {
  return [
    "A photorealistic head-and-shoulders portrait photograph of ONE entirely new fictional adult person. Invent an original face, never copy or resemble a real or famous person.",
    "Facing the camera, calm natural expression, whole head and all hair visible with space above, plain white crew-neck T-shirt, plain light-grey paper studio backdrop, soft daylight from one side, 85 mm portrait lens look, natural colour, natural unretouched skin with visible pores, no makeup look.",
    "Exactly one person; no text, labels, logos, jewellery, watermarks or borders.",
    `The person: ${traitsSentence(t)}`,
  ].join("\n");
}

/** The sheet of a real person from 1 to 3 photos, or from a chosen face (count 1). */
export function modelSheetFromPicturesPrompt(t: { gender: "woman" | "man"; age: number; extra?: string | null }, count = 1): string {
  const notes = fullLengthNotes(t.extra ?? "");
  const input = `Using the person in the attached ${count === 1 ? "photo" : "photos"} (image 1 is a clear front photo${count > 1 ? "; the others show the body or the profile" : ""}), keep exactly this person's face, skin tone, hair and body.`;
  return [
    `${input} Do not beautify, retouch or change their age, weight or features, and add no moles, freckles, scars or marks that are not there.`,
    "Create ONE square image, 1024 × 1024 pixels: a model reference sheet of six photorealistic photographs of this same person, in the layout below. Do not copy the clothes, backdrop or pose of the attached picture.",
    ...sheetPanelLines(notes),
    SHEET_COMMON + (notes.tail ? ` ${notes.tail}` : ""),
    `The person is an adult ${t.gender === "man" ? "man" : "woman"} (age ${Math.round(t.age)}).`,
  ].join("\n");
}

// ---- the sheet check ----
export const sheetCheckSchema = {
  type: "object",
  additionalProperties: false,
  required: ["panels", "onePersonEach", "samePerson", "extraLimbsOrHands", "textOrLogos", "appearsUnder18", "faults"],
  properties: {
    panels: { type: "integer" },
    onePersonEach: { type: "boolean" },
    samePerson: { type: "boolean" },
    extraLimbsOrHands: { type: "boolean" },
    textOrLogos: { type: "boolean" },
    appearsUnder18: { type: "boolean" },
    faults: { type: "array", items: { type: "string" } },
  },
} as const;

/** Aaina's sheet check, cut to the questions that decide a pass (only faults fail a sheet). */
export const sheetCheckPrompt = () =>
  [
    "You check a model reference sheet: one picture that should hold exactly six photographs of ONE person in a grid (top row three face photos, bottom row a side profile and two full-length photos).",
    "Look at each panel carefully and answer:",
    "panels: how many separate photographs the sheet holds.",
    "onePersonEach: every panel shows exactly one person.",
    "samePerson: it is plainly the same person in all panels (same face, skin tone, hair, build).",
    "extraLimbsOrHands: any panel has an extra, missing or malformed hand, finger, arm or leg, or a hand where it should not be (for example a pointing hand beside the face).",
    "textOrLogos: any readable text, label, number or logo anywhere.",
    "appearsUnder18: the person looks younger than 18.",
    "faults: short sentences for REAL faults only: malformed or wrong anatomy (extra or missing limbs or fingers, fused or broken hands, a distorted body or face), more than one person in a panel or different people across panels, not six panels, any text, label, logo or watermark, a person who looks under 18. Empty when none.",
  ].join("\n");

export type SheetCheck = {
  panels: number;
  onePersonEach: boolean;
  samePerson: boolean;
  extraLimbsOrHands: boolean;
  textOrLogos: boolean;
  appearsUnder18: boolean;
  faults: string[];
};
export const sheetCheckPasses = (v: SheetCheck) =>
  v.panels === 6 && v.onePersonEach && v.samePerson && !v.extraLimbsOrHands && !v.textOrLogos && !v.appearsUnder18;

// ---- the photo check for a real person's own model ----
export const ownModelPhotoSchema = {
  type: "object",
  additionalProperties: false,
  required: ["onePerson", "faceClear", "adult", "publicFigure", "reason", "gender", "ageYears"],
  properties: {
    onePerson: { type: "boolean" },
    faceClear: { type: "boolean" },
    adult: { type: "boolean" },
    publicFigure: { type: "boolean" },
    reason: { type: "string" },
    gender: { type: "string", enum: ["woman", "man"] },
    ageYears: { type: "integer" },
  },
} as const;
/** `gender` and `ageYears` are the desktop app's two additions to Aaina's check: a model made from photos needs them for the sheet words. */
export type OwnModelPhotoCheck = {
  onePerson: boolean;
  faceClear: boolean;
  adult: boolean;
  publicFigure: boolean;
  reason: string;
  gender?: "woman" | "man";
  ageYears?: number;
};

export const ownModelPhotoPrompt = (view: "front" | "other") =>
  [
    view === "front"
      ? "This is the main photo of a person who will become a fashion model: it should show their face from the front."
      : "This is an extra photo of a person who will become a fashion model (their body or their profile).",
    "Look carefully and answer:",
    "onePerson: it shows exactly one real person (a photograph, not a drawing, cartoon or doll).",
    view === "other"
      ? "faceClear: always true for this photo."
      : "faceClear: the face is clearly visible, sharp and not hidden by sunglasses, a mask, a hand or a filter.",
    "adult: the person (every person shown) looks 18 years old or older. If there is any real doubt that they might be under 18, answer false.",
    "publicFigure: you recognise the person as a well-known public figure (a celebrity, actor, singer, politician, athlete or famous influencer). If you do not recognise them, answer false. Never say who it is.",
    "reason: one short sentence on the main problem, or empty when there is none.",
    "gender: woman or man, as the person presents.",
    "ageYears: your best estimate of their age in years.",
  ].join("\n");

/** Why a photo can't be used, in plain words, or null when it can. */
export function ownModelPhotoProblem(c: OwnModelPhotoCheck, view: "front" | "other"): string | null {
  if (!c.onePerson) return "The photo should show one real person.";
  if (view === "front" && !c.faceClear) return "The face should be clear and in view, with no sunglasses, mask or filter.";
  if (!c.adult) return "The person must be 18 or older.";
  if (c.publicFigure) return "This looks like a well-known public figure. Use a photo of yourself or someone who agreed.";
  return null;
}
