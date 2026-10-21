import { expect, it } from "vitest";
import { photoFileBase, safeName, uniqueName } from "./names";

it("makes names safe on every system", () => {
  expect(safeName("Men's kurta / blue: 2")).toBe("Men's kurta blue 2");
  expect(safeName("..hidden")).toBe("hidden");
  expect(safeName("   ")).toBe("Untitled");
  expect(safeName("con")).toBe("con_");
  expect(safeName("a".repeat(200)).length).toBe(80);
});

it("names photos Title-vN and never overwrites", () => {
  expect(photoFileBase("Front view", 2)).toBe("Front view-v2");
  const taken = new Set(["Front view-v2.png", "Front view-v2 (2).png"]);
  expect(uniqueName("Front view-v2", "png", (name) => taken.has(name))).toBe("Front view-v2 (3).png");
  expect(uniqueName("Other-v1", "png", (name) => taken.has(name))).toBe("Other-v1.png");
});
