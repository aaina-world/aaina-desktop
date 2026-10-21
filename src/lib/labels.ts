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
