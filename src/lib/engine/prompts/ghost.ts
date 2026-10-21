// Ported from Aaina: packages/providers/src/openrouter/ghostPrompt.ts (square master).
import type { GhostAngle } from "../../contract";
export type GhostSource = "front" | "back" | "detail";
const clean = (value: string, max: number) =>
  value
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const GHOST_VIEWS: Record<GhostAngle, string> = {
  front: "front view, facing the camera straight on",
  "three-quarter": "three-quarter view: the garment turned about 45 degrees to the left, so the front and one side are visible",
  side: "side view: a true side profile, with the garment turned 90 degrees, showing the side seam, the sleeve from the side and the depth of the body",
  "back-three-quarter": "back three-quarter view: the garment turned about 45 degrees away from the camera, showing the back and one side",
  back: "back view: the garment turned 180 degrees to show its back, with the hollow neck opening showing the inside of the front neckline",
};

/** `frontReference`: the shoot's approved front ghost photo is sent as image 1 for the other angles. */
export function ghostPrompt(input: { item: string; angle: GhostAngle; sources: GhostSource[]; frontReference: boolean }): string {
  const item = clean(input.item, 160).replace(/[.\s]+$/, "");
  const front = input.frontReference && input.angle !== "front";
  const span = (from: number, count: number) => (count === 1 ? `Image ${from}` : `Images ${from}–${from + count - 1}`);
  const views = input.sources.join(", ");
  const refs = `${front ? "Image 1 is an approved ghost-mannequin photo of this same garment, front view: the new photo must show exactly the same garment. " : ""}${span(
    front ? 2 : 1,
    input.sources.length,
  )} ${input.sources.length === 1 ? "shows" : "show"} the garment (${views}).${
    input.sources.includes("detail") ? " Close-up photos show its fabric and details, not another item." : ""
  }`;
  const hasBack = input.sources.includes("back");
  const hasFront = input.sources.includes("front");
  const sides =
    input.angle === "side"
      ? ` Prints, lettering and logos that are on the front or back face stay on that face: seen from the side they are edge-on, so at most a thin sliver of them shows at the very front or back edge, cut off by the turn, never readable and never moved onto the side panel. Nothing is printed on the side that is not on the garment.${
          hasBack ? " The back photo and the front photo show the prints: use them for what wraps, do not invent any." : ""
        }`
      : input.angle === "back-three-quarter"
        ? " Copy the back exactly from the back photo, including any print and lettering, with the same size and position; only the front edge that turns into view may show."
        : input.angle === "back"
          ? hasBack
            ? " Copy the back exactly from the back photo, including any print and lettering."
            : " There is no back photo: make the back from the front in the same colour, fabric, trims and construction, continuing any all-over pattern; front-only prints, lettering, logos, pockets and buttons do not appear on the back."
          : !hasFront && hasBack
            ? " There is only a back photo: make the front from it in the same colour, fabric, cut and length, continuing any all-over pattern; back-only prints and lettering do not appear on the front."
            : "";
  return `Professional ecommerce ghost-mannequin (invisible mannequin) product photo, square. ${refs} Show only the ${item}, in ${GHOST_VIEWS[input.angle]}. Remove the person, hanger and any mannequin completely: no skin, hair, hands or legs, and leave out everything worn with it that is not part of it (other clothes, shoes, bags, jewellery). The garment floats in its natural worn 3D shape as if worn by an invisible body: filled-out shoulders, chest and sleeves, and a hollow neck opening showing the inside of the garment.${sides} Keep the garment exactly the same: colour, fabric, fit, length, seams, buttons, collar, cuffs, and every print, pattern and lettering in the same place and size. Do not add or remove details, and do not add labels, tags or logos that are not in the photos. Centred, the whole garment in frame with even margin and inside the middle 60% of the width, soft studio lighting, pure white background, no text or watermark.`;
}
