import { expect, it } from "vitest";
import { atWidth, catalogRelative, cdnUrl } from "./urls";

const sha = "a".repeat(64);

it("finds the catalogue path behind a relative path, a CDN URL and a cached asset URL", () => {
  const rel = `img/${sha}-1080.webp`;
  expect(catalogRelative(rel)).toBe(rel);
  expect(catalogRelative(cdnUrl(rel))).toBe(rel);
  expect(catalogRelative(`http://asset.localhost/${encodeURIComponent(`/Users/me/Library/catalog-cache/img/${sha}-640.webp`)}`)).toBe(
    `img/${sha}-640.webp`,
  );
  expect(catalogRelative(`sheets/${sha}.webp?v=1`)).toBe(`sheets/${sha}.webp`);
  expect(catalogRelative("https://example.com/cat.png")).toBeNull();
});

it("changes the width of a picture but never a sheet", () => {
  expect(atWidth(`img/${sha}-1080.webp`, 640)).toBe(`img/${sha}-640.webp`);
  expect(atWidth(`sheets/${sha}.webp`, 640)).toBe(`sheets/${sha}.webp`);
});
