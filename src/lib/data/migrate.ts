import { MIGRATIONS, type Migration } from "./migrations";
import { now, type Sql } from "./sql";

/** Ids must be 1, 2, 3 … in order, with no gaps or repeats. Throws if the list is malformed. */
export function checkMigrations(list: Migration[]): void {
  list.forEach((migration, index) => {
    if (migration.id !== index + 1) throw new Error(`Migration ${migration.name} has id ${migration.id}, expected ${index + 1}`);
    if (!migration.statements.length) throw new Error(`Migration ${migration.id} is empty`);
  });
}

/** Runs every migration not yet recorded, in order. Returns the ids it applied. */
export async function migrate(db: Sql, list: Migration[] = MIGRATIONS): Promise<number[]> {
  checkMigrations(list);
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);
  const done = new Set((await db.select<{ id: number }>(`SELECT id FROM schema_migrations`)).map((row) => row.id));
  const applied: number[] = [];
  for (const migration of list) {
    if (done.has(migration.id)) continue;
    for (const statement of migration.statements) await db.execute(statement);
    await db.execute(`INSERT INTO schema_migrations (id, name, applied_at) VALUES ($1, $2, $3)`, [migration.id, migration.name, now()]);
    applied.push(migration.id);
  }
  return applied;
}
