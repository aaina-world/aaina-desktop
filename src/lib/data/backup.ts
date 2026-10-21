import { exists, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { APP_FOLDERS, type Files } from "./files";
import type { Sql } from "./sql";

// Backup is a plain folder (no zip library is installed): `Aaina backup <date>/` with a consistent copy of the database,
// the app's folders (not the re-downloadable catalogue cache) and the finished photos.
const BACKED_UP_FOLDERS = APP_FOLDERS.filter((folder) => folder !== "catalog-cache");
const DB_NAME = "aaina.db";
const PHOTOS_NOTE = "photos-folder.txt";

export const backupFolderName = (date = new Date()) => `Aaina backup ${date.toISOString().slice(0, 10)}`;

/** Writes the backup and returns the folder it made. `VACUUM INTO` gives a consistent copy even while the app is open. */
export async function backupTo(db: Sql, files: Files, photosFolder: string, toFolder: string): Promise<string> {
  const base = await files.join(toFolder, backupFolderName());
  let folder = base;
  for (let n = 2; await exists(folder); n++) folder = `${base} (${n})`;
  await files.ensureDir(folder);
  const dbFile = await files.join(folder, DB_NAME);
  await db.execute(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
  for (const name of BACKED_UP_FOLDERS) await files.copyTree(await files.appPath(name), await files.join(folder, name));
  await files.copyTree(photosFolder, await files.join(folder, "photos"));
  await writeTextFile(await files.join(folder, PHOTOS_NOTE), photosFolder);
  return folder;
}

/**
 * Puts a backup folder back. The caller must relaunch the app afterwards (the database file is replaced under it).
 * The database file lives in the app config folder, which equals the app data folder on Mac and Windows; on Linux the
 * fs scope in capabilities/default.json would also need `$APPCONFIG/**`.
 */
export async function restoreFrom(db: { close(): Promise<boolean> }, files: Files, folder: string): Promise<void> {
  const backedUp = await files.join(folder, DB_NAME);
  if (!(await exists(backedUp))) throw new Error("This folder is not an Aaina backup.");
  await db.close();
  const live = await files.join(await files.configDir(), DB_NAME);
  for (const suffix of ["-wal", "-shm"]) if (await exists(live + suffix)) await remove(live + suffix);
  await files.copyOne(backedUp, live);
  for (const name of BACKED_UP_FOLDERS) await files.copyTree(await files.join(folder, name), await files.appPath(name));
  const note = await files.join(folder, PHOTOS_NOTE);
  if (await exists(note)) await files.copyTree(await files.join(folder, "photos"), (await readTextFile(note)).trim());
}
