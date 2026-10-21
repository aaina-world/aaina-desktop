// An in-memory stand-in for @tauri-apps/plugin-fs and @tauri-apps/api/path, so file code runs in tests without a disk.
// Paths are absolute POSIX paths. Like the real plugin, writing into a folder that does not exist is an error.
import { vi } from "vitest";

export const vfs = new Map<string, Uint8Array | null>(); // bytes for a file, null for a folder
const DATA = "/data";

export const norm = (p: string): string => {
  const parts: string[] = [];
  for (const s of p.split("/")) {
    if (!s || s === ".") continue;
    if (s === "..") parts.pop();
    else parts.push(s);
  }
  return "/" + parts.join("/");
};
const parent = (p: string) => norm(p + "/..");
const isDir = (p: string) => p === "/" || vfs.get(p) === null;
const missing = (p: string) => new Error(`No such file or directory: ${p}`);

export function resetFs(): void {
  vfs.clear();
  vfs.set(DATA, null);
}
resetFs();

export function putFile(path: string, content: string | Uint8Array): void {
  const p = norm(path);
  let dir = parent(p);
  while (dir !== "/" && !vfs.has(dir)) {
    vfs.set(dir, null);
    dir = parent(dir);
  }
  vfs.set(p, typeof content === "string" ? new TextEncoder().encode(content) : content);
}
export const files = () => [...vfs.entries()].filter(([, v]) => v !== null).map(([k]) => k);

export const fsModule = {
  mkdir: vi.fn(async (path: string, options?: { recursive?: boolean }) => {
    const p = norm(path);
    if (!options?.recursive && !isDir(parent(p))) throw missing(parent(p));
    let dir = p;
    while (dir !== "/" && !vfs.has(dir)) {
      vfs.set(dir, null);
      dir = parent(dir);
    }
  }),
  exists: vi.fn(async (path: string) => vfs.has(norm(path)) || norm(path) === "/"),
  readDir: vi.fn(async (path: string) => {
    const p = norm(path);
    if (!isDir(p)) throw missing(p);
    return [...vfs.keys()]
      .filter((k) => k !== p && parent(k) === p)
      .map((k) => ({
        name: k.slice(k.lastIndexOf("/") + 1),
        isDirectory: vfs.get(k) === null,
        isFile: vfs.get(k) !== null,
        isSymlink: false,
      }));
  }),
  readFile: vi.fn(async (path: string) => {
    const bytes = vfs.get(norm(path));
    if (!bytes) throw missing(path);
    return new Uint8Array(bytes);
  }),
  readTextFile: vi.fn(async (path: string) => {
    const bytes = vfs.get(norm(path));
    if (!bytes) throw missing(path);
    return new TextDecoder().decode(bytes);
  }),
  writeFile: vi.fn(async (path: string, bytes: Uint8Array) => {
    const p = norm(path);
    if (!isDir(parent(p))) throw missing(parent(p));
    vfs.set(p, new Uint8Array(bytes));
  }),
  writeTextFile: vi.fn(async (path: string, text: string) => {
    const p = norm(path);
    if (!isDir(parent(p))) throw missing(parent(p));
    vfs.set(p, new TextEncoder().encode(text));
  }),
  remove: vi.fn(async (path: string) => {
    const p = norm(path);
    if (!vfs.has(p)) throw missing(p);
    for (const k of [...vfs.keys()]) if (k === p || k.startsWith(p + "/")) vfs.delete(k);
  }),
  stat: vi.fn(async (path: string) => {
    const v = vfs.get(norm(path));
    if (v === undefined) throw missing(path);
    return { size: v?.length ?? 0, isDirectory: v === null, isFile: v !== null };
  }),
  copyFile: vi.fn(async (from: string, to: string) => {
    const bytes = vfs.get(norm(from));
    if (!bytes) throw missing(from);
    if (!isDir(parent(norm(to)))) throw missing(parent(norm(to)));
    vfs.set(norm(to), new Uint8Array(bytes));
  }),
};

export const pathModule = {
  join: vi.fn(async (...parts: string[]) => norm(parts.join("/"))),
  appDataDir: vi.fn(async () => DATA),
  appConfigDir: vi.fn(async () => DATA),
  pictureDir: vi.fn(async () => "/Pictures"),
};

/** The keychain behind the `secret_*` Rust commands, plus convertFileSrc. */
export const keychain = new Map<string, string>();
export const coreModule = {
  convertFileSrc: (p: string) => `asset://localhost${p}`,
  invoke: vi.fn(async (command: string, args?: { name: string; value?: string }) => {
    if (command === "secret_get") return keychain.get(args!.name) ?? null;
    if (command === "secret_set") {
      keychain.set(args!.name, args!.value!);
      return undefined;
    }
    if (command === "secret_delete") {
      keychain.delete(args!.name);
      return undefined;
    }
    throw new Error(`Unexpected command ${command}`);
  }),
};
