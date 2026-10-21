import { convertFileSrc } from "@tauri-apps/api/core";
import { appConfigDir, appDataDir, downloadDir, homeDir, join, pictureDir } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir, readDir, readFile, remove, stat, writeFile } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { baseNameOf, extensionOf, photoFileBase, safeName, uniqueName } from "./names";

/** Folders under the app data directory. */
export const APP_FOLDERS = ["products", "own-models", "poses", "scenes", "catalog-cache"] as const;
export type AppFolder = (typeof APP_FOLDERS)[number];

export type ImportedPhoto = { path: string; width: number; height: number };

export type Files = ReturnType<typeof createFiles>;

/**
 * A path stored relative to one of the app's folders (in the database, or in a backup): plain names only, so it can
 * never point outside that folder. Throws for an absolute path, a drive letter, a backslash or a ".." part.
 */
export function insideRelative(relative: string): string {
  const parts = relative.split("/");
  if (!relative || /^[a-zA-Z]:/.test(relative) || relative.includes("\\") || parts.some((p) => p === "" || p === "." || p === ".."))
    throw new Error("A stored file path points outside Aaina's folders.");
  return relative;
}

export function createFiles() {
  let root: string | null = null;
  const appRoot = async () => (root ??= await appDataDir());

  /** Absolute path of a file stored relative to the app data folder. */
  const appPath = async (relative: string) => join(await appRoot(), insideRelative(relative));
  /** Absolute path of a finished photo, stored relative to its photos folder. */
  const photoPath = async (photosFolder: string, relative: string) => join(photosFolder, insideRelative(relative));

  async function ensureFolders(): Promise<void> {
    for (const folder of APP_FOLDERS) await mkdir(await appPath(folder), { recursive: true });
  }

  // Linux can have no Pictures or Downloads folder set up (the lookup then fails, and the app would never start):
  // use the folder of that name in the home folder instead.
  const systemFolder = async (lookup: () => Promise<string>, name: string) => {
    try {
      return await lookup();
    } catch {
      return join(await homeDir(), name);
    }
  };
  const defaultPhotosFolder = async () => join(await systemFolder(pictureDir, "Pictures"), "Aaina");
  const defaultSaveFolder = async () => systemFolder(downloadDir, "Downloads");

  /** A picture that can be shown in the page (asset: URL). */
  const urlFor = (absolutePath: string) => convertFileSrc(absolutePath);
  const appUrl = async (relative: string) => urlFor(await appPath(relative));

  async function imageSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }

  async function writeAppFile(relative: string, bytes: Uint8Array): Promise<void> {
    const absolute = await appPath(relative);
    await mkdir(await join(absolute, ".."), { recursive: true });
    await writeFile(absolute, bytes);
  }

  /** Bytes of a file the customer picked (absolute path). */
  const readAbsolute = (absolutePath: string) => readFile(absolutePath);
  const readAppFile = async (relative: string) => readFile(await appPath(relative));
  const appFileExists = async (relative: string) => exists(await appPath(relative));

  /** Copies a product photo into the app folder, keeping the original bytes, and measures it. */
  async function importProductPhoto(sourcePath: string, productId: string): Promise<ImportedPhoto> {
    const bytes = await readFile(sourcePath);
    const { width, height } = await imageSize(bytes);
    const relative = `products/${productId}/${crypto.randomUUID()}.${extensionOf(sourcePath)}`;
    await writeAppFile(relative, bytes);
    return { path: relative, width, height };
  }

  /** Writes a finished photo as `<photosFolder>/<shoot name>/<title>-v<version>.<ext>` and returns the path relative to the photos folder. */
  async function writePhotoFile(
    photosFolder: string,
    shootName: string,
    title: string,
    version: number,
    bytes: Uint8Array,
    extension = "png",
  ): Promise<string> {
    const folderName = safeName(shootName, "Photos");
    const folder = await join(photosFolder, folderName);
    await mkdir(folder, { recursive: true });
    const used = new Set((await readDir(folder)).map((entry) => entry.name));
    const name = uniqueName(photoFileBase(title, version), extension, (candidate) => used.has(candidate));
    await writeFile(await join(folder, name), bytes);
    return `${folderName}/${name}`;
  }

  /** Writes a file at an absolute path, creating its folder (used by Save as…). */
  async function writeAbsolute(folder: string, fileName: string, bytes: Uint8Array): Promise<string> {
    await mkdir(folder, { recursive: true });
    const used = new Set((await readDir(folder)).map((entry) => entry.name));
    const dot = fileName.lastIndexOf(".");
    const name = uniqueName(dot > 0 ? fileName.slice(0, dot) : fileName, dot > 0 ? fileName.slice(dot + 1) : "png", (c) => used.has(c));
    const target = await join(folder, name);
    await writeFile(target, bytes);
    return target;
  }

  async function removeIfExists(absolutePath: string): Promise<void> {
    if (await exists(absolutePath)) await remove(absolutePath, { recursive: true });
  }
  const removeApp = async (relative: string) => removeIfExists(await appPath(relative));
  const removePhotoFile = async (photosFolder: string, relative: string) => removeIfExists(await photoPath(photosFolder, relative));

  const reveal = (absolutePath: string) => revealItemInDir(absolutePath);

  /** Size in bytes of everything under a folder (0 when it does not exist). */
  async function folderBytes(absolute: string): Promise<number> {
    if (!(await exists(absolute))) return 0;
    let total = 0;
    for (const entry of await readDir(absolute)) {
      const child = await join(absolute, entry.name);
      total += entry.isDirectory ? await folderBytes(child) : (await stat(child)).size;
    }
    return total;
  }

  /**
   * Copies a folder tree (backup and restore). Never overwrites a file that is already there, and skips links and any
   * name that isn't a plain file name, so a folder from elsewhere can't reach outside `to`.
   */
  async function copyTree(from: string, to: string): Promise<void> {
    if (!(await exists(from))) return;
    await mkdir(to, { recursive: true });
    for (const entry of await readDir(from)) {
      if (entry.isSymlink || !entry.name || entry.name === "." || entry.name === ".." || /[\\/]/.test(entry.name)) continue;
      const source = await join(from, entry.name);
      const target = await join(to, entry.name);
      if (entry.isDirectory) await copyTree(source, target);
      else if (!(await exists(target))) await copyFile(source, target);
    }
  }

  const ensureDir = (absolute: string) => mkdir(absolute, { recursive: true });
  /** Whether the app may use this folder (false when it is outside the folders it was given). A missing folder is fine. */
  const reachable = (absolute: string) =>
    exists(absolute).then(
      () => true,
      () => false,
    );
  const copyOne = (from: string, to: string) => copyFile(from, to);

  return {
    ensureDir,
    reachable,
    copyOne,
    appRoot,
    appPath,
    photoPath,
    appUrl,
    urlFor,
    ensureFolders,
    defaultPhotosFolder,
    defaultSaveFolder,
    importProductPhoto,
    writeAppFile,
    readAbsolute,
    readAppFile,
    appFileExists,
    writePhotoFile,
    writeAbsolute,
    removeApp,
    removePhotoFile,
    removeIfExists,
    reveal,
    folderBytes,
    copyTree,
    imageSize,
    baseNameOf,
    configDir: appConfigDir,
    join,
  };
}
