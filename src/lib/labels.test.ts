import { expect, it } from "vitest";
import { framingName } from "./labels";

it("names every framing tag the catalogue uses in plain words", () => {
  const cases: Record<string, string | null> = {
    "head-feet": "Full length",
    full_length: "Full length",
    head_to_shoes: "Full length",
    "shoulders-feet": "Full length",
    "chest-feet": "Full length",
    "head-knees": "Head to knee",
    head_to_knee: "Head to knee",
    "chin-knees": "Head to knee",
    "shoulders-knees": "Head to knee",
    "chest-knees": "Head to knee",
    "head-hips": "Waist up",
    "head-waist": "Waist up",
    head_to_hip: "Waist up",
    shoulders_to_hip: "Waist up",
    "chin-waist": "Waist up",
    waist_up: "Waist up",
    "head-chest": "Close-up",
    head_to_chest: "Close-up",
    head_shoulders: "Close-up",
    head_neck: "Close-up",
    lower_face_to_chest: "Close-up",
    ear_half_face: "Close-up",
    "hips-feet": "Lower body",
    "knees-feet": "Lower body",
    calves_to_shoes: "Lower body",
    waist_to_knee: "Lower body",
    "waist-knees": "Lower body",
    hand_close: "Detail",
    wrist_close: "Detail",
    waist_close: "Detail",
    hands_torso: "Detail",
    "chest-hips": "Detail",
    "chest-waist": "Detail",
    "": null,
    "something-new": null,
  };
  for (const [tag, name] of Object.entries(cases)) expect([tag, framingName(tag)]).toEqual([tag, name]);
  expect(framingName(null)).toBeNull();
});
