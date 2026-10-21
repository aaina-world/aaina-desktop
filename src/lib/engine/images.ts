// Picture helpers on a canvas (the web view's own), no native image library.
// Inputs are prepared as Aaina does (packages/providers/src/openrouter/files.ts forUpload: longest side 1536, JPEG q90 over 2 MB);
// save shapes follow apps/api/src/reshape.ts: crop around the person, never bars or blur.
import type { SaveShape } from "../contract";

export const UPLOAD_MAX_SIDE = 1536;
export const UPLOAD_MAX_BYTES = 2_000_000;
export const SAVE_JPEG_QUALITY = 0.92;

// ---------- pure helpers (tested) ----------

export function mimeOf(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length > 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/** Width and height from a PNG header. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (mimeOf(bytes) !== "image/png" || bytes.length < 24) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

export function fitInside(width: number, height: number, side = UPLOAD_MAX_SIDE) {
  const k = Math.min(1, side / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export type Background = { kind: "white" | "grey" | "plain" | "scene"; rgb: [number, number, number] };

/** reshape.ts readBackground on a 100 x 150 RGBA sample: what the background is, from the left and right edges. */
export function readBackgroundPixels(data: ArrayLike<number>, W = 100, H = 150): Background {
  const band = 7;
  const spreads: number[] = [];
  const colours: number[][] = [];
  for (let y = Math.round(H * 0.05); y < Math.round(H * 0.7); y++)
    for (const x0 of [0, W - band]) {
      const row: number[][] = [];
      for (let x = x0; x < x0 + band; x++) {
        const i = (y * W + x) * 4;
        row.push([data[i], data[i + 1], data[i + 2]]);
      }
      const mean = [0, 1, 2].map((c) => row.reduce((t, px) => t + px[c], 0) / row.length);
      spreads.push(
        Math.sqrt(row.reduce((t, px) => t + (px[0] - mean[0]) ** 2 + (px[1] - mean[1]) ** 2 + (px[2] - mean[2]) ** 2, 0) / row.length / 3),
      );
      colours.push(mean);
    }
  const sorted = [...spreads].sort((a, b) => a - b);
  const texture = sorted[Math.floor(sorted.length * 0.6)];
  const light = colours.map((c) => (c[0] + c[1] + c[2]) / 3).sort((a, b) => a - b);
  const rgb = colours[colours.length >> 1].map(Math.round) as [number, number, number];
  const typical = light[light.length >> 1];
  const tint = Math.max(...rgb) - Math.min(...rgb);
  if (texture > 7) return { kind: "scene", rgb };
  if (typical >= 246 && tint < 8) return { kind: "white", rgb };
  if (typical >= 175 && tint < 18) return { kind: "grey", rgb };
  return { kind: "plain", rgb };
}

/** reshape.ts subjectBounds on a 240 x 240 grey sample: where the person is across the photo (fractions), on a plain wall only. */
export function subjectBoundsGrey(grey: ArrayLike<number>, N = 240): { left: number; right: number } | null {
  const at = (x: number, y: number) => grey[y * N + x];
  let left = -1,
    right = -1;
  for (let x = 2; x < N - 2; x++) {
    let hits = 0;
    for (let y = 2; y < N * 0.93; y++) if (Math.abs(at(x + 1, y) - at(x - 1, y)) + Math.abs(at(x, y + 1) - at(x, y - 1)) > 14) hits++;
    if (hits > 3) {
      if (left < 0) left = x;
      right = x + 1;
    }
  }
  return left < 0 ? null : { left: left / N, right: right / N };
}

export type ShapePlan =
  | { method: "none" }
  /** Full height, cropped to this window of the source (pixels); `scale` < 1 when the person is too wide: shown smaller and the wall continued. */
  | { method: "crop"; sx: number; sy: number; sw: number; sh: number; out: { width: number; height: number } }
  /** Plain wall only: the photo scaled to this size and its edges continued to the output size. */
  | { method: "extend"; out: { width: number; height: number }; scaledWidth: number; scaledHeight: number; centre: number }
  /** A scene can't be widened without a blurred band (owner rule): keep the photo's own shape. */
  | { method: "own" };

export const SHAPE_RATIO: Record<Exclude<SaveShape, "original" | "white-square">, number> = {
  square: 1,
  "portrait-4x5": 4 / 5,
  "tall-3x4": 3 / 4,
  "landscape-4x3": 4 / 3,
};

/**
 * How to cut a photo to a shape (reshape.ts): narrower shapes are the full height cropped around the person; a wider shape
 * continues a plain wall outward, and on a scene keeps the photo's own shape. Output is at the source's height (the longest side for landscape).
 */
export function planShape(
  shape: SaveShape,
  width: number,
  height: number,
  background: Background,
  bounds: { left: number; right: number } | null,
): ShapePlan {
  if (shape === "original") return { method: "none" };
  const ratio = shape === "white-square" ? 1 : SHAPE_RATIO[shape];
  const outH = height;
  const outW = Math.round(height * ratio);
  if (Math.abs(width - outW) <= 1) return { method: "none" };
  if (width > outW) {
    const centre = bounds ? (bounds.left + bounds.right) / 2 : 0.5;
    const subject = bounds ? (bounds.right - bounds.left) * width : 0;
    // Too wide for this shape: crop the whole photo into the window anyway but never cut the person; handled by a smaller copy on the wall.
    const sx = Math.min(Math.max(0, width - outW), Math.max(0, Math.round(centre * width - outW / 2)));
    if (bounds && subject > outW * 0.96 && background.kind !== "scene") {
      const scale = (outW * 0.92) / subject;
      return {
        method: "extend",
        out: { width: outW, height: outH },
        scaledWidth: Math.round(width * scale),
        scaledHeight: Math.round(height * scale),
        centre,
      };
    }
    return { method: "crop", sx, sy: 0, sw: outW, sh: height, out: { width: outW, height: outH } };
  }
  if (background.kind === "scene") return { method: "own" };
  return { method: "extend", out: { width: outW, height: outH }, scaledWidth: width, scaledHeight: height, centre: 0.5 };
}

// ---------- canvas work (needs a browser / web view) ----------

type Canvas = OffscreenCanvas;
const newCanvas = (w: number, h: number): Canvas => new OffscreenCanvas(w, h);

export async function decode(bytes: Uint8Array, mime?: string): Promise<ImageBitmap> {
  const copy = new Uint8Array(bytes);
  return createImageBitmap(new Blob([copy.buffer], { type: mime ?? mimeOf(bytes) ?? "image/png" }), { imageOrientation: "from-image" });
}

async function encode(canvas: Canvas, type: "image/png" | "image/jpeg", quality?: number): Promise<Uint8Array> {
  const blob = await canvas.convertToBlob({ type, quality });
  return new Uint8Array(await blob.arrayBuffer());
}

export type Prepared = { bytes: Uint8Array; mime: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number };

/** Prepares a picture to send: as is when small enough, else longest side 1536 as a JPEG (flattened on white). */
export async function prepareInput(bytes: Uint8Array): Promise<Prepared> {
  const mime = mimeOf(bytes);
  if (!mime) throw new Error("That file is not a picture OpenAI can read. Use a JPEG, PNG or WebP photo.");
  const bmp = await decode(bytes, mime);
  const { width: w, height: h } = bmp;
  if (Math.max(w, h) <= UPLOAD_MAX_SIDE && bytes.length <= UPLOAD_MAX_BYTES) {
    bmp.close();
    return { bytes, mime, width: w, height: h };
  }
  const size = fitInside(w, h);
  const c = newCanvas(size.width, size.height);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size.width, size.height);
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, 0, 0, size.width, size.height);
  bmp.close();
  return { bytes: await encode(c, "image/jpeg", 0.9), mime: "image/jpeg", width: size.width, height: size.height };
}

/** A small JPEG for the reading model (longest side 1024, white background). */
export async function readingSample(bytes: Uint8Array, side = 1024): Promise<Prepared> {
  const bmp = await decode(bytes);
  const size = fitInside(bmp.width, bmp.height, side);
  const c = newCanvas(size.width, size.height);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size.width, size.height);
  g.drawImage(bmp, 0, 0, size.width, size.height);
  bmp.close();
  return { bytes: await encode(c, "image/jpeg", 0.85), mime: "image/jpeg", width: size.width, height: size.height };
}

async function sample(bmp: ImageBitmap, w: number, h: number): Promise<Uint8ClampedArray> {
  const c = newCanvas(w, h);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

export async function analyse(bmp: ImageBitmap) {
  const background = readBackgroundPixels(await sample(bmp, 100, 150));
  if (background.kind === "scene") return { background, bounds: null };
  const rgba = await sample(bmp, 240, 240);
  const grey = new Float32Array(240 * 240);
  for (let i = 0; i < grey.length; i++) grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return { background, bounds: subjectBoundsGrey(grey) };
}

/** Continues a plain wall outward by stretching the edge strip, row by row, as Aaina's reshape does. */
function drawExtended(
  g: OffscreenCanvasRenderingContext2D,
  bmp: ImageBitmap,
  plan: Extract<ShapePlan, { method: "extend" }>,
  bg: Background,
) {
  const { out, scaledWidth: sw, scaledHeight: sh } = plan;
  g.fillStyle = `rgb(${bg.rgb.join(",")})`;
  g.fillRect(0, 0, out.width, out.height);
  const left =
      sw >= out.width
        ? Math.min(0, Math.max(out.width - sw, Math.round(out.width / 2 - plan.centre * sw)))
        : Math.floor((out.width - sw) / 2),
    top = Math.floor((out.height - sh) / 2);
  const w = bmp.width,
    h = bmp.height;
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, left, top, sw, sh);
  const stripW = Math.max(1, Math.round((w * 6) / 1024) || 1);
  if (left > 0) {
    g.drawImage(bmp, 0, 0, stripW, h, 0, top, left, sh);
    g.drawImage(bmp, w - stripW, 0, stripW, h, left + sw, top, out.width - left - sw, sh);
  }
  if (top > 0) {
    g.drawImage(bmp, 0, 0, w, stripW, left, 0, sw, top);
    g.drawImage(bmp, 0, h - stripW, w, stripW, left, top + sh, sw, out.height - top - sh);
  }
}

/** The photo in a save shape and format. The person is always whole; no bars, no blurred fill. */
export async function renderForSave(bytes: Uint8Array, shape: SaveShape, format: "jpeg" | "png"): Promise<Uint8Array> {
  const bmp = await decode(bytes);
  const type = format === "jpeg" ? "image/jpeg" : "image/png";
  const quality = format === "jpeg" ? SAVE_JPEG_QUALITY : undefined;
  if (shape === "original" && format === "png") {
    bmp.close();
    return bytes;
  }
  const { background, bounds } = await analyse(bmp);
  const plan = planShape(shape, bmp.width, bmp.height, background, bounds);
  let canvas: Canvas;
  if (plan.method === "none" || plan.method === "own") {
    canvas = newCanvas(bmp.width, bmp.height);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
  } else if (plan.method === "crop") {
    canvas = newCanvas(plan.out.width, plan.out.height);
    canvas.getContext("2d")!.drawImage(bmp, plan.sx, plan.sy, plan.sw, plan.sh, 0, 0, plan.out.width, plan.out.height);
  } else {
    canvas = newCanvas(plan.out.width, plan.out.height);
    drawExtended(canvas.getContext("2d")!, bmp, plan, background);
  }
  // White square: a plain white or grey wall is lifted to pure white (a true white background for other photos needs the paid
  // background edit, see backgroundEditPrompt); scenes are left as they are.
  if (shape === "white-square" && background.kind !== "scene") {
    const g = canvas.getContext("2d")!;
    const img = g.getImageData(0, 0, canvas.width, canvas.height);
    const k = background.rgb.map((v) => 255 / Math.max(1, v));
    for (let i = 0; i < img.data.length; i += 4) for (let c = 0; c < 3; c++) img.data[i + c] = Math.min(255, img.data[i + c] * k[c]);
    g.putImageData(img, 0, 0);
  }
  if (format === "jpeg") {
    // JPEG has no alpha: flatten on white
    const flat = newCanvas(canvas.width, canvas.height);
    const g = flat.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, flat.width, flat.height);
    g.drawImage(canvas, 0, 0);
    canvas = flat;
  }
  bmp.close();
  return encode(canvas, type, quality);
}
