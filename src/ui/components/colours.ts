export type Swatch = { name: string; hex: string; light?: boolean };

export const SWATCHES: Swatch[] = [
  { name: "Black", hex: "#161615" },
  { name: "Charcoal", hex: "#3d3d39" },
  { name: "Grey", hex: "#9a9a95" },
  { name: "Ivory", hex: "#f1ebdd", light: true },
  { name: "White", hex: "#ffffff", light: true },
  { name: "Navy", hex: "#1f2a4d" },
  { name: "Cobalt", hex: "#1f3fbf" },
  { name: "Sky", hex: "#8fb8e6" },
  { name: "Forest", hex: "#2f5d3a" },
  { name: "Sage", hex: "#9caf88" },
  { name: "Olive", hex: "#6b6b2f" },
  { name: "Mustard", hex: "#d9a321" },
  { name: "Rust", hex: "#b4532a" },
  { name: "Red", hex: "#c0272d" },
  { name: "Blush", hex: "#e9b6b6", light: true },
  { name: "Plum", hex: "#5a2a4a" },
];

const EXTRA: Swatch[] = [
  { name: "Burnt sienna", hex: "#c9552b" },
  { name: "Teal", hex: "#1f7a7a" },
  { name: "Lavender", hex: "#b9a7d9" },
  { name: "Camel", hex: "#b98a52" },
  { name: "Burgundy", hex: "#6d1f2f" },
  { name: "Coral", hex: "#ee7a63" },
  { name: "Mint", hex: "#a8d8bf" },
  { name: "Denim", hex: "#3d5a80" },
];

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const f =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};

export const isHex = (s: string) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
export const normHex = (s: string) => {
  const t = s.trim().replace("#", "").toLowerCase();
  return (
    "#" +
    (t.length === 3
      ? t
          .split("")
          .map((c) => c + c)
          .join("")
      : t)
  );
};

/** The nearest fashion colour name to a hex (plain RGB distance is enough for a label). */
export function nameColour(hex: string): string {
  const [r, g, b] = rgb(hex);
  let best = SWATCHES[0];
  let bd = Infinity;
  for (const s of [...SWATCHES, ...EXTRA]) {
    const [r2, g2, b2] = rgb(s.hex);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best.name;
}
