// Ported from Aaina (packages/contracts/test/modelAudience.test.ts), the cases that need only the ranking.
import { expect, it } from "vitest";
import type { ProductAudience } from "./audience";
import { orderModelSuggestions, type ModelLike } from "./suggest";

const poses = (types: string[]) => Object.fromEntries(types.map((type) => [type, [12, 0] as [number, number]]));
const everyday = ["midi_dresses", "crewneck_tshirts", "sarees", "hanbok", "abayas", "frocks", "straight_trousers", "agbada"];
const woman = (id: string, look: string, extra: Partial<ModelLike> = {}): ModelLike => ({
  id,
  name: id,
  gender: "woman",
  ageGroup: "adult",
  look: look as never,
  body: "slim",
  tags: [],
  suits: poses(everyday),
  ...extra,
});
const models: ModelLike[] = [
  woman("camille", "white"),
  woman("nia", "black"),
  woman("mei", "east_asian"),
  woman("tara", "south_asian"),
  woman("layla", "middle_eastern", { tags: ["modest"] }),
  woman("sofia", "latin"),
  woman("shanice", "black", { body: "plus" }),
  woman("margaret", "white", { ageGroup: "mature" }),
  { id: "omar", name: "omar", gender: "man", ageGroup: "adult", look: "black", body: "athletic", tags: [], suits: poses(everyday) },
  {
    id: "dev",
    name: "dev",
    gender: "man",
    ageGroup: "adult",
    look: "south_asian",
    body: "average",
    tags: ["adaptive"],
    suits: poses(everyday),
  },
  { id: "pari", name: "pari", gender: "girl", ageGroup: "kids", look: "south_asian", minor: true, tags: [], suits: poses(everyday) },
];
const none: ProductAudience = { for: null, ages: [], regions: [], sizes: [], modest: false, adaptive: false };
const top = (input: Parameters<typeof orderModelSuggestions>[0]) => {
  const order = orderModelSuggestions(input);
  return order.visible.slice(order.pinned, order.pinned + order.lead).map((model) => model.id);
};

it("a saree leads with South Asian models; a hanbok with East Asian; an abaya with Middle Eastern; an agbada with Black models", () => {
  expect(top({ models, targets: ["sarees"] })[0]).toBe("tara");
  expect(top({ models, targets: ["hanbok"], audience: { ...none, for: "women", regions: ["east_asia"] } })[0]).toBe("mei");
  expect(top({ models, targets: ["abayas"] })[0]).toBe("layla");
  expect(top({ models, targets: ["agbada"] })[0]).toBe("omar");
});

it("a plus-size dress leads with plus-size models, from the photo check or the seller's words in any form", () => {
  expect(top({ models, targets: ["midi_dresses"], audience: { ...none, for: "women", sizes: ["plus"] } })[0]).toBe("shanice");
  expect(top({ models, targets: ["midi_dresses"], wearerText: "Plus size wrap dress" })[0]).toBe("shanice");
});

it("mother-of-the-bride wear leads with mature models; adaptive trousers with adaptive models", () => {
  expect(top({ models, targets: ["midi_dresses"], wearerText: "Mother of the bride dress" })[0]).toBe("margaret");
  expect(top({ models, targets: ["straight_trousers"], audience: { ...none, for: "men", adaptive: true } })[0]).toBe("dev");
});

it("baby wear leads with babies (who have no studio poses of their own); other kidswear and adult wear never suggest a baby", () => {
  const baby: ModelLike = {
    id: "amaka",
    name: "amaka",
    gender: "girl",
    ageGroup: "baby",
    look: "black",
    minor: true,
    body: "average",
    tags: [],
    suits: {},
  };
  const withBaby = [...models, baby];
  expect(top({ models: withBaby, targets: ["jumpsuits"], wearerText: "Baby girl romper 6-12 months" })[0]).toBe("amaka");
  expect(top({ models: withBaby, targets: ["frocks"], audience: { ...none, for: "kids", ages: ["baby"] } })[0]).toBe("amaka");
  expect(top({ models: withBaby, targets: ["frocks"], wearerText: "Girls cotton frock" })).not.toContain("amaka");
  expect(top({ models: withBaby, targets: ["midi_dresses"] })).not.toContain("amaka");
  // A baby bodysuit is baby wear, not an adult bodysuit; "baby pink" is a colour.
  expect(top({ models: withBaby, targets: ["bodysuits"], wearerText: "Baby bodysuit" })[0]).toBe("amaka");
  expect(top({ models: withBaby, targets: ["midi_dresses"], wearerText: "Baby pink midi dress" })).not.toContain("amaka");
});

it("kidswear only suggests children, and the model last used for this kind of product leads", () => {
  expect(top({ models, targets: ["frocks"] })).toEqual(["pari"]);
  expect(top({ models, targets: ["midi_dresses"], wearerText: "Women's dress", lastUsed: "sofia" })[0]).toBe("sofia");
});
