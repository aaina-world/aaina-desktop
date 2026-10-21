// Owner, 2026-10-08: with Age "Adults" and Body "Slim" (and an everyday pink top) the picker put Ama (45, grey hair), Valeria (39),
// Elena (48), Anjali (38), Aiyana (38) and Giulia (42) among the first twenty, because every adult woman sat in one tier and the
// tie-break was the roster's order, which lists each look's oldest model first. "Most of the time people want supermodels; only in
// specific cases mature, plus size etc."
import { expect, it } from "vitest";
import { modelAgeBand, orderModelSuggestions, type ModelLike } from "./suggest";
import type { ProductAudience } from "./audience";

const suits = { blouses: [12, 4], midi_dresses: [12, 4], maxi_dresses: [10, 2], sarees: [10, 0], formal_shirts: [0, 0] } as Record<
  string,
  [number, number]
>;
const woman = (id: string, look: string, age: number, extra: Partial<ModelLike> = {}): ModelLike => ({
  id,
  name: id,
  gender: "woman",
  ageGroup: age >= 50 ? "mature" : "adult",
  age,
  look: look as never,
  body: "slim",
  tags: [],
  sharedPoses: true,
  suits,
  ...extra,
});
const own = (id: string, look: string, age: number, extra: Partial<ModelLike> = {}) =>
  woman(id, look, age, { sharedPoses: undefined, ...extra });
const star = { tags: ["supermodel" as const] };
// In the live roster's order: own-pose models first, then the pooled ones, each look from the oldest down.
const models: ModelLike[] = [
  own("aaina", "south_asian", 26),
  own("tara", "south_asian", 25, star),
  own("camille", "white", 22, star),
  own("nia", "black", 25, star),
  own("meera", "south_asian", 25),
  own("jiwoo", "east_asian", 25),
  own("maya", "southeast_asian", 28),
  own("freya", "white", 22),
  own("sunita", "south_asian", 55, { body: "average" }),
  own("margaret", "white", 65),
  own("kavya", "south_asian", 35, { body: "plus" }),
  own("layla", "middle_eastern", 28, { tags: ["modest"] }),
  own("nisha", "south_asian", 30, { body: "average", tags: ["maternity"] }),
  woman("hana", "east_asian", 55),
  woman("yuki", "east_asian", 32),
  woman("seo-yeon", "east_asian", 25),
  woman("xiao", "east_asian", 20),
  woman("ligaya", "southeast_asian", 20),
  woman("linh", "southeast_asian", 22),
  woman("ruth", "black", 70),
  woman("ama", "black", 52),
  woman("imara", "black", 32),
  woman("zuri", "black", 25),
  woman("tasha", "black", 28, { body: "plus" }),
  woman("valeria", "latin", 39),
  woman("camila", "latin", 32),
  woman("alejandra", "latin", 25, star),
  woman("ines", "latin", 20),
  woman("elena", "white", 48),
  woman("giulia", "white", 42),
  woman("scarlett", "white", 24, star),
  woman("eva", "white", 28, star),
  woman("karen", "white", 42, { body: "average" }),
  woman("anjali", "south_asian", 38),
  woman("kiran", "south_asian", 35),
  woman("simran", "south_asian", 24, star),
  woman("naina", "south_asian", 25),
  woman("yasmin", "middle_eastern", 28),
  woman("rania", "middle_eastern", 25, star),
  woman("winona", "indigenous", 70),
  woman("aiyana", "indigenous", 38),
  woman("jade", "mixed", 28),
  woman("anu", "south_asian", 29, { body: "average", tags: ["maternity"] }),
  {
    id: "marco",
    name: "marco",
    gender: "man",
    ageGroup: "adult",
    age: 28,
    look: "white",
    body: "athletic",
    tags: ["supermodel"],
    suits: { formal_shirts: [20, 0] },
  },
  { id: "pari", name: "pari", gender: "girl", ageGroup: "kids", age: 7, look: "south_asian", minor: true, tags: [], suits },
];
const byId = new Map(models.map((model) => [model.id, model]));
const none: ProductAudience = { for: null, ages: [], regions: [], sizes: [], modest: false, adaptive: false };
const pinkTop = { targets: ["blouses"], wearerText: "Pink top", audience: { ...none, for: "women" as const } };
const ids = (input: Parameters<typeof orderModelSuggestions>[0]) => orderModelSuggestions(input).visible.map((model) => model.id);
const ageOf = (id: string) => byId.get(id)!.age!;
const supermodels = models.filter((model) => model.gender === "woman" && model.tags?.includes("supermodel")).map((model) => model.id);
/** The last place a catalogue-age (18 to 34) model of the list holds, and the first place an older one does. */
const split = (order: string[]) => ({
  lastYoung: Math.max(
    ...order.map((id, i) =>
      ageOf(id) <= 34 &&
      byId.get(id)!.gender === "woman" &&
      !byId.get(id)!.tags?.some((t) => t !== "supermodel") &&
      byId.get(id)!.body !== "plus"
        ? i
        : -1,
    ),
  ),
  firstOlder: order.findIndex((id) => ageOf(id) >= 35),
});

it("the owner's case: Adults + Slim (with or without the pink top) puts every young slim adult before any 35 to 49-year-old, supermodels first", () => {
  for (const input of [{ targets: [] }, pinkTop]) {
    const order = ids({ models, ...input, filters: { ageGroup: "adult", body: "slim" } });
    expect(order.every((id) => byId.get(id)!.ageGroup === "adult" && byId.get(id)!.body === "slim")).toBe(true);
    expect(order.slice(0, supermodels.length).sort()).toEqual([...supermodels].sort());
    const { lastYoung, firstOlder } = split(order);
    expect(lastYoung).toBeLessThan(firstOlder);
    for (const id of ["valeria", "elena", "anjali", "aiyana", "giulia", "kiran"]) expect(order.indexOf(id)).toBeGreaterThan(lastYoung);
  }
});

it("an everyday top leads with supermodels of every look, then young models; mature, older and specific lines follow", () => {
  const order = orderModelSuggestions({ models, ...pinkTop });
  const lead = order.visible.slice(0, order.lead).map((model) => model.id);
  expect(lead.slice(0, supermodels.length).sort()).toEqual([...supermodels].sort());
  // Variety: the first six supermodels are of at least five looks.
  expect(new Set(lead.slice(0, 6).map((id) => byId.get(id)!.look)).size).toBeGreaterThanOrEqual(5);
  const top16 = lead.slice(0, 16);
  for (const id of top16) {
    const model = byId.get(id)!;
    expect(model.age!).toBeLessThanOrEqual(34);
    expect(model.body).not.toBe("plus");
    expect(model.tags?.includes("maternity") || model.tags?.includes("modest")).toBeFalsy();
  }
  expect(lead).not.toContain("nisha"); // maternity models are not suggested for everyday wear
});

it("no product and no filter: young adults first, then everyone else; children last", () => {
  const order = ids({ models, targets: [] });
  expect(order.slice(0, 4).every((id) => byId.get(id)!.tags?.includes("supermodel"))).toBe(true);
  expect(order[order.length - 1]).toBe("pari");
  expect(order.indexOf("margaret")).toBeGreaterThan(order.indexOf("naina"));
});

it("specific asks are unchanged: mature, plus size, maternity and a saree lead with their own models", () => {
  const mature = orderModelSuggestions({ models, targets: ["maxi_dresses"], wearerText: "Mother of the bride maxi dress" });
  const matureLead = mature.visible.slice(0, 5).map((model) => model.id);
  expect(matureLead.every((id) => ageOf(id) >= 50)).toBe(true);

  const plus = ids({ models, targets: ["midi_dresses"], wearerText: "Plus size midi dress" });
  expect(plus.slice(0, 2).sort()).toEqual(["kavya", "tasha"]);
  expect(plus.indexOf("tasha")).toBeLessThan(plus.indexOf("kavya")); // 28 before 35, both plus size

  const maternity = ids({ models, targets: ["midi_dresses"], wearerText: "Maternity dress" });
  expect(maternity.slice(0, 2).sort()).toEqual(["anu", "nisha"]);

  const saree = ids({ models, targets: ["sarees"], wearerText: "Silk saree" });
  expect(saree.slice(0, 2).sort()).toEqual(["simran", "tara"]);
  // Every young South Asian model comes before any supermodel of another look; older South Asian models still lead those.
  const southAsianYoung = ["aaina", "meera", "naina"].map((id) => saree.indexOf(id));
  expect(Math.max(...southAsianYoung)).toBeLessThan(saree.indexOf("camille"));
  expect(saree.indexOf("anjali")).toBeLessThan(saree.indexOf("camille"));
});

it("a men's shirt leads with men", () => {
  expect(ids({ models, targets: ["formal_shirts"], wearerText: "Men's formal shirt" })[0]).toBe("marco");
});

it("age bands: the stored age when known, else the age group", () => {
  expect(modelAgeBand({ id: "a", name: "a", ageGroup: "adult", age: 34 })).toBe("prime");
  expect(modelAgeBand({ id: "a", name: "a", ageGroup: "adult", age: 35 })).toBe("older");
  expect(modelAgeBand({ id: "a", name: "a", ageGroup: "adult", age: 52 })).toBe("mature");
  expect(modelAgeBand({ id: "a", name: "a", ageGroup: "mature" })).toBe("mature");
  expect(modelAgeBand({ id: "a", name: "a", ageGroup: "adult" })).toBe("prime");
  expect(modelAgeBand({ id: "a", name: "a", gender: "girl", ageGroup: "teen", age: 15 })).toBe("child");
  expect(modelAgeBand({ id: "a", name: "a" })).toBeNull();
});
