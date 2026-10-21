import { expect, it } from "vitest";
import posesAaina from "./fixtures/poses-aaina.json";
import posesHana from "./fixtures/poses-hana.json";
import models from "./fixtures/models.json";
import scenes from "./fixtures/scenes.json";
import sheets from "./fixtures/sheets.json";
import { mapModels, mapPoses, mapScenes } from "./map";
import type { RawModels, RawPoses, RawScenes } from "./raw";

// Real CDN files (2026-10-21) trimmed to a few items.
const show = (relative: string) => `shown:${relative}`;
const sheetMap = new Map(sheets.items.map((item) => [item.modelId, item]));

it("maps an own-pose model with its suits, and a pooled model with the suits of its pool", () => {
  const [aaina, hana] = mapModels(models as unknown as RawModels, sheetMap, show);
  expect(aaina).toMatchObject({ id: "aaina", name: "Aaina", gender: "woman", ageGroup: "adult", age: 26, poolKey: null, minor: false });
  expect(aaina.suits!["crewneck_tshirts"]).toEqual([83, 297]);
  expect(hana).toMatchObject({ id: "hana", ageGroup: "mature", look: "east_asian" });
  expect(hana.poolKey).toBe("044f3d84140a9c40");
  expect(Object.keys(hana.suits!).length).toBeGreaterThan(0);
});

it("points sheetUrl at the published sheet and shows a face, not the six-photo sheet, as a sheet model's card", () => {
  const [aaina, hana] = mapModels(models as unknown as RawModels, sheetMap, show);
  expect(aaina.sheetUrl).toMatch(/^shown:sheets\/[0-9a-f]{64}\.webp$/);
  expect(hana.cardUrl).toBe(`shown:${(models as unknown as RawModels).items[1].faceImageUrl}`);
  expect(aaina.photoUrls.length).toBe(3); // an older model: its reference photos
});

it("falls back to the model's own sheet photo when no sheets are published yet", () => {
  const [, hana] = mapModels(models as unknown as RawModels, new Map(), show);
  expect(hana.sheetUrl).toMatch(/^shown:img\//);
});

it("maps the bank and studio poses; a pooled pose says which model it is shown on", () => {
  const bank = mapPoses((posesAaina as unknown as RawPoses).looks, (posesAaina as unknown as RawPoses).studio, "aaina", show);
  expect(bank[0]).toMatchObject({
    id: "clothing__crewneck_tshirts__front_catalogue",
    name: "Front view",
    modelId: "aaina",
    shownOn: null,
    framing: "full_length",
  });
  const studio = bank.find((pose) => pose.id.startsWith("community:"))!;
  expect(studio).toMatchObject({ best: ["hoodies", "shorts", "sneakers", "bucket_hats"], framing: "head-feet" });
  expect(studio.style).toEqual(["streetwear", "casual"]);
  const pooled = mapPoses(
    (posesHana as unknown as RawPoses).looks,
    (posesHana as unknown as RawPoses).studio,
    "pool:044f3d84140a9c40",
    show,
  );
  expect(pooled[0].shownOn).toEqual({ modelId: "zara", name: "Zara" });
  expect(pooled[0].modelId).toBe("zara");
});

it("maps scenes: anywhere becomes no region, plain studios are flagged", () => {
  const mapped = mapScenes((scenes as unknown as RawScenes).items, show);
  expect(mapped[0]).toMatchObject({ id: "loc_pose_bank_white_room", name: "White Studio", region: null, plain: true });
  expect(mapped.length).toBe(3);
});
