// Ported from Aaina: packages/providers/src/openrouter/modelPhotoPrompt.ts (editPrompt, squareFraming, frame and
// expression words) and packages/contracts/src/modelSheet.ts (SHEET_IDENTITY_SENTENCE). Only what the desktop app uses:
// no Pose Studio, print designs, extra pictures, fine-weave close-ups, marketplace panels or turns.
import type { Expression, Frame } from "../../contract";

export const SHEET_IDENTITY_SENTENCE = (name: string) =>
  `Image 1 is a sheet of six photos of the model ${name} (face from the front, both three-quarter views, the profile, and full length from the front and three-quarter): keep exactly the same face, hair, skin tone, body and proportions. Use it for identity only.`;

export const WIDE_POSE =
  /\b(sit|sits|sitting|seated|perch|perched|crouch|crouching|squat|kneel|kneeling|lying|lie|lounge|lounging|recline|sweep|twirl|spin|swirl|lunge|stride|straddle|arms? (?:out|wide|spread|outstretched|open)|spread|outstretched|wide stance|legs? (?:extended|out)|cross-legged)\b/i;
export const FULL_LENGTH = /full[_ ]?length|head[_ ]to[_ ](?:shoes|toe|feet)/i;

export const FRAME_WORDING = {
  full_length:
    "Full length: the whole person from the top of the head to the shoes, head near the top and shoes near the bottom, each with a small margin, so the person fills the full height.",
  three_quarter: "Crop: a three-quarter shot from just above the head to just below the knees; the lower legs are out of frame.",
  waist_up: "Crop: a waist-up shot from just above the head to just below the waist; the hips and legs are out of frame.",
  close_up:
    "Crop: a close-up portrait of the head and shoulders down to the upper chest, the face large, sharp and in focus; the body below the chest is out of frame.",
} as const;
export type AainaFrame = keyof typeof FRAME_WORDING;

export const EXPRESSION_WORDING = {
  neutral: "a calm, neutral expression with a relaxed mouth",
  soft_smile: "a soft, natural closed-mouth smile",
  big_smile: "a big, genuine smile showing the teeth, the eyes smiling too",
  serious: "a serious, confident look with no smile",
  looking_away: "a relaxed expression, the eyes and face turned slightly away from the camera to one side, the face still clearly visible",
} as const;
type AainaExpression = keyof typeof EXPRESSION_WORDING;

/** The desktop's choices in Aaina's ids; "as posed" is undefined. */
export const FRAME_OF: Record<Frame, AainaFrame | undefined> = {
  "as-posed": undefined,
  "full-length": "full_length",
  "head-to-knee": "three_quarter",
  "waist-up": "waist_up",
  "close-up": "close_up",
};
export const EXPRESSION_OF: Record<Expression, AainaExpression | undefined> = {
  "as-posed": undefined,
  neutral: "neutral",
  "soft-smile": "soft_smile",
  "big-smile": "big_smile",
  serious: "serious",
  "looking-away": "looking_away",
};

const CROP_WORDS: Record<string, string> = {
  head_to_hip: "from just above the head to the hips",
  head_to_knee: "from just above the head to just below the knees",
  head_to_waist: "from just above the head to just below the waist",
  waist_up: "from just above the head to just below the waist",
  head_to_chest: "from just above the head to the chest",
  head_shoulders: "the head and shoulders",
  head_neck: "the head and neck",
  lower_face_to_chest: "from the lower face to the chest",
  ear_half_face: "a close-up of the ear and half of the face",
  shoulders_to_hip: "from the shoulders to the hips",
  hands_torso: "the hands and torso",
  waist_close: "a close-up of the waist",
  waist_to_knee: "from the waist to the knees",
  waist_to_shoes: "from the waist down to the shoes",
  knees_to_shoes: "from the knees down to the shoes",
  calves_to_shoes: "the lower legs and shoes",
  wrist_close: "a close-up of the wrist",
  hand_close: "a close-up of the hand",
};

type Pose = { text: string; framing?: string | null; frame?: AainaFrame; angle?: string };

/** The square master: the person stays in the middle 60% of the width so every save shape can be cut from it. */
export function squareFraming(pose: Pose): string {
  if (pose.frame && pose.frame !== "full_length")
    return `Square 1:1 photograph. ${FRAME_WORDING[pose.frame]} Keep the person centred inside the middle 60% of the width, with the scene continuing naturally across the full width on both sides.`;
  if (!pose.frame && pose.framing && !FULL_LENGTH.test(pose.framing)) {
    const crop = CROP_WORDS[pose.framing] ?? pose.framing.replace(/_/g, " ");
    return `Square 1:1 photograph. Crop: the same framing as the pose photo, ${crop}; do not widen the shot to show the whole body. Keep what is in frame centred inside the middle 60% of the width, with the scene continuing naturally across the full width on both sides.`;
  }
  if (WIDE_POSE.test(pose.text))
    return "Square 1:1 photograph of a wide pose. The person's entire silhouette (head, hair, both hands and elbows, both knees and feet, and the full spread of any skirt, hem or dupatta) must fit inside the middle 60% of the frame's width, centred, with clear empty scene on both sides beyond it. For a wide or low pose, make the person smaller in the frame and leave more space above the head rather than letting any part reach the sides. Head, feet and garment always fully in frame with margin.";
  return `Square 1:1 photograph. Compose the person as for a 2:3 portrait, centred: keep the whole person, including hands, hair and any flowing fabric, inside the middle 60% of the width; the scene continues naturally across the full width on both sides.${
    pose.frame === "full_length" || !pose.framing || FULL_LENGTH.test(pose.framing) ? ` ${FRAME_WORDING.full_length}` : ""
  }`;
}

const clean = (value: string, max: number) =>
  value
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const ACCESSORY =
  /\b(bag|handbag|clutch|tote|shoe|sneaker|heel|sandal|boot|jewell?ery|earring|necklace|ring|bracelet|bangle|watch|belt|scarf|cap|hat|sunglass)/i;

export type ModelPhotoPrompt = {
  modelName: string;
  /** Identity pictures sent first: 1 sheet, or several photos of an older model. */
  identity: { count: number; sheet: boolean };
  /** A pose picture is sent after the identity pictures. */
  hasPoseImage: boolean;
  /** The pose's direction in words: a written pose, or text stored with a pose. Optional for catalogue poses. */
  poseText?: string;
  poseFraming?: string | null;
  poseAngle?: string;
  frame?: AainaFrame;
  expression?: AainaExpression;
  /** The scene: a picture (sent after the pose), words (colour or none), or nothing. */
  scene: { kind: "image" } | { kind: "words"; text: string } | { kind: "none" };
  /** Product photos, in the order they are sent after the scene picture. */
  products: Array<"front" | "back" | "detail">;
  /** What the product is (reading label), to tell clothes from accessories. */
  productType?: string;
  /** Make again: the seller's note. */
  note?: string;
};

export function modelPhotoPrompt(input: ModelPhotoPrompt): string {
  const modelName = clean(input.modelName || "the model", 100);
  const span = (from: number, count: number) => (count === 1 ? `Image ${from}` : `Images ${from}–${from + count - 1}`);
  const fullDirection = clean(input.poseText ?? "", 1000).replace(/[.\s]+$/, "");
  const cropped = Boolean(input.frame && input.frame !== "full_length");
  const dropped = (part: string) => /\bvisible\b/i.test(part);
  const direction = cropped
    ? fullDirection
        .split(/(?<=[.;,])\s+/)
        .filter((p) => !dropped(p))
        .join(" ")
        .replace(/[.;,\s]+$/, "") || fullDirection
    : fullDirection;
  const reframed = Boolean(input.frame);
  const ignoreWorn = "ignore everything worn or carried in it (clothes, hats, bags, straps, jewellery, props): none of it appears";
  const copies = "body position, arms, hands and head turn";
  const notCopied = "the framing";
  const notKept = "its framing";
  const ids = input.identity.count;
  const identitySentence =
    ids === 1 && input.identity.sheet
      ? SHEET_IDENTITY_SENTENCE(modelName)
      : `${span(1, ids)} ${ids === 1 ? "is a photo" : "are photos"} of the model ${modelName}: keep the same face, hair and body. Use them for identity only.`;
  const people = ids
    ? `${identitySentence}${
        input.hasPoseImage
          ? reframed
            ? ` Image ${ids + 1} shows the pose to copy (${copies}), not ${notCopied}; ${ignoreWorn}.`
            : ` Image ${ids + 1} shows the pose and framing to copy; ${ignoreWorn}.`
          : ""
      }`
    : reframed
      ? `Image 1 is the model ${modelName} in the pose to copy: keep the same face, hair, body and pose (not ${notKept}), and ${ignoreWorn}.`
      : `Image 1 is the model ${modelName} in the pose to copy: keep the same face, hair, body, pose and framing, and ${ignoreWorn}.`;
  const backdropNumber = ids + (input.hasPoseImage ? 1 : 0) + 1;
  const seat = ` If the pose sits, ${modelName} sits on something that belongs in this scene.`;
  const scene =
    input.scene.kind === "image"
      ? ` Image ${backdropNumber} is the empty scene: place ${modelName} naturally in it, matching its light and perspective; the background comes only from this image, never from the other photos.${seat}`
      : input.scene.kind === "words"
        ? ` Scene: ${clean(input.scene.text, 1000)}.${seat}`
        : "";
  const productStart = ids + (input.hasPoseImage ? 1 : 0) + (input.scene.kind === "image" ? 1 : 0) + 1;
  const angles = input.products;
  const views = angles.map((a) => a ?? "view").join(", ");
  const garment = !ACCESSORY.test(input.productType ?? "");
  const product = `${span(productStart, angles.length)} ${angles.length === 1 ? "shows" : "show"} the ${garment ? "outfit" : "product"} (${views}). ${
    garment ? `Dress ${modelName} in exactly this outfit.` : `Place this product on ${modelName} naturally.`
  } Copy it precisely: every section and layer, its length, colours and fabric, and exactly where any print, embroidery or lettering sits and where it stops; plain parts stay plain.${
    angles.includes("detail") ? " Close-up photos show its fabric and details, not another item." : ""
  } Do not copy the person, the place or the background from these photos.`;
  const showsBack = input.poseAngle === "back";
  const inferredBack =
    showsBack && !angles.includes("back")
      ? " There is no back photo: make the back from the front in the same colour, fabric, cut and length, continuing any all-over pattern; front-only prints, lettering, logos, pockets and buttons do not appear on the back."
      : !showsBack && !angles.includes("front") && angles.includes("back")
        ? " There is only a back photo: make the front from it in the same colour, fabric, cut and length, continuing any all-over pattern; back-only prints and lettering do not appear on the front."
        : "";
  const directionNote =
    " The pose direction was written for the pose photo: any clothes, accessories or props it names belong to that photo, not to this shoot; follow only the body position, and where it refers to an item that is not worn here (a hood, jacket pocket, cap or bag), adapt naturally.";
  const backCopy =
    showsBack && angles.includes("back")
      ? " This pose shows the back: copy the back exactly from the back photo, including any print or lettering with the same wording, typeface, weight, size and position, and keep it uncovered: long hair falls to the side, clear of it."
      : "";
  const custom = input.note?.trim() ? ` Also: ${clean(input.note, 500)}.` : "";
  const framing = input.frame ? "" : input.poseFraming ? ` Framing: ${clean(input.poseFraming, 80)}.` : "";
  const faceShown = true;
  const expression =
    input.expression && !showsBack && faceShown
      ? ` Expression: ${EXPRESSION_WORDING[input.expression]} (this replaces any expression or gaze in the pose direction); the face stays exactly ${modelName}'s.`
      : "";
  const styling = garment
    ? ` Style the rest of the look (shoes, jewellery, any other clothes) tastefully to suit the outfit and the scene, without hiding or competing with it. No hat, cap, hood, jacket, bag, strap or other item that is not in the product photos: nothing covers or competes with the product, and the hair stays as in the model's photos.`
    : ` Dress ${modelName} in a tasteful, well-styled outfit chosen to suit this product and the scene, like a fashion editorial: its neckline, sleeves and colours should show the product off and leave it fully visible. Do not use the plain clothes from the pose photo. Keep other jewellery and accessories minimal so the product stays the focus.`;
  const shape = `Photorealistic fashion photograph. ${squareFraming({ text: fullDirection, framing: input.poseFraming, frame: input.frame, angle: input.poseAngle })}`;
  const poseLine = direction ? ` Pose direction: ${direction}.${directionNote}` : "";
  return `${shape} ${people}${poseLine}${framing}${expression}${scene} ${product}${backCopy}${inferredBack}${styling}${custom}`;
}
