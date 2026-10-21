import { describe, expect, it } from "vitest";
import { fitInside, mimeOf, planShape, pngSize, readBackgroundPixels, sheetFaceRegion, subjectBoundsGrey } from "./images";

const rgba = (w: number, h: number, colour: (x: number, y: number) => [number, number, number]) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = colour(x, y);
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  return d;
};

describe("picture helpers", () => {
  it("detects types and PNG size", () => {
    const png = new Uint8Array(30);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    new DataView(png.buffer).setUint32(16, 1536);
    new DataView(png.buffer).setUint32(20, 1024);
    expect(mimeOf(png)).toBe("image/png");
    expect(pngSize(png)).toEqual({ width: 1536, height: 1024 });
    expect(mimeOf(new Uint8Array([0xff, 0xd8, 0xff, 0]))).toBe("image/jpeg");
    expect(mimeOf(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });
  it("fits inside the upload side", () => {
    expect(fitInside(4000, 3000)).toEqual({ width: 1536, height: 1152 });
    expect(fitInside(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("reads a white wall, a grey wall and a scene", () => {
    expect(readBackgroundPixels(rgba(100, 150, () => [255, 255, 255])).kind).toBe("white");
    expect(readBackgroundPixels(rgba(100, 150, () => [200, 200, 200])).kind).toBe("grey");
    expect(readBackgroundPixels(rgba(100, 150, (x, y) => ((x + y) % 2 ? [20, 90, 30] : [200, 180, 40]))).kind).toBe("scene");
  });
  it("finds the person on a plain wall by detail", () => {
    const N = 240;
    const grey = new Float32Array(N * N).fill(230);
    for (let y = 20; y < 220; y++) for (let x = 100; x < 140; x++) grey[y * N + x] = (x + y) % 2 ? 40 : 120;
    const b = subjectBoundsGrey(grey)!;
    expect(b.left).toBeGreaterThan(0.38);
    expect(b.right).toBeLessThan(0.62);
  });
});

describe("save shapes: crop around the person, never bars or blur", () => {
  const wall = { kind: "white" as const, rgb: [255, 255, 255] as [number, number, number] };
  const scene = { kind: "scene" as const, rgb: [10, 20, 30] as [number, number, number] };
  it("square from a square is untouched; original is untouched", () => {
    expect(planShape("square", 1536, 1536, wall, null).method).toBe("none");
    expect(planShape("original", 1536, 1536, wall, null).method).toBe("none");
  });
  it("4:5 is the full height, centred on the person", () => {
    const p = planShape("portrait-4x5", 1536, 1536, scene, { left: 0.2, right: 0.4 });
    expect(p.method).toBe("crop");
    if (p.method === "crop") {
      expect(p.sh).toBe(1536);
      expect(p.sw).toBe(1229);
      expect(p.sx).toBe(0);
      expect(p.out).toEqual({ width: 1229, height: 1536 });
    }
    const q = planShape("tall-3x4", 1536, 1536, wall, { left: 0.7, right: 0.9 });
    if (q.method === "crop") expect(q.sx).toBe(1536 - 1152);
  });
  it("a person too wide for a tall shape is shown smaller on a plain wall", () => {
    const p = planShape("tall-3x4", 1536, 1536, wall, { left: 0.05, right: 0.95 });
    expect(p.method).toBe("extend");
  });
  it("4:3 continues a plain wall but keeps a scene's own shape", () => {
    expect(planShape("landscape-4x3", 1536, 1536, wall, null).method).toBe("extend");
    expect(planShape("landscape-4x3", 1536, 1536, scene, null).method).toBe("own");
  });
});

describe("own model card", () => {
  // A 300 × 200 sheet: a white row divider at 98–101 and, in the top row, a column divider at 100–103.
  it("cuts the face from the first top tile, inside the found dividers, at 3:4 without stretching", () => {
    const w = 300;
    const h = 200;
    const grey = new Uint8Array(w * h).fill(150);
    for (let y = 98; y <= 101; y++) for (let x = 0; x < w; x++) grey[y * w + x] = 255;
    for (let x = 100; x <= 103; x++) for (let y = 0; y < 100; y++) grey[y * w + x] = 255;
    const r = sheetFaceRegion(grey, w, h);
    expect(r.left).toBeGreaterThanOrEqual(4);
    expect(r.left + r.width).toBeLessThan(100);
    expect(r.top + r.height).toBeLessThan(98);
    expect(r.width / r.height).toBeCloseTo(3 / 4, 1);
  });
  it("falls back to the layout's own thirds when no divider shows", () => {
    const r = sheetFaceRegion(new Uint8Array(300 * 200).fill(150), 300, 200);
    expect(r.left + r.width).toBeLessThanOrEqual(100);
    expect(r.top + r.height).toBeLessThanOrEqual(100);
  });
});
