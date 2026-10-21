import { beforeEach, describe, expect, it, vi } from "vitest";
import { putFile, resetFs, vfs } from "../../test/fakeFs";
import { createDiskStore } from "./cacheStore";

vi.mock("@tauri-apps/plugin-fs", async () => (await import("../../test/fakeFs")).fsModule);
vi.mock("@tauri-apps/api/path", async () => (await import("../../test/fakeFs")).pathModule);
vi.mock("@tauri-apps/api/core", async () => (await import("../../test/fakeFs")).coreModule);

const ROOT = "/data/catalog-cache";
beforeEach(() => resetFs());

describe("the catalogue cache on disk", () => {
  it("creates its folder and starts empty", async () => {
    const store = await createDiskStore(ROOT);
    expect(vfs.get(ROOT)).toBeNull();
    expect(await store.size()).toBe(0);
    expect(store.has("img/a.webp")).toBe(false);
    expect(await store.readText("current.json")).toBeNull();
    expect(await store.readBytes("img/a.webp")).toBeNull();
  });
  it("round-trips text and bytes in nested folders and remembers sizes", async () => {
    const store = await createDiskStore(ROOT);
    await store.writeText("lists/models.abc.json", "[1,2]");
    await store.writeBytes("img/x/y.webp", new Uint8Array([1, 2, 3]));
    await store.writeText("current.json", "{}");
    expect(await store.readText("lists/models.abc.json")).toBe("[1,2]");
    expect([...(await store.readBytes("img/x/y.webp"))!]).toEqual([1, 2, 3]);
    expect(store.has("img/x/y.webp")).toBe(true);
    expect(await store.size()).toBe(5 + 3 + 2);
    expect(store.urlFor("img/x/y.webp")).toBe(`asset://localhost${ROOT}/img/x/y.webp`);
  });
  it("finds what an earlier run cached, so cards can use local pictures at once", async () => {
    putFile(`${ROOT}/img/a.webp`, new Uint8Array(7));
    putFile(`${ROOT}/sheets/deep/b.webp`, new Uint8Array(4));
    const store = await createDiskStore(ROOT);
    expect(store.has("img/a.webp")).toBe(true);
    expect(store.has("sheets/deep/b.webp")).toBe(true);
    expect(await store.size()).toBe(11);
  });
  it("clear removes pictures and lists and forgets them", async () => {
    putFile(`${ROOT}/img/a.webp`, new Uint8Array(7));
    putFile(`${ROOT}/lists/l.json`, "[]");
    putFile(`${ROOT}/current.json`, "{}");
    const store = await createDiskStore(ROOT);
    await store.clear();
    expect(await store.size()).toBe(0);
    expect(vfs.has(`${ROOT}/img`)).toBe(false);
    expect(vfs.has(`${ROOT}/lists`)).toBe(false);
    await store.clear(); // nothing left is fine
  });
});
