// Ported from Aaina: packages/contracts/src/sheetPose.ts (own pose from the model's sheet), conceptReference.ts (reading a pose from a photo),
// packages/providers/src/fal-preview.ts (own scene prompts) and packages/contracts/src/sceneColours.ts (colourSceneText).
export type SheetPoseWords = { gender?: string | null; pose: string; angle?: string | null; location?: string | null };

const WHO: Record<string, { noun: string; he: string; his: string }> = {
  woman: { noun: "woman", he: "She", his: "her" },
  girl: { noun: "girl", he: "She", his: "her" },
  man: { noun: "man", he: "He", his: "his" },
  boy: { noun: "boy", he: "He", his: "his" },
};

/** The picture is made from the model's sheet (one input image of six photos). Adults only in the desktop app. */
export function sheetPosePrompt(words: SheetPoseWords): string {
  const who = WHO[String(words.gender ?? "")] ?? { noun: "person", he: "They", his: "their" };
  const view = words.angle ? ` View: ${words.angle}.` : "";
  const place = words.location?.trim() ? `Scene: ${words.location.trim()}.` : "Light-grey seamless studio, soft daylight.";
  return `The reference image is a sheet of six photos of one ${who.noun}: keep exactly the same face, hair, skin tone and body, with natural realistic adult proportions (a normal head size for ${who.his} height, not a large head). Make ONE new single photograph (not a sheet, not a collage) of exactly this one person. Pose: ${words.pose.trim()}.${view} Full length, the whole person from the top of the head to the shoes with a small margin, unless the words ask for a closer crop. ${who.he} wears a plain neutral-coloured T-shirt, trousers and shoes. ${place} Exactly one person, no text.`;
}

export const NO_PERSON_SENTINEL = "NO_PERSON";
export const REFERENCE_POSE_MAX = 600;
export const REFERENCE_POSE_INSTRUCTION =
  'Describe only the body pose of the main person in this photo so a photographer could recreate it with a different person: stance and weight, where each leg and foot is, where each arm and hand is, torso and head turn, gaze direction, and camera view (front, three-quarter, side, back) and framing (full body, three-quarter, waist-up). Use camera-left / camera-right. One paragraph, under 70 words. Do not describe the person\'s looks, clothes or the place. Start with the camera view and framing. If the person faces away, write "back view: the person faces away from the camera, face not visible". For a side view write "head, shoulders, hips and feet all turn sideways, only one eye visible". If something is held or leaned on (a wall, a ledge), name it plainly.' +
  ` If there is no person in the photo, answer only ${NO_PERSON_SENTINEL}.`;

export const REFERENCE_SCENE_PLACEHOLDER = "A place like the one in my photo";
const SQUARE_SCENE =
  "Eye-level camera at chest height, looking straight ahead. Square frame: open, uncluttered ground in the middle foreground, and the place continuing naturally across the full width on both sides.";

/** A scene from words (images/generations), or from words and a reference photo (images/edits, the photo is image 1). */
export function scenePrompt(words: string, hasReference: boolean): string {
  const direction = words
    .replace(/[\u0000-\u001f]+/g, " ")
    .trim()
    .replace(/[\s.]+$/, "")
    .slice(0, 1000);
  const w = direction === REFERENCE_SCENE_PLACEHOLDER ? "" : direction;
  return hasReference
    ? `Image 1 is the customer's reference photo of a place. Make one new photograph of this same kind of place: the same setting, architecture, materials, colours, light and mood.${w ? ` ${w}.` : ""} ${SQUARE_SCENE} One continuous photograph of the place alone. No people, no watermark or brand logos, and no readable words unless the description asks for them (such as graffiti or a sign).`
    : `A photograph of a deserted, unoccupied place: ${direction}. ${SQUARE_SCENE} One continuous photograph of the place alone. No people, no watermark or brand logos, and no readable words unless the description asks for them (such as graffiti or a sign).`;
}

/** A solid-colour scene is words only, no picture. */
export function colourSceneText(name: string, hex: string): string {
  const code = hex.toLowerCase();
  const rgb = [1, 3, 5].map((start) => parseInt(code.slice(start, start + 2), 16)).join(", ");
  return `A seamless studio paper backdrop in ${name.toLowerCase()} (hex ${code}, RGB ${rgb}), the same colour on the wall and the floor, softly and evenly lit, with a soft natural contact shadow under the feet; nothing else in the scene`;
}
