// Words for shot kinds, shared by the screens and by the photo titles the real Api writes.
import type { FlatLayStyle, GhostAngle } from "./contract";

export const GHOST_ANGLE_NAME: Record<GhostAngle, string> = {
  front: "Front",
  "three-quarter": "Three-quarter",
  side: "Side",
  "back-three-quarter": "Back three-quarter",
  back: "Back",
};

/** The title a finished flat-lay photo carries (the screens show shorter names on the style cards). */
export const FLAT_LAY_TITLE: Record<FlatLayStyle, string> = {
  clean: "Clean flat-lay",
  folded: "Folded flat-lay",
  styled: "Styled flat-lay",
};

/** How a pose is framed, in plain words, in the order the Framing filter lists them. */
export const FRAMING_NAMES = ["Full length", "Head to knee", "Waist up", "Close-up", "Lower body", "Detail"] as const;
export type FramingName = (typeof FRAMING_NAMES)[number];

/**
 * The catalogue tags each pose with the part of the body it shows, as "top-bottom" ("head-feet", "chin-knees",
 * "head_to_hip") or a named crop ("hand_close", "waist_up"). Shown to people as one of a few plain names.
 */
export function framingName(framing: string | null | undefined): FramingName | null {
  const tag = (framing ?? "").toLowerCase().trim();
  if (!tag) return null;
  if (tag === "full_length") return "Full length";
  if (tag === "waist_up") return "Waist up";
  if (/close|hands_torso/.test(tag)) return "Detail";
  const parts = tag.split(/_to_|[-_]/).filter(Boolean);
  const top = parts[0];
  const bottom = parts[parts.length - 1] ?? "";
  // From the head (or chin, ear, lower face) or the shoulders: the photo shows the person, not just their legs.
  const fromTop = ["head", "chin", "ear", "lower", "shoulders"].includes(top);
  if (/^(feet|shoes)$/.test(bottom)) return fromTop || top === "chest" ? "Full length" : "Lower body";
  if (/^knees?$/.test(bottom)) return fromTop || top === "chest" ? "Head to knee" : "Lower body";
  if (/^(hips?|waist)$/.test(bottom)) return fromTop ? "Waist up" : "Detail";
  if (/^(chest|shoulders|neck|face)$/.test(bottom)) return "Close-up";
  return null;
}
