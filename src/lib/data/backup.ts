import { exists, readFile, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { APP_FOLDERS, type Files } from "./files";
import type { Sql } from "./sql";

// Backup is a plain folder (no zip library is installed): `Aaina backup <date>/` with a consistent copy of the database,
// the app's folders (not the re-downloadable catalogue cache) and the finished photos.
const BACKED_UP_FOLDERS = APP_FOLDERS.filter((folder) => folder !== "catalog-cache");
const DB_NAME = "aaina.db";
const PHOTOS_NOTE = "photos-folder.txt";
/** Written by a restore and applied on the next start, once the restored database is open (see applyRestoreNote). */
export const RESTORE_NOTE = "restored.json";
const SQLITE_HEADER = "SQLite format 3\0";

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
 *
 * A backup can come from another computer, or from someone else, so nothing in it decides where files go: photos go to
 * this computer's current photos folder (`photosFolder`), the app's own folders are filled without overwriting anything,
 * links are skipped, and the database must really be a SQLite file. The folders this computer uses are written to a
 * note that the next start applies to the restored settings.
 */
export async function restoreFrom(
  db: { close(): Promise<boolean> },
  files: Files,
  folder: string,
  here: { photosFolder: string; saveFolder: string },
): Promise<void> {
  const backedUp = await files.join(folder, DB_NAME);
  if (!(await exists(backedUp))) throw new Error("This folder is not an Aaina backup.");
  const head = new TextDecoder().decode((await readFile(backedUp)).slice(0, SQLITE_HEADER.length));
  if (head !== SQLITE_HEADER) throw new Error("This folder is not an Aaina backup.");
  await db.close();
  const configDir = await files.configDir();
  const live = await files.join(configDir, DB_NAME);
  for (const suffix of ["-wal", "-shm"]) if (await exists(live + suffix)) await remove(live + suffix);
  await files.copyOne(backedUp, live);
  for (const name of BACKED_UP_FOLDERS) await files.copyTree(await files.join(folder, name), await files.appPath(name));
  await files.copyTree(await files.join(folder, "photos"), here.photosFolder);
  await writeTextFile(await files.join(configDir, RESTORE_NOTE), JSON.stringify(here));
}

/**
 * After a restore: keep this computer's folders (not the ones in the restored settings), and point every restored photo
 * at the folder they were copied into. Returns true when a restore was applied.
 */
export async function applyRestoreNote(
  db: { execute(query: string, values?: unknown[]): Promise<unknown> },
  files: Files,
  settings: { update(patch: { photosFolder: string; saveFolder: string }): Promise<unknown> },
): Promise<boolean> {
  const note = await files.join(await files.configDir(), RESTORE_NOTE);
  if (!(await exists(note))) return false;
  const { photosFolder, saveFolder } = JSON.parse(await readTextFile(note)) as { photosFolder: string; saveFolder: string };
  await settings.update({ photosFolder, saveFolder });
  // Every restored photo points at this computer's photos folder (where restore copied them), whatever folder the
  // backup's database names: a folder from someone else's backup is never trusted for showing or deleting files.
  await db.execute(`UPDATE photos SET root = $1 WHERE root IS NOT NULL`, [photosFolder]);
  await remove(note);
  return true;
}
