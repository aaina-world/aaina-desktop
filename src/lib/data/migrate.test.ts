import { describe, expect, it } from "vitest";
import { checkMigrations, migrate } from "./migrate";
import { MIGRATIONS } from "./migrations";
import { memoryDb } from "./sqlite.testkit";

describe("migrations", () => {
  it("are numbered 1, 2, 3 … without gaps", () => {
    expect(() => checkMigrations(MIGRATIONS)).not.toThrow();
    expect(() => checkMigrations([{ id: 2, name: "x", statements: ["select 1"] }])).toThrow();
    expect(() =>
      checkMigrations([
        { id: 1, name: "a", statements: ["select 1"] },
        { id: 1, name: "b", statements: ["select 1"] },
      ]),
    ).toThrow();
  });

  it("run once, in order, on a real database", async () => {
    const db = memoryDb();
    expect(await migrate(db)).toEqual(MIGRATIONS.map((m) => m.id));
    expect(await migrate(db)).toEqual([]);
    const tables = (await db.select<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`)).map((t) => t.name);
    for (const name of [
      "products",
      "product_photos",
      "shoots",
      "photos",
      "own_models",
      "own_poses",
      "own_scenes",
      "settings",
      "schema_migrations",
    ])
      expect(tables).toContain(name);
  });
});
