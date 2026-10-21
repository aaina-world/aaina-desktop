import { beforeEach, describe, expect, it, vi } from "vitest";
import { putFile, resetFs, vfs } from "../../test/fakeFs";
import { applyRestoreNote, backupFolderName, backupTo, restoreFrom } from "./backup";
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

const DB = "SQLite format 3\u0000rest-of-a-database";
const HERE = { photosFolder: "/Pictures/Aaina", saveFolder: "/Downloads" };

describe("restore", () => {
  it("refuses a folder that is not a backup, before closing anything", async () => {
    putFile("/Other/readme.txt", "x");
    await expect(restoreFrom(db, files, "/Other", HERE)).rejects.toThrow(/not an Aaina backup/);
    putFile("/Fake/aaina.db", "not a database");
    await expect(restoreFrom(db, files, "/Fake", HERE)).rejects.toThrow(/not an Aaina backup/);
    expect(db.close).not.toHaveBeenCalled();
  });
  it("closes the database, replaces it (dropping -wal and -shm), and puts folders and photos back", async () => {
    putFile("/B/aaina.db", DB);
    putFile("/B/products/p/1.jpg", "product");
    putFile("/B/photos/Shoot/a.png", "photo");
    putFile("/B/photos-folder.txt", "/Old/Pictures/Aaina\n");
    putFile("/data/aaina.db", "LIVE");
    putFile("/data/aaina.db-wal", "w");
    putFile("/data/aaina.db-shm", "s");
    await restoreFrom(db, files, "/B", HERE);
    expect(db.close).toHaveBeenCalled();
    expect(text("/data/aaina.db")).toBe(DB);
    expect(vfs.has("/data/aaina.db-wal")).toBe(false);
    expect(vfs.has("/data/aaina.db-shm")).toBe(false);
    expect(text("/data/products/p/1.jpg")).toBe("product");
    expect(text("/Pictures/Aaina/Shoot/a.png")).toBe("photo");
    expect(JSON.parse(text("/data/restored.json"))).toEqual({ ...HERE, backedUpFrom: "/Old/Pictures/Aaina" });
  });
  it("never lets the backup choose where photos go, and never overwrites a file", async () => {
    putFile("/B/aaina.db", DB);
    putFile("/B/photos/report.docx", "from the backup");
    putFile("/B/products/p/1.jpg", "from the backup");
    putFile("/B/photos-folder.txt", "/Users/someone/Documents");
    putFile("/Users/someone/Documents/report.docx", "the person's own document");
    putFile("/Pictures/Aaina/report.docx", "already here");
    putFile("/data/products/p/1.jpg", "already here");
    await restoreFrom(db, files, "/B", HERE);
    expect(text("/Users/someone/Documents/report.docx")).toBe("the person's own document");
    expect(text("/Pictures/Aaina/report.docx")).toBe("already here");
    expect(text("/data/products/p/1.jpg")).toBe("already here");
  });
  it("restores without photos when the backup has no photos note", async () => {
    putFile("/B/aaina.db", DB);
    await restoreFrom(db, files, "/B", HERE);
    expect(text("/data/aaina.db")).toBe(DB);
  });
  it("on the next start keeps this computer's folders and points restored photos at their new folder", async () => {
    putFile("/data/restored.json", JSON.stringify({ ...HERE, backedUpFrom: "/Old/Pictures/Aaina" }));
    const update = vi.fn(async () => ({}));
    expect(await applyRestoreNote(db, files, { update })).toBe(true);
    expect(update).toHaveBeenCalledWith(HERE);
    expect(sqls).toContain("UPDATE photos SET root = $1 WHERE root = $2");
    expect(vfs.has("/data/restored.json")).toBe(false);
    expect(await applyRestoreNote(db, files, { update })).toBe(false);
  });
});
