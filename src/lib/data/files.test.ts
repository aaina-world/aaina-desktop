import { beforeEach, describe, expect, it, vi } from "vitest";
import { files as listFiles, putFile, resetFs, vfs } from "../../test/fakeFs";
import { installCanvas, fakePng } from "../../test/fakeCanvas";
import { createFiles } from "./files";

vi.mock("@tauri-apps/plugin-fs", async () => (await import("../../test/fakeFs")).fsModule);
vi.mock("@tauri-apps/api/path", async () => (await import("../../test/fakeFs")).pathModule);
vi.mock("@tauri-apps/api/core", async () => (await import("../../test/fakeFs")).coreModule);
const reveal = vi.fn();
vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: (p: string) => reveal(p) }));

const text = (path: string) => new TextDecoder().decode(vfs.get(path)!);
let files: ReturnType<typeof createFiles>;
beforeEach(() => {
  resetFs();
  installCanvas();
  reveal.mockClear();
  files = createFiles();
});

describe("app folders", () => {
  it("makes every folder under the app data directory", async () => {
    await files.ensureFolders();
    for (const f of ["products", "own-models", "poses", "scenes", "catalog-cache"]) expect(vfs.get(`/data/${f}`)).toBeNull();
  });
  it("gives the page an asset address for an app file", async () => {
    expect(await files.appUrl("poses/a.png")).toBe("asset://localhost/data/poses/a.png");
    expect(await files.defaultPhotosFolder()).toBe("/Pictures/Aaina");
  });
  it("falls back to folders in the home folder when the system has no Pictures or Downloads folder", async () => {
    const path = (await import("@tauri-apps/api/path")) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    path.pictureDir.mockRejectedValueOnce(new Error("unknown path"));
    path.downloadDir.mockRejectedValueOnce(new Error("unknown path"));
    expect(await files.defaultPhotosFolder()).toBe("/home/me/Pictures/Aaina");
    expect(await files.defaultSaveFolder()).toBe("/home/me/Downloads");
  });
  it("writes, reads and checks an app file, creating its folders", async () => {
    await files.writeAppFile("own-models/m1/sheet.png", new Uint8Array([1, 2]));
    expect(await files.appFileExists("own-models/m1/sheet.png")).toBe(true);
    expect([...(await files.readAppFile("own-models/m1/sheet.png"))]).toEqual([1, 2]);
    await files.removeApp("own-models/m1");
    expect(await files.appFileExists("own-models/m1/sheet.png")).toBe(false);
    await files.removeApp("own-models/nothing"); // removing what is not there is fine
  });
});

describe("product photos", () => {
  it("copies the original bytes into the product's folder and measures them", async () => {
    putFile("/Users/me/Desktop/Blue Kurta.JPG", fakePng(800, 1200));
    await files.ensureFolders();
    const imported = await files.importProductPhoto("/Users/me/Desktop/Blue Kurta.JPG", "p1");
    expect(imported).toMatchObject({ width: 800, height: 1200 });
    expect(imported.path).toMatch(/^products\/p1\/[0-9a-f-]{36}\.jpg$/);
    expect(vfs.get(`/data/${imported.path}`)).toEqual(fakePng(800, 1200));
  });
});

describe("finished photos", () => {
  it("writes into a folder named for the shoot and never overwrites", async () => {
    await files.ensureDir("/Pictures/Aaina");
    const a = await files.writePhotoFile("/Pictures/Aaina", "Cobalt: tee/1", "Front view", 1, new Uint8Array([1]));
    const b = await files.writePhotoFile("/Pictures/Aaina", "Cobalt: tee/1", "Front view", 1, new Uint8Array([2]));
    expect(a).toBe("Cobalt tee 1/Front view-v1.png");
    expect(b).toBe("Cobalt tee 1/Front view-v1 (2).png");
    expect(vfs.get("/Pictures/Aaina/" + a)).toEqual(new Uint8Array([1]));
  });
  it("Save as… keeps the chosen name and extension, adding (2) when taken", async () => {
    const first = await files.writeAbsolute("/Users/me/Out", "kurta.jpg", new Uint8Array([1]));
    const second = await files.writeAbsolute("/Users/me/Out", "kurta.jpg", new Uint8Array([2]));
    const bare = await files.writeAbsolute("/Users/me/Out", "noext", new Uint8Array([3]));
    expect([first, second, bare]).toEqual(["/Users/me/Out/kurta.jpg", "/Users/me/Out/kurta (2).jpg", "/Users/me/Out/noext.png"]);
  });
  it("removes a finished photo file only if it exists", async () => {
    putFile("/Pictures/Aaina/Shoot/a.png", "x");
    await files.removePhotoFile("/Pictures/Aaina", "Shoot/a.png");
    await files.removePhotoFile("/Pictures/Aaina", "Shoot/a.png");
    expect(listFiles()).not.toContain("/Pictures/Aaina/Shoot/a.png");
  });
  it("shows a file in the system file manager", () => {
    void files.reveal("/x/y.png");
    expect(reveal).toHaveBeenCalledWith("/x/y.png");
  });
});

describe("folders", () => {
  it("adds up the size of a whole folder, and zero for one that does not exist", async () => {
    putFile("/data/products/a/1.jpg", new Uint8Array(10));
    putFile("/data/products/a/b/2.jpg", new Uint8Array(5));
    expect(await files.folderBytes("/data/products")).toBe(15);
    expect(await files.folderBytes("/data/missing")).toBe(0);
  });
  it("copies a whole tree, and quietly nothing when the source is missing", async () => {
    putFile("/src/a/1.txt", "one");
    putFile("/src/2.txt", "two");
    await files.copyTree("/src", "/dst");
    expect(text("/dst/a/1.txt")).toBe("one");
    expect(text("/dst/2.txt")).toBe("two");
    await files.copyTree("/nope", "/dst2");
    expect(vfs.has("/dst2")).toBe(false);
  });
  it("copies one file, and exposes the helpers screens need", async () => {
    putFile("/a.txt", "a");
    await files.ensureDir("/b");
    await files.copyOne("/a.txt", "/b/a.txt");
    expect(text("/b/a.txt")).toBe("a");
    expect(files.baseNameOf("/x/y/z.png")).toBe("z.png");
    expect(await files.configDir()).toBe("/data");
    expect(await files.join("/a", "b")).toBe("/a/b");
    expect(await files.appRoot()).toBe("/data");
  });
});
