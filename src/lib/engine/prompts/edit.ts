// Ported from Aaina: packages/providers/src/openrouter/photoEditPrompt.ts (Fix something, Other colours, white/grey background)
// and packages/contracts/src/photoEdits.ts (describeColour: the colour as words plus its exact code).
export type EditTarget = "model" | "flat-lay" | "ghost";
const clean = (value: string, max: number) =>
  value
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const MAX_EDIT_WORDS = 500;

function keepWords(target: EditTarget, item: string): string {
  if (target === "model")
    return (
      "Keep everything else exactly the same: the same person with the same face, hair, skin tone and body, " +
      "the same pose, framing, camera angle, lighting and background, and the garment's cut, fabric, embroidery, " +
      "print placement and every detail. Photorealistic, no text, logos or watermark."
    );
  const view =
    target === "flat-lay" ? "the same top-down view, position, size, folds and shadow shape" : "the same view, position, size and shape";
  return `Keep the ${item} exactly the same: ${view}, and its colour, fabric, print, lettering and every detail. Photorealistic, no text, logos or watermark.`;
}

/** `colour` goes in as words plus the code, e.g. "Navy #1f2a4d". */
export function colourEditPrompt(target: EditTarget, item: string, colour: string): string {
  const it = clean(item, 160).replace(/[.\s]+$/, "");
  const words = clean(colour, MAX_EDIT_WORDS).replace(/[.\s]+$/, "");
  return target === "model"
    ? `Change only the colour of the ${it} to ${words}. Any gold or silver embroidery, zari and metal trims keep their own colour; other clothes and accessories keep theirs. ${keepWords(target, it)}`
    : `Change only the colour of the ${it} to ${words}. Any gold or silver embroidery, zari and metal trims keep their own colour; props and other items keep theirs. Keep everything else exactly the same: the surface, props, lighting and framing. ${keepWords(target, it)}`;
}

export function fixEditPrompt(target: EditTarget, item: string, instruction: string): string {
  const it = clean(item, 160).replace(/[.\s]+$/, "");
  const words = clean(instruction, MAX_EDIT_WORDS).replace(/[.\s]+$/, "");
  return target === "model"
    ? `Edit this photo: ${words}. Change nothing else. ${keepWords(target, it)}`
    : `Edit this photo: ${words}. Change nothing else: keep the surface, props, lighting and framing. ${keepWords(target, it)}`;
}

/** A plain white or grey background (marketplace main images). */
export function backgroundEditPrompt(target: EditTarget, item: string, colour: "white" | "grey"): string {
  const it = clean(item, 160).replace(/[.\s]+$/, "");
  if (target !== "model") {
    const surface = colour === "grey" ? "a seamless light grey (#F1F1F1) surface" : "a seamless pure white (#FFFFFF) surface";
    return `Keep only the ${it}: remove every prop and every other item, and replace the surface with ${surface}, evenly lit, with a soft natural shadow around the ${it}. ${keepWords(target, it)}`;
  }
  const studio =
    colour === "grey" ? "a seamless light grey (#F1F1F1) studio background" : "a seamless pure white (#FFFFFF) studio background";
  return (
    `Replace only the background with ${studio}, evenly lit, with a soft natural shadow under the feet. ` +
    "Keep the person exactly the same: the same face, hair, skin tone, body, pose and framing, and the clothing's " +
    "colour, fabric, embroidery, print and every detail, and the light on them. Photorealistic, no text, logos or watermark."
  );
}

/** Aaina's "colour as words an image model follows": the name with its exact code. */
export function colourWords(name: string, hex: string): string {
  const code = hex.toLowerCase();
  return name.toLowerCase().includes(code) ? name : `${name} ${code}`;
}
