import Database from "@tauri-apps/plugin-sql";
import { migrate } from "./migrate";
import type { Sql } from "./sql";

export const DB_URL = "sqlite:aaina.db";

/** Opens the app's SQLite file (created on first run), turns on WAL and foreign keys, and brings the schema up to date. */
export async function openDb(): Promise<Database & Sql> {
  const db = await Database.load(DB_URL);
  // WAL is stored in the file. Foreign keys are on by default in the plugin's SQLite driver; asking again is harmless
  // (the pool may hand this to one connection only).
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");
  await migrate(db);
  return db;
}
