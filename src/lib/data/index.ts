import { APP_FOLDERS, createFiles } from "./files";
import { backupTo, restoreFrom } from "./backup";
import { openDb } from "./db";
import { createOwnRepo } from "./own";
import { createPhotosRepo } from "./photos";
import { createProductsRepo } from "./products";
import { secrets } from "./secrets";
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
    app: (relative) => files.appUrl(relative),
    photo: async (root, relative) => files.urlFor(await files.join(root, relative)),
  };

  const settings = createSettingsRepo(db, defaultSettings(await files.defaultPhotosFolder(), await files.defaultSaveFolder()));
  const products = createProductsRepo(db, urls);
  const shoots = createShootsRepo(db, urls);
  const photos = createPhotosRepo(db, urls, settings.photosFolder);
  const own = createOwnRepo(db, urls);

  const interrupted = await photos.markInterruptedOnStart();
  await own.failUnfinishedOnStart();

  /** Back up to `<toFolder>/Aaina backup <date>/`; returns that folder. */
  const backup = async (toFolder: string) => backupTo(db, files, await settings.photosFolder(), toFolder);
  /** Restore from such a folder, then the app must relaunch. */
  const restore = (folder: string) => restoreFrom(db, files, folder);

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

export { createFiles } from "./files";
export type { Files } from "./files";
export type { Urls } from "./urls";
export { photoFileBase, safeName } from "./names";
