/**
 * Proper names for any colour a seller picks ("Sage", "Dusty rose", "Powder blue"), so the image
 * model gets the shade by name as well as by code: models follow names better than codes, and a
 * plain "green" made a sage backdrop greyer and off (2026-09-28 pilot, ΔE 5.2). Names are the ones
 * fashion and marketplace listings use; each has a typical shade. A picked colour takes the
 * closest name by how different the colours look (CIEDE2000), or none when nothing is close.
 */
export const COLOUR_NAMES: ReadonlyArray<readonly [name: string, hex: string]> = [
  // Neutrals
  ["Black", "#1d1d1f"],
  ["Charcoal", "#36454f"],
  ["Graphite", "#4b4e53"],
  ["Slate grey", "#708090"],
  ["Grey", "#8e8e93"],
  ["Silver grey", "#b8b8bc"],
  ["Light grey", "#d3d3d6"],
  ["White", "#fbfaf7"],
  ["Off-white", "#f3efe6"],
  ["Ivory", "#efe6d2"],
  ["Cream", "#f1e3c3"],
  ["Beige", "#d8c3a0"],
  ["Sand", "#c9b38c"],
  ["Taupe", "#8b7d6b"],
  ["Stone", "#a79e8e"],
  ["Oatmeal", "#ddd0b8"],
  // Browns
  ["Camel", "#c19a6b"],
  ["Tan", "#b58a5c"],
  ["Caramel", "#a86b3c"],
  ["Cognac", "#8e4a24"],
  ["Brown", "#6b4430"],
  ["Chocolate", "#4a2c20"],
  ["Coffee", "#5b3a29"],
  ["Mocha", "#7a5a48"],
  // Reds and pinks
  ["Red", "#c21e2c"],
  ["Scarlet", "#e0301e"],
  ["Cherry red", "#b3122a"],
  ["Crimson", "#9e1b32"],
  ["Maroon", "#6d1a26"],
  ["Burgundy", "#7a1f35"],
  ["Wine", "#5e1a2e"],
  ["Brick red", "#a2402f"],
  ["Coral", "#f27a63"],
  ["Peach", "#f5c3a4"],
  ["Salmon pink", "#f4a18c"],
  ["Blush pink", "#efb7c0"],
  ["Baby pink", "#f6ccd6"],
  ["Dusty rose", "#c98f98"],
  ["Rose pink", "#e37f9f"],
  ["Hot pink", "#e5357f"],
  ["Rani pink", "#d0287a"],
  ["Fuchsia", "#c21e87"],
  ["Magenta", "#a3176f"],
  ["Onion pink", "#d9a3a8"],
  ["Neon pink", "#f01fd0"],
  // Oranges and yellows
  ["Rust", "#b7472a"],
  ["Terracotta", "#c46a4a"],
  ["Burnt orange", "#c85a1f"],
  ["Orange", "#ef7d22"],
  ["Tangerine", "#f39237"],
  ["Apricot", "#f4b183"],
  ["Saffron", "#f2a01e"],
  ["Mustard", "#d4a017"],
  ["Ochre", "#c28a2b"],
  ["Gold", "#c9a227"],
  ["Yellow", "#f2d43c"],
  ["Lemon yellow", "#f5e663"],
  ["Butter yellow", "#f6e7a1"],
  // Greens
  ["Olive", "#6b6b2e"],
  ["Khaki", "#a89f6a"],
  ["Army green", "#4b5320"],
  ["Moss green", "#6b7a3a"],
  ["Sage", "#9caf88"],
  ["Pistachio", "#b6cf95"],
  ["Mint", "#a8d8b9"],
  ["Pastel green", "#c3e3c1"],
  ["Lime green", "#8bc34a"],
  ["Parrot green", "#4fa84a"],
  ["Leaf green", "#3f8f3a"],
  ["Green", "#2e8b57"],
  ["Emerald", "#0f6b45"],
  ["Bottle green", "#0b4d33"],
  ["Forest green", "#1f4d2f"],
  ["Pine green", "#1f4d3a"],
  ["Sea green", "#3aa38f"],
  ["Neon green", "#7cf21f"],
  // Blues and teals
  ["Teal", "#0f6e6e"],
  ["Peacock blue", "#00627a"],
  ["Turquoise", "#35b8b2"],
  ["Aqua", "#7fd6d4"],
  ["Sky blue", "#8fc1e3"],
  ["Baby blue", "#bcd9ee"],
  ["Powder blue", "#b0c4de"],
  ["Steel blue", "#4a7aa8"],
  ["Denim blue", "#3b5b8a"],
  ["Cobalt blue", "#1f4fb3"],
  ["Royal blue", "#2748a8"],
  ["Blue", "#2f5ec2"],
  ["Indigo", "#2e2f6e"],
  ["Navy", "#1f2a4d"],
  ["Midnight blue", "#161d36"],
  ["Electric blue", "#1f5bff"],
  // Purples
  ["Lavender", "#b9a4d8"],
  ["Lilac", "#c8a8d8"],
  ["Mauve", "#a7859f"],
  ["Orchid", "#b86bb0"],
  ["Purple", "#6b3fa0"],
  ["Violet", "#7c4dbd"],
  ["Plum", "#5e2a4f"],
  ["Aubergine", "#3d1f35"],
];

/** Beyond this difference no name fits well enough; the colour is described in plain words instead. */
export const COLOUR_NAME_MAX_DELTA = 10;

/** The closest proper name for a colour and how different it looks (ΔE2000), or null if none is close. */
export function nearestColourName(hex: string): { name: string; delta: number } | null {
  const target = hexToLab(hex);
  let best: { name: string; delta: number } | null = null;
  for (const [name, code] of COLOUR_NAMES) {
    const delta = deltaE2000(target, hexToLab(code));
    if (!best || delta < best.delta) best = { name, delta };
  }
  return best && best.delta <= COLOUR_NAME_MAX_DELTA ? best : null;
}

type Lab = [l: number, a: number, b: number];

/** sRGB hex → CIE Lab (D65). */
export function hexToLab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** How different two colours look (CIEDE2000): about 1 is invisible, 2–4 close, above 10 clearly different. */
export function deltaE2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cMean = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hue = (a: number, b: number) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const h1p = hue(a1p, b1);
  const h2p = hue(a2p, b2);
  const dL = l2 - l1;
  const dC = c2p - c1p;
  let dh = 0;
  if (c1p * c2p !== 0) dh = Math.abs(h2p - h1p) <= 180 ? h2p - h1p : h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p + 360;
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh * rad) / 2);
  const lMean = (l1 + l2) / 2;
  const cpMean = (c1p + c2p) / 2;
  let hMean = h1p + h2p;
  if (c1p * c2p !== 0)
    hMean = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const t =
    1 -
    0.17 * Math.cos((hMean - 30) * rad) +
    0.24 * Math.cos(2 * hMean * rad) +
    0.32 * Math.cos((3 * hMean + 6) * rad) -
    0.2 * Math.cos((4 * hMean - 63) * rad);
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cpMean;
  const sh = 1 + 0.015 * cpMean * t;
  const rt = -2 * Math.sqrt(cpMean ** 7 / (cpMean ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hMean - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
}
