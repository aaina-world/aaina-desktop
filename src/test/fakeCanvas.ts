// Minimal stand-ins for createImageBitmap and OffscreenCanvas (jsdom has neither), so picture code runs in tests.
// A "decoded" picture takes its size from a PNG header; anything else is 100 x 100. Drawing is recorded, not rendered.
import { vi } from "vitest";
import { mimeOf, pngSize } from "../lib/engine/images";

export const drawn: Array<{ canvas: string; args: unknown[] }> = [];
export const canvases: FakeCanvas[] = [];
/** What a sampled area of the picture looks like (RGBA, row by row); default is a plain white wall. */
export const sampler = {
  colour: [255, 255, 255, 255] as number[],
  fn: null as null | ((x: number, y: number, w: number, h: number) => number[]),
};

class FakeContext {
  fillStyle = "";
  imageSmoothingQuality = "low";
  constructor(private canvas: FakeCanvas) {}
  fillRect(...args: unknown[]) {
    drawn.push({ canvas: this.canvas.id, args: ["fillRect", ...args] });
  }
  drawImage(...args: unknown[]) {
    drawn.push({ canvas: this.canvas.id, args: ["drawImage", ...args.slice(1)] });
  }
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(sampler.fn ? sampler.fn(x, y, w, h) : sampler.colour, (y * w + x) * 4);
    return { data, width: w, height: h };
  }
  putImageData() {
    drawn.push({ canvas: this.canvas.id, args: ["putImageData"] });
  }
}

let counter = 0;
export class FakeCanvas {
  id = `c${++counter}`;
  private ctx = new FakeContext(this);
  constructor(
    public width: number,
    public height: number,
  ) {
    canvases.push(this);
  }
  getContext() {
    return this.ctx;
  }
  async convertToBlob(options: { type: string; quality?: number }) {
    return new Blob([new Uint8Array([options.type === "image/png" ? 0x89 : 0xff, 1, 2, 3])], { type: options.type });
  }
}

export function installCanvas(): void {
  drawn.length = 0;
  canvases.length = 0;
  sampler.colour = [255, 255, 255, 255];
  sampler.fn = null;
  vi.stubGlobal("OffscreenCanvas", FakeCanvas);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (blob: Blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const size = (mimeOf(bytes) === "image/png" ? pngSize(bytes) : null) ?? { width: 100, height: 100 };
      return { ...size, close: vi.fn() };
    }),
  );
}

/** A PNG-looking byte string with the given pixel size in its header. */
export function fakePng(width: number, height: number, length = 200): Uint8Array {
  const b = new Uint8Array(Math.max(length, 24));
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}
