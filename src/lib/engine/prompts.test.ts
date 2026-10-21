import { describe, expect, it } from "vitest";
import {
  EXPRESSION_WORDING,
  FRAME_WORDING,
  SHEET_IDENTITY_SENTENCE,
  backgroundEditPrompt,
  colourEditPrompt,
  colourSceneText,
  fixEditPrompt,
  flatLayPrompt,
  ghostPrompt,
  modelFacePrompt,
  modelPhotoPrompt,
  modelSheetFromPicturesPrompt,
  readingFromAnswer,
  readingPrompt,
  scenePrompt,
  sheetCheckPasses,
  sheetPosePrompt,
  squareFraming,
  traitsSentence,
} from "./prompts";

const base = {
  modelName: "Meera",
  identity: { count: 1, sheet: true },
  hasPoseImage: true,
  scene: { kind: "image" as const },
  products: ["front" as const, "back" as const],
};

describe("model photo prompt", () => {
  it("names the sheet, the pose picture, the scene picture and the product in order", () => {
    const p = modelPhotoPrompt({ ...base, poseText: "hand on hip, weight on left leg", productType: "T-shirt" });
    expect(p).toContain(SHEET_IDENTITY_SENTENCE("Meera"));
    expect(p).toContain("Image 2 shows the pose and framing to copy");
    expect(p).toContain("Image 3 is the empty scene");
    expect(p).toContain("Images 4–5 show the outfit (front, back)");
    expect(p).toContain("Pose direction: hand on hip, weight on left leg.");
    expect(p).toContain("Square 1:1 photograph");
    expect(p).toContain("middle 60% of the width");
  });
  it("uses a chosen frame instead of the pose's framing and a chosen expression", () => {
    const p = modelPhotoPrompt({ ...base, frame: "waist_up", expression: "soft_smile", poseText: "standing" });
    expect(p).toContain(FRAME_WORDING.waist_up);
    expect(p).toContain("Image 2 shows the pose to copy (body position, arms, hands and head turn), not the framing");
    expect(p).toContain(EXPRESSION_WORDING.soft_smile);
    expect(p).not.toContain(FRAME_WORDING.full_length);
  });
  it("shrinks wide poses and says how to make a missing back", () => {
    expect(squareFraming({ text: "sitting on a stool" })).toContain("wide pose");
    const p = modelPhotoPrompt({ ...base, products: ["front"], poseAngle: "back" });
    expect(p).toContain("There is no back photo");
  });
  it("puts the Make again note last as 'Also:' and styles accessories as a whole look", () => {
    const p = modelPhotoPrompt({ ...base, productType: "handbag", note: "longer hair" });
    expect(p).toContain("Place this product on Meera naturally.");
    expect(p.endsWith("Also: longer hair.")).toBe(true);
  });
  it("describes a colour scene as words, with no scene picture", () => {
    const p = modelPhotoPrompt({ ...base, scene: { kind: "words", text: colourSceneText("Navy", "#1F2A4D") } });
    expect(p).toContain("Scene: A seamless studio paper backdrop in navy (hex #1f2a4d, RGB 31, 42, 77)");
    expect(p).not.toContain("is the empty scene");
  });
  it("works for an older model with several photos and a written pose with no pose picture", () => {
    const p = modelPhotoPrompt({
      ...base,
      identity: { count: 3, sheet: false },
      hasPoseImage: false,
      scene: { kind: "none" },
      poseText: "walking",
    });
    expect(p).toContain("Images 1–3 are photos of the model Meera");
    expect(p).toContain("Images 4–5 show");
  });
});

describe("flat-lay and ghost prompts", () => {
  it("flat-lay keeps the product exact and the back view face down", () => {
    const p = flatLayPrompt({ item: "Linen shirt", section: "clothing", style: "clean", side: "back", sources: ["front", "back"] });
    expect(p).toContain("shot from directly above");
    expect(p).toContain("face down with its back facing up");
    expect(p).toContain("Seamless pure white (#FFFFFF) surface");
    expect(p).toContain("the linen shirt");
  });
  it("folded flat-lay folds jeans in thirds and styled adds props", () => {
    expect(flatLayPrompt({ item: "jeans", section: "clothing", style: "folded", side: "front", sources: ["front"] })).toContain(
      "folded over in thirds",
    );
    expect(flatLayPrompt({ item: "scarf", section: "accessories", style: "styled", side: "front", sources: ["front"] })).toContain(
      "unbranded props",
    );
  });
  it("ghost names the view, uses the front photo for other angles and never invents labels", () => {
    const p = ghostPrompt({ item: "kurta", angle: "side", sources: ["front", "back"], frontReference: true });
    expect(p).toContain("Image 1 is an approved ghost-mannequin photo");
    expect(p).toContain("Images 2–3 show the garment");
    expect(p).toContain("true side profile");
    expect(p).toContain("do not add labels, tags or logos");
    expect(ghostPrompt({ item: "kurta", angle: "back", sources: ["front"], frontReference: false })).toContain("There is no back photo");
  });
});

describe("edit prompts", () => {
  it("colour keeps everything else the same, with the exact code", () => {
    const p = colourEditPrompt("model", "dress", "Sage #9caf88");
    expect(p).toContain("Change only the colour of the dress to Sage #9caf88.");
    expect(p).toContain("the same person with the same face");
  });
  it("fix says change nothing else; flat-lay keeps the top-down view", () => {
    expect(fixEditPrompt("model", "dress", "remove the necklace.")).toContain("Edit this photo: remove the necklace. Change nothing else.");
    expect(fixEditPrompt("flat-lay", "dress", "x")).toContain("the same top-down view");
  });
  it("background edit asks for pure white", () => {
    expect(backgroundEditPrompt("model", "dress", "white")).toContain("#FFFFFF");
  });
});

describe("own models, poses and scenes", () => {
  const traits = { gender: "woman" as const, age: 29, look: "south_asian", body: "curvy", hair: "long black wavy" };
  it("describes the person in Aaina's words", () => {
    expect(traitsSentence(traits)).toBe(
      "a professional fashion model, a woman aged 29, South Asian appearance, long black wavy hair, a curvy build.",
    );
    expect(modelFacePrompt(traits)).toContain("never copy or resemble a real or famous person");
  });
  it("makes the sheet from a face or photos without beautifying", () => {
    const p = modelSheetFromPicturesPrompt({ gender: "man", age: 40 }, 3);
    expect(p).toContain("Do not beautify, retouch");
    expect(p).toContain("Create ONE square image, 1024 × 1024 pixels");
    expect(p).toContain("The person is an adult man (age 40).");
  });
  it("sheet check passes on faults only", () => {
    const ok = {
      panels: 6,
      onePersonEach: true,
      samePerson: true,
      extraLimbsOrHands: false,
      textOrLogos: false,
      appearsUnder18: false,
      faults: [],
    };
    expect(sheetCheckPasses(ok)).toBe(true);
    expect(sheetCheckPasses({ ...ok, panels: 4 })).toBe(false);
    expect(sheetCheckPasses({ ...ok, appearsUnder18: true })).toBe(false);
  });
  it("pose and scene prompts", () => {
    const p = sheetPosePrompt({ gender: "woman", pose: "sitting on a stool, laughing" });
    expect(p).toContain("keep exactly the same face, hair, skin tone and body");
    expect(p).toContain("Pose: sitting on a stool, laughing.");
    expect(scenePrompt("a sunny courtyard", false)).toContain("A photograph of a deserted, unoccupied place: a sunny courtyard.");
    expect(scenePrompt("A place like the one in my photo", true)).toContain("Image 1 is the customer's reference photo");
  });
});

describe("reading", () => {
  it("lists product types and cleans the answer", () => {
    expect(readingPrompt(["kurtas", "sarees"], [["kurtas", "Kurtas"]])).toContain("kurtas (Kurtas), sarees");
    const r = readingFromAnswer(
      { label: "Cotton kurta", productType: "kurtas", audience: "women", colour: "blue", material: null, details: "", reach: "upper" },
      ["kurtas"],
      "key",
    );
    expect(r).toMatchObject({ label: "Cotton kurta", productType: "kurtas", audience: "women", reach: "upper", readBy: "key" });
    expect(readingFromAnswer({ label: "x", productType: "bogus", audience: "robots", reach: "x" }, ["kurtas"], "key")).toMatchObject({
      productType: null,
      audience: null,
      reach: null,
    });
    expect(readingFromAnswer({}, null, "key")).toBeNull();
  });
  it("starts the product's name and fabric with a capital, whoever read it; colours stay as said", () => {
    const r = readingFromAnswer({ label: "jacket", colour: "olive brown", material: "matte, sturdy woven fabric" }, null, "chatgpt");
    expect(r).toMatchObject({ label: "Jacket", colour: "olive brown", material: "Matte, sturdy woven fabric" });
  });
});
