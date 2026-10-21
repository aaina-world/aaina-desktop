// Ported from Aaina: packages/providers/src/openrouter/flatLayPrompt.ts (clean, folded and styled; the outfit style is not in the desktop app).
export type FlatLaySource = "front" | "back" | "detail";
const clean = (value: string, max: number) =>
  value
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function flatLayArrangement(item: string, section: "clothing" | "accessories" | null, side: "front" | "back" = "front"): string {
  if (side === "back")
    return flatLayArrangement(item, section)
      .replace(/\bfront side up\b/g, "back side up")
      .replace(/^The (.+?) lies flat, back side up,/, "The $1 lies flat, face down with its back facing up,");
  if (section !== "accessories")
    return `The ${item} lies flat, front side up, smoothed out and neatly shaped: sleeves (if any) arranged naturally at its sides, hem straight, with gentle natural fabric folds and soft creases, never pressed paper-flat or stiff.`;
  if (
    /\b(shoe|shoes|sneaker|sneakers|trainer|heel|heels|sandal|sandals|boot|boots|loafer|loafers|flat|flats|slipper|slippers|mule|mules|juttis?|mojaris?|kolhapuris?)\b/i.test(
      item,
    )
  )
    return `Show the pair of ${item} side by side, seen from directly above, both the same way up, laces or straps tidy.`;
  if (/\b(bag|handbag|tote|clutch|purse|wallet|backpack|sling|satchel|potli)\b/i.test(item))
    return `The ${item} lies flat, front side up, with its handles or strap laid out neatly beside it.`;
  if (
    /\b(necklace|chain|pendant|earring|earrings|jhumka|jhumkas|bracelet|bangle|bangles|ring|rings|anklet|mangalsutra|choker|maang|nose ?pin)\b/i.test(
      item,
    )
  )
    return `The ${item} is laid out neatly and symmetrically, every stone, bead and link visible, earrings as a matching pair.`;
  if (/\b(watch|watches)\b/i.test(item)) return `The ${item} lies flat with its dial facing up and the strap opened out on both sides.`;
  return `The ${item} lies flat, front side up, neatly arranged as a stylist would place it.`;
}

export function flatLayStyleText(style: "clean" | "folded" | "styled", item: string, side: "front" | "back" = "front"): string {
  switch (style) {
    case "clean":
      return "Seamless pure white (#FFFFFF) surface, nothing else in the photo. Soft, even, diffused overhead light with only a faint natural contact shadow around the product's edges; the white stays clean and bright.";
    case "folded":
      return `The ${item} is neatly folded as in a premium shop display, into a tidy rectangle with crisp, even folds, ${side === "back" ? "back side up" : "front side up"}. ${
        /\b(jeans|trousers?|pants|chinos|joggers|leggings|palazzos?|cargos?|slacks)\b/i.test(item)
          ? `Fold them as a denim shop does: one leg laid exactly over the other, then folded over in thirds into a neat stack, with ${side === "back" ? "the back yoke and back pockets" : "the waistband, button and front pocket"} on top; the folded layers at the edge show they are full-length, never cut or shortened into shorts.`
          : /\b(sarees?|saris?)\b/i.test(item)
            ? "Fold it as a sari shop presents one, not draped: the sari folded into a neat flat rectangle, its border running along the edge, with the pallu folded back over the top to show its design; any blouse is folded small and laid on one corner."
            : side === "back"
              ? "Fold it so its back print, lettering and yoke stay fully visible and nothing on the back is hidden; the sleeves and lower part fold behind."
              : "Fold it so its front print, lettering, collar or neckline stays fully visible and nothing on the front is hidden; the sleeves and lower part fold behind."
      } Seamless pure white (#FFFFFF) surface, soft diffused overhead light and a soft natural shadow beneath the folds.`;
    case "styled":
      return `The ${item} lies on one natural textured surface that suits its colours: natural linen, pale light wood or white marble. Add one to three small, tasteful, unbranded props that suit the product and its mood (for example a sprig of greenery, sunglasses, a small ceramic dish or a notebook), placed around the product near the edges of the frame. Props never touch, overlap or cover the product, carry no text or logos, and are clearly smaller; the product is the clear hero in the centre. Soft natural daylight from above with gentle natural shadows.`;
  }
}

export function flatLayPrompt(input: {
  item: string;
  section: "clothing" | "accessories" | null;
  style: "clean" | "folded" | "styled";
  side: "front" | "back";
  sources: FlatLaySource[];
}): string {
  const item = clean(input.item, 160)
    .replace(/[.\s]+$/, "")
    .replace(/^[A-Z](?=[a-z])/, (l) => l.toLowerCase());
  const n = input.sources.length;
  const span = n === 1 ? "Image 1" : `Images 1–${n}`;
  const views = input.sources.join(", ");
  const refs = `${span} ${n === 1 ? "shows" : "show"} the product (${views}).${input.sources.includes("detail") ? " Close-up photos show its fabric and details, not another item." : ""}`;
  const onlyBack = !input.sources.includes("front") && input.sources.includes("back");
  const back = input.side === "back";
  const hasBackPhoto = input.sources.includes("back");
  const side = back
    ? ` ${hasBackPhoto ? "Image 1 shows the back of the product" : "There is no back photo, so show only the plain reverse side"}: the ${item} lies face down with its back facing up, showing only its back, with the back print, lettering and details exact, in the same place and size, reading correctly. Show nothing from the front: the front is hidden underneath.${
        hasBackPhoto && n > 1
          ? " The other photos show other sides and are only for colour, fabric and cut: never copy their front print or details onto the back."
          : ""
      }`
    : onlyBack
      ? " There is only a back photo: show the side the photos show."
      : "";
  return `Professional ecommerce flat-lay product photograph, square 1:1, shot from directly above with the camera looking straight down (a true top-down view, no perspective tilt). ${refs} Show only the ${item}. Remove the person, hanger, mannequin and packaging completely: no hands, skin, hair or people, and leave out everything worn or shown with it that is not part of it. ${
    input.style === "folded" ? "" : `${flatLayArrangement(item, input.section, back ? "back" : "front")} `
  }${flatLayStyleText(input.style, item, back ? "back" : "front")}${side} Keep the ${item} exactly the same as in the photos: colour, fabric and texture, shape, length, seams, buttons, hardware, and every print, pattern and lettering in the same place and size, reading correctly. Do not add or remove details, and do not add labels, tags, stickers, price tags or logos that are not in the photos. Realistic fabric weight and folds, true-to-life colours, crisp focus across the whole product. Compose loosely, as a wide shot: the ${item} is centred and shown fairly small, taking up only about half of the image width (sleeves and straps included), with generous empty space on every side, nothing cut off. Photorealistic, no text, captions or watermark.`;
}
