import { describe, expect, it } from "vitest";
import { pinnedFirst } from "./audience";
import { matchesSearch, squashText } from "./searchText";

describe("forgiving search", () => {
  it("ignores case, spaces, hyphens and accents when squashing", () => {
    expect(squashText("Big-Sur  Café")).toBe("bigsurcafe");
  });
  it("matches the start of words, every typed word", () => {
    expect(matchesSearch("Blue cotton T-shirt", "blue cott")).toBe(true);
    expect(matchesSearch("Blue cotton T-shirt", "blue silk")).toBe(false);
    expect(matchesSearch("anything", "")).toBe(true);
    expect(matchesSearch("anything", "   ")).toBe(true);
  });
  it("does not match the middle of a word, and short words must be whole", () => {
    expect(matchesSearch("Street style", "tree")).toBe(false);
    expect(matchesSearch("Women's wear", "men")).toBe(false);
    expect(matchesSearch("Mannequin", "man")).toBe(false);
    expect(matchesSearch("Earrings", "ring")).toBe(false);
    expect(matchesSearch("Tailored", "red")).toBe(false);
    expect(matchesSearch("Men's kurta", "men")).toBe(true);
    expect(matchesSearch("Shirts", "shirt")).toBe(true);
    expect(matchesSearch("Hat", "hats")).toBe(false);
    expect(matchesSearch("Hats", "hat")).toBe(true);
  });
  it("finds names typed run together, and a run typed with spaces", () => {
    expect(matchesSearch("Big Sur coast", "bigsur")).toBe(true);
    expect(matchesSearch("T-shirt", "tshirt")).toBe(true);
    expect(matchesSearch("Bigsur coast", "big sur")).toBe(true);
    expect(matchesSearch("Big Sur", "bigsu coast")).toBe(false);
  });
  it("punctuation alone finds nothing, accents are ignored", () => {
    expect(matchesSearch("100% cotton", "%")).toBe(false);
    expect(matchesSearch("Crème brûlée", "creme")).toBe(true);
  });
});

describe("pinned first", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  it("moves pinned items to the front in pin order and counts them", () => {
    expect(pinnedFirst(items, ["c", "a", "zzz"], (i) => i.id)).toEqual({
      items: [{ id: "c" }, { id: "a" }, { id: "b" }, { id: "d" }],
      pinned: 2,
    });
  });
  it("leaves the order alone with nothing pinned", () => {
    expect(pinnedFirst(items, [], (i) => i.id)).toEqual({ items, pinned: 0 });
    expect(pinnedFirst(items, undefined, (i) => i.id)).toEqual({ items, pinned: 0 });
  });
});
