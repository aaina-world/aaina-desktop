import { beforeEach, describe, expect, it } from "vitest";
import { canvases, drawn, fakePng, installCanvas, sampler } from "../../test/fakeCanvas";
import { prepareInput, readingSample, renderForSave, UPLOAD_MAX_BYTES } from "./images";

beforeEach(() => installCanvas());

describe("prepareInput", () => {
  it("draws a small picture again at its own size, so nothing hidden in the file (location, camera) is sent", async () => {
    const png = fakePng(800, 600);
    const out = await prepareInput(png);
    expect(out).toMatchObject({ mime: "image/png", width: 800, height: 600 });
    expect(out.bytes).not.toBe(png);
    expect(canvases[0]).toMatchObject({ width: 800, height: 600 });
  });
  it("scales a big picture down to 1536 on the longest side and sends a JPEG", async () => {
    const out = await prepareInput(fakePng(4000, 3000));
    expect(out).toMatchObject({ mime: "image/jpeg", width: 1536, height: 1152 });
    expect(canvases[0]).toMatchObject({ width: 1536, height: 1152 });
  });
  it("re-encodes a small but heavy picture", async () => {
    const out = await prepareInput(fakePng(800, 600, UPLOAD_MAX_BYTES + 1));
    expect(out.mime).toBe("image/jpeg");
  });
  it("refuses a file that is not a picture, in plain words", async () => {
    await expect(prepareInput(new Uint8Array([1, 2, 3, 4, 5, 6]))).rejects.toThrow(/not a picture/);
  });
});

describe("readingSample", () => {
  it("makes a small JPEG with a white backing", async () => {
    const out = await readingSample(fakePng(3000, 2000), 1024);
    expect(out).toMatchObject({ mime: "image/jpeg", width: 1024, height: 683 });
    expect(drawn[0].args[0]).toBe("fillRect");
  });
});

describe("renderForSave", () => {
  it("returns the original bytes untouched for original + PNG", async () => {
    const png = fakePng(1536, 1536);
    expect(await renderForSave(png, "original", "png")).toBe(png);
  });
  it("crops a square photo to a 4:5 window and encodes JPEG", async () => {
    const out = await renderForSave(fakePng(1536, 1536), "portrait-4x5", "jpeg");
    expect(out[0]).toBe(0xff);
    const crop = canvases.find((c) => c.width === Math.round(1536 * 0.8));
    expect(crop).toBeTruthy();
    expect(crop!.height).toBe(1536);
  });
  it("continues a plain wall to make a wider shape", async () => {
    await renderForSave(fakePng(1000, 1500), "square", "png");
    const wide = canvases.find((c) => c.width === 1500 && c.height === 1500);
    expect(wide).toBeTruthy();
    expect(drawn.some((d) => d.args[0] === "drawImage")).toBe(true);
  });
  it("keeps the photo's own shape on a busy scene instead of blurring a band", async () => {
    sampler.fn = (x, y) => ((x + y) % 2 ? [20, 90, 30, 255] : [200, 180, 40, 255]);
    await renderForSave(fakePng(1000, 1500), "square", "png");
    expect(canvases.some((c) => c.width === 1500 && c.height === 1500)).toBe(false);
    expect(canvases.some((c) => c.width === 1000 && c.height === 1500)).toBe(true);
  });
  it("lifts a grey wall to white for the white square", async () => {
    sampler.colour = [200, 200, 200, 255];
    await renderForSave(fakePng(1536, 1536), "white-square", "png");
    expect(drawn.some((d) => d.args[0] === "putImageData")).toBe(true);
  });
  it("leaves a scene alone for the white square", async () => {
    sampler.fn = (x, y) => ((x + y) % 2 ? [20, 90, 30, 255] : [200, 180, 40, 255]);
    await renderForSave(fakePng(1536, 1536), "white-square", "png");
    expect(drawn.some((d) => d.args[0] === "putImageData")).toBe(false);
  });
});
