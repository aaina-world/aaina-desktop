import { APP_FOLDERS, createFiles } from "./files";
import { applyRestoreNote, backupTo, restoreFrom } from "./backup";
import { openDb } from "./db";
import { createOwnRepo } from "./own";
import { createPhotosRepo } from "./photos";
import { createProductsRepo } from "./products";
import { secrets } from "./secrets";
import { logWarning } from "../log";
import { createSettingsRepo, defaultSettings } from "./settings";
import { createShootsRepo } from "./shoots";
import type { Urls } from "./urls";

export type DataLayer = Awaited<ReturnType<typeof createDataLayer>>;

/**
 * Opens the database (running migrations), makes the folders, and returns every repository.
 * Call once at app start. On start it also turns photos left `sending` into `interrupted` (never resent automatically).
 */
export async function createDataLayer() {
  const files = createFiles();
  await files.ensureFolders();
  const db = await openDb();

  const urls: Urls = {
    // A stored path that points outside its folder shows as a missing picture instead of breaking the list.
    app: (relative) => files.appUrl(relative).catch(() => ""),
    photo: (root, relative) => files.photoPath(root, relative).then(files.urlFor, () => ""),
  };

  const settings = createSettingsRepo(db, defaultSettings(await files.defaultPhotosFolder(), await files.defaultSaveFolder()));
  await applyRestoreNote(db, files, settings);
  await keepFoldersReachable(files, settings);
  const products = createProductsRepo(db, urls);
  const shoots = createShootsRepo(db, urls);
  const photos = createPhotosRepo(db, urls, settings.photosFolder);
  const own = createOwnRepo(db, urls);

  const interrupted = await photos.markInterruptedOnStart();
  await own.failUnfinishedOnStart();

  /** Back up to `<toFolder>/Aaina backup <date>/`; returns that folder. */
  const backup = async (toFolder: string) => backupTo(db, files, await settings.photosFolder(), toFolder);
  /** Restore from such a folder into this computer's folders, then the app must relaunch. */
  const restore = async (folder: string) => {
    const { photosFolder, saveFolder } = await settings.get();
    await restoreFrom(db, files, folder, { photosFolder, saveFolder });
  };

  /**
   * Forgets every shoot, product and own model, pose and scene: their rows and the app's copies of their pictures.
   * Settings and the connection (keychain) stay, and finished photo files already in the photos folder are left alone.
   */
  async function deleteEverything(): Promise<void> {
    for (const table of ["photos", "shoots", "product_photos", "products", "own_poses", "own_scenes", "own_models"])
      await db.execute(`DELETE FROM ${table}`);
    for (const folder of APP_FOLDERS.filter((name) => name !== "catalog-cache")) await files.removeApp(folder);
    await files.ensureFolders();
  }

  return { db, files, secrets, settings, products, shoots, photos, own, interrupted, backup, restore, deleteEverything };
}

/**
 * The app may only use its own folders and folders chosen in a file window (a chosen folder is remembered across
 * restarts). A folder chosen before that rule (version 0.1.x) can't be reached any more: go back to the default one,
 * and the person can choose theirs again in Settings.
 */
async function keepFoldersReachable(files: ReturnType<typeof createFiles>, settings: ReturnType<typeof createSettingsRepo>) {
  const current = await settings.get();
  const patch: { photosFolder?: string; saveFolder?: string } = {};
  if (!(await files.reachable(current.photosFolder))) patch.photosFolder = await files.defaultPhotosFolder();
  if (!(await files.reachable(current.saveFolder))) patch.saveFolder = await files.defaultSaveFolder();
  if (patch.photosFolder || patch.saveFolder) {
    void logWarning("A chosen folder can't be reached any more; using the default", Object.keys(patch).join(", "));
    await settings.update(patch);
  }
}

export { createFiles } from "./files";
export type { Files } from "./files";
export type { Urls } from "./urls";
export { photoFileBase, safeName } from "./names";
