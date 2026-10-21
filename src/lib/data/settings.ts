import type { Settings } from "../contract";
import { fromJson, toJson, type Sql } from "./sql";

export const defaultSettings = (photosFolder: string, saveFolder: string): Settings => ({
  onboarded: false,
  photosFolder,
  saveFolder,
  quality: "standard",
  parallel: 2,
  saveFormat: "jpeg",
  theme: "system",
  notifyWhenReady: true,
  offlineCatalogue: false,
  autoUpdate: true,
  pins: { models: [], poses: [], scenes: [] },
});

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;

/** Settings live as key / JSON-value rows; anything missing falls back to its default. */
export function createSettingsRepo(db: Sql, defaults: Settings) {
  async function get(): Promise<Settings> {
    const rows = await db.select<{ key: string; value: string }>(`SELECT key, value FROM settings`);
    const saved: Record<string, unknown> = {};
    for (const row of rows) saved[row.key] = fromJson(row.value);
    const merged = { ...defaults } as Record<string, unknown>;
    for (const key of Object.keys(defaults)) if (saved[key] !== undefined && saved[key] !== null) merged[key] = saved[key];
    return merged as unknown as Settings;
  }

  async function update(patch: Partial<Settings>): Promise<Settings> {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || !(key in defaults)) continue;
      await db.execute(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [
        key,
        toJson(value),
      ]);
    }
    return get();
  }

  const photosFolder = async () => (await get()).photosFolder;

  return { get, update, photosFolder };
}
