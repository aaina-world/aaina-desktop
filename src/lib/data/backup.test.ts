import { beforeEach, describe, expect, it, vi } from "vitest";
import { putFile, resetFs, vfs } from "../../test/fakeFs";
import { backupFolderName, backupTo, restoreFrom } from "./backup";
import { createFiles } from "./files";

vi.mock("@tauri-apps/plugin-fs", async () => (await import("../../test/fakeFs")).fsModule);
vi.mock("@tauri-apps/api/path", async () => (await import("../../test/fakeFs")).pathModule);
vi.mock("@tauri-apps/api/core", async () => (await import("../../test/fakeFs")).coreModule);
vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: vi.fn() }));

const text = (path: string) => new TextDecoder().decode(vfs.get(path)!);
const files = createFiles();
const sqls: string[] = [];
const db = {
  execute: async (q: string) => {
    sqls.push(q);
    // VACUUM INTO writes the consistent copy
    const m = /VACUUM INTO '(.*)'/.exec(q);
    if (m) putFile(m[1].replace(/''/g, "'"), "DB");
    return { rowsAffected: 0 };
  },
  select: async () => [],
  close: vi.fn(async () => true),
};

beforeEach(() => {
  resetFs();
  sqls.length = 0;
  db.close.mockClear();
});

it("names the backup folder by the date", () => {
  expect(backupFolderName(new Date("2026-10-21T10:00:00Z"))).toBe("Aaina backup 2026-10-21");
});

describe("backup", () => {
  it("copies the database, the app folders (not the catalogue cache) and the finished photos", async () => {
    putFile("/data/products/p/1.jpg", "product");
    putFile("/data/own-models/m/sheet.png", "sheet");
    putFile("/data/catalog-cache/img/big.webp", "cache");
    putFile("/Pictures/Aaina/Shoot/a.png", "photo");
    putFile("/Backups/.keep", "");
    const folder = await backupTo(db, files, "/Pictures/Aaina", "/Backups");
    expect(folder).toBe(`/Backups/${backupFolderName()}`);
    expect(text(`${folder}/aaina.db`)).toBe("DB");
    expect(text(`${folder}/products/p/1.jpg`)).toBe("product");
    expect(text(`${folder}/own-models/m/sheet.png`)).toBe("sheet");
    expect(text(`${folder}/photos/Shoot/a.png`)).toBe("photo");
    expect(text(`${folder}/photos-folder.txt`)).toBe("/Pictures/Aaina");
    expect(vfs.has(`${folder}/catalog-cache`)).toBe(false);
  });
  it("never overwrites an earlier backup made the same day", async () => {
    putFile("/Backups/.keep", "");
    const one = await backupTo(db, files, "/Pictures/Aaina", "/Backups");
    const two = await backupTo(db, files, "/Pictures/Aaina", "/Backups");
    expect(two).toBe(`${one} (2)`);
  });
});

describe("restore", () => {
  it("refuses a folder that is not a backup, before closing anything", async () => {
    putFile("/Other/readme.txt", "x");
    await expect(restoreFrom(db, files, "/Other")).rejects.toThrow(/not an Aaina backup/);
    expect(db.close).not.toHaveBeenCalled();
  });
  it("closes the database, replaces it (dropping -wal and -shm), and puts folders and photos back", async () => {
    putFile("/B/aaina.db", "OLD-DB");
    putFile("/B/products/p/1.jpg", "product");
    putFile("/B/photos/Shoot/a.png", "photo");
    putFile("/B/photos-folder.txt", "/Pictures/Aaina\n");
    putFile("/data/aaina.db", "LIVE");
    putFile("/data/aaina.db-wal", "w");
    putFile("/data/aaina.db-shm", "s");
    await restoreFrom(db, files, "/B");
    expect(db.close).toHaveBeenCalled();
    expect(text("/data/aaina.db")).toBe("OLD-DB");
    expect(vfs.has("/data/aaina.db-wal")).toBe(false);
    expect(vfs.has("/data/aaina.db-shm")).toBe(false);
    expect(text("/data/products/p/1.jpg")).toBe("product");
    expect(text("/Pictures/Aaina/Shoot/a.png")).toBe("photo");
  });
  it("restores without photos when the backup has no photos note", async () => {
    putFile("/B/aaina.db", "OLD-DB");
    await restoreFrom(db, files, "/B");
    expect(text("/data/aaina.db")).toBe("OLD-DB");
  });
});
