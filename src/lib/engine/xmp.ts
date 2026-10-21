/**
 * Marks a saved photo as made with AI, the way Aaina marks its downloads: an XMP packet with the IPTC Digital Source Type
 * (Google Merchant Center asks for it on AI-made product images; Meta, TikTok and Pinterest read it) and, when the photo
 * shows an AI-made person, Amazon's "contains-synthetic-performer" keyword. A ghost mannequin or a flat-lay has no person.
 * Written straight into the file bytes (a JPEG APP1 segment, a PNG iTXt chunk); the picture itself is not touched.
 */

const XMP_JPEG_ID = "http://ns.adobe.com/xap/1.0/\0";
const XMP_PNG_KEYWORD = "XML:com.adobe.xmp";

export function aiImageXmp(person: boolean): string {
  const subject = person ? `\n   <dc:subject><rdf:Bag><rdf:li>contains-synthetic-performer</rdf:li></rdf:Bag></dc:subject>` : "";
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
    xmp:CreatorTool="Aaina Desktop (AI product photography)">${subject}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

const utf8 = (text: string) => new TextEncoder().encode(text);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A JPEG with the XMP packet as an APP1 segment, placed after the JFIF/EXIF segments that must come first. */
export function withJpegXmp(jpeg: Uint8Array, xmp: string): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("Not a JPEG");
  const payload = concat(utf8(XMP_JPEG_ID), utf8(xmp));
  const length = payload.length + 2;
  if (length > 0xffff) throw new Error("XMP packet too large for one JPEG segment");
  const segment = concat(new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff]), payload);
  // Skip SOI and any APP0 (JFIF) / APP1 (EXIF) segments, which readers expect first.
  let at = 2;
  while (jpeg[at] === 0xff && (jpeg[at + 1] === 0xe0 || jpeg[at + 1] === 0xe1)) at += 2 + ((jpeg[at + 2] << 8) | jpeg[at + 3]);
  return concat(jpeg.subarray(0, at), segment, jpeg.subarray(at));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG with the XMP packet as an uncompressed iTXt chunk right after IHDR. */
export function withPngXmp(png: Uint8Array, xmp: string): Uint8Array {
  if (!PNG_SIGNATURE.every((byte, i) => png[i] === byte)) throw new Error("Not a PNG");
  // keyword \0, compression flag 0, method 0, language "" \0, translated keyword "" \0, text
  const data = concat(utf8(XMP_PNG_KEYWORD), new Uint8Array([0, 0, 0, 0, 0]), utf8(xmp));
  const type = utf8("iTXt");
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(concat(type, data)));
  const ihdrEnd = 8 + 12 + new DataView(png.buffer, png.byteOffset).getUint32(8);
  return concat(png.subarray(0, ihdrEnd), chunk, png.subarray(ihdrEnd));
}

/** The photo's bytes marked as AI-made, in its own format. */
export function markAiMade(bytes: Uint8Array, format: "jpeg" | "png", person: boolean): Uint8Array {
  const xmp = aiImageXmp(person);
  return format === "jpeg" ? withJpegXmp(bytes, xmp) : withPngXmp(bytes, xmp);
}
