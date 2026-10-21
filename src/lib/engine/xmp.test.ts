import { describe, expect, it } from "vitest";
import { aiImageXmp, crc32, markAiMade, withJpegXmp, withPngXmp } from "./xmp";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const u32 = (bytes: Uint8Array, at: number) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(at);

// The smallest files the marker has to understand: SOI + JFIF APP0 + EOI, and a PNG signature + IHDR + IEND.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xd9]);
function png(): Uint8Array {
  const ihdr = [0, 0, 0, 13, ...[0x49, 0x48, 0x44, 0x52], ...new Array(13).fill(1), 0, 0, 0, 0];
  const iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, ...iend]);
}

describe("AI-made marking", () => {
  it("says the photo was made by a trained model, and names a synthetic person only when there is one", () => {
    expect(aiImageXmp(true)).toContain("digitalsourcetype/trainedAlgorithmicMedia");
    expect(aiImageXmp(true)).toContain("contains-synthetic-performer");
    expect(aiImageXmp(false)).not.toContain("contains-synthetic-performer");
  });

  it("adds the packet to a JPEG as an APP1 segment after JFIF, leaving the rest of the file as it was", () => {
    const marked = withJpegXmp(JPEG, "<x/>");
    expect([...marked.subarray(0, 8)]).toEqual([...JPEG.subarray(0, 8)]);
    expect([marked[8], marked[9]]).toEqual([0xff, 0xe1]);
    const length = (marked[10] << 8) | marked[11];
    expect(text(marked.subarray(12, 10 + length))).toBe("http://ns.adobe.com/xap/1.0/\0<x/>");
    expect([...marked.subarray(10 + length)]).toEqual([0xff, 0xd9]);
  });

  it("adds the packet to a PNG as an iTXt chunk after IHDR with a correct checksum", () => {
    const source = png();
    const marked = withPngXmp(source, "<x/>");
    const at = 8 + 25; // signature + IHDR
    const length = u32(marked, at);
    expect(text(marked.subarray(at + 4, at + 8))).toBe("iTXt");
    const data = marked.subarray(at + 8, at + 8 + length);
    expect(text(data)).toBe("XML:com.adobe.xmp\0\0\0\0\0<x/>");
    expect(u32(marked, at + 8 + length)).toBe(crc32(marked.subarray(at + 4, at + 8 + length)));
    expect([...marked.subarray(at + 12 + length)]).toEqual([...source.subarray(at)]);
  });

  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    // The IEND chunk's well-known checksum.
    expect(crc32(new TextEncoder().encode("IEND"))).toBe(0xae426082);
  });

  it("refuses bytes that are not the format it was told", () => {
    expect(() => markAiMade(png(), "jpeg", true)).toThrow("Not a JPEG");
    expect(() => markAiMade(JPEG, "png", true)).toThrow("Not a PNG");
  });
});
