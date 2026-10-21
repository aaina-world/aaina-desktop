// Test helper: the `Sql` interface on top of Node's built-in SQLite, so repositories run against a real database.
// @ts-expect-error node:sqlite types are not installed (no @types/node in this project)
import { DatabaseSync } from "node:sqlite";
import type { Sql } from "./sql";

export function memoryDb(): Sql {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  // The plugin numbers parameters $1, $2 …; node:sqlite understands $name only, so rewrite to ?NNN.
  const fix = (query: string) => query.replace(/\$(\d+)/g, "?$1");
  return {
    async execute(query, params = []) {
      const result = db.prepare(fix(query)).run(...params);
      return { rowsAffected: Number(result.changes) };
    },
    async select<T>(query: string, params: unknown[] = []) {
      return db.prepare(fix(query)).all(...params) as T[];
    },
  };
}
