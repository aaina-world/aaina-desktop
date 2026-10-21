import { exists, mkdir, readDir, readFile, readTextFile, remove, stat, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";

/** The catalogue's cache on disk. Names are relative to `catalog-cache/` (`lists/…`, `img/…`, `sheets/…`, `current.json`). */
export interface CacheStore {
  readText(name: string): Promise<string | null>;
  writeText(name: string, text: string): Promise<void>;
  readBytes(name: string): Promise<Uint8Array | null>;
  writeBytes(name: string, bytes: Uint8Array): Promise<void>;
  /** Known to be cached (answered from memory, so cards can pick local or CDN pictures without waiting). */
  has(name: string): boolean;
  /** The displayable address of a cached file. */
  urlFor(name: string): string;
  /** Total bytes cached. */
  size(): Promise<number>;
  clear(): Promise<void>;
}

const TOP = new Set(["lists", "img", "sheets"]);
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;

/**
 * A name the cache may use: plain segments under lists/, img/ or sheets/, or a file at the top. Nothing that could
 * reach outside the cache folder (no "..", no leading dot, no absolute path, no drive letter, no backslash).
 */
export function isCacheName(name: string): boolean {
  if (name.length > 200) return false;
  const parts = name.split("/");
  if (parts.length > 4 || !parts.every((p) => SEGMENT.test(p))) return false;
  return parts.length === 1 ? name.endsWith(".json") : TOP.has(parts[0]);
}

function checked(name: string): string {
  if (!isCacheName(name)) throw new Error(`Not a catalogue cache name: ${JSON.stringify(name.slice(0, 80))}`);
  return name;
}

/** The store in `<app data>/catalog-cache`. Reads the folder once to know what is cached. */
export async function createDiskStore(root: string): Promise<CacheStore> {
  await mkdir(root, { recursive: true });
  const sizes = new Map<string, number>();

  async function scan(folder: string, prefix: string): Promise<void> {
    if (!(await exists(folder))) return;
    for (const entry of await readDir(folder)) {
      const full = await join(folder, entry.name);
      const name = prefix + entry.name;
      if (entry.isDirectory) await scan(full, `${name}/`);
      else sizes.set(name, (await stat(full)).size);
    }
  }
  // Only the picture folders are indexed up front; they are the ones asked about by name, often.
  for (const folder of ["img", "sheets", "lists"]) await scan(await join(root, folder), `${folder}/`);

  const path = async (name: string) => join(root, checked(name));
  async function ensureParent(name: string) {
    const slash = name.lastIndexOf("/");
    if (slash > 0) await mkdir(await join(root, name.slice(0, slash)), { recursive: true });
  }

  return {
    async readText(name) {
      const full = await path(name);
      return (await exists(full)) ? readTextFile(full) : null;
    },
    async writeText(name, text) {
      await ensureParent(checked(name));
      await writeTextFile(await path(name), text);
      sizes.set(name, text.length);
    },
    async readBytes(name) {
      const full = await path(name);
      return (await exists(full)) ? readFile(full) : null;
    },
    async writeBytes(name, bytes) {
      await ensureParent(checked(name));
      await writeFile(await path(name), bytes);
      sizes.set(name, bytes.length);
    },
    has: (name) => isCacheName(name) && sizes.has(name),
    // The root is fixed for the run, so the address can be built without waiting.
    urlFor: (name) => convertFileSrc(`${root}/${checked(name)}`),
    async size() {
      let total = 0;
      for (const value of sizes.values()) total += value;
      return total;
    },
    async clear() {
      for (const folder of ["img", "sheets", "lists"])
        if (await exists(await join(root, folder))) await remove(await join(root, folder), { recursive: true });
      sizes.clear();
    },
  };
}
