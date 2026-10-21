import { beforeEach, describe, expect, it } from "vitest";
import type { ShotPlan } from "../contract";
import { migrate } from "./migrate";
import { createOwnRepo } from "./own";
import { createPhotosRepo, type PhotosRepo } from "./photos";
import { createProductsRepo, type ProductsRepo } from "./products";
import { createSettingsRepo, defaultSettings } from "./settings";
import { createShootsRepo, type ShootsRepo } from "./shoots";
import type { Sql } from "./sql";
import { memoryDb } from "./sqlite.testkit";
import type { Urls } from "./urls";

const urls: Urls = { app: async (p) => `app://${p}`, photo: async (root, p) => `photo://${root}/${p}` };
const shot: ShotPlan = { kind: "ghost", angle: "front" };

let db: Sql;
let products: ProductsRepo, shoots: ShootsRepo, photos: PhotosRepo;
beforeEach(async () => {
  db = memoryDb();
  await migrate(db);
  products = createProductsRepo(db, urls);
  shoots = createShootsRepo(db, urls);
  photos = createPhotosRepo(db, urls, async () => "/Pictures/Aaina");
});

async function newShoot() {
  const productId = await products.create({ name: "Blue kurta" });
  await products.addPhoto({ productId, path: "products/x/a.jpg", role: "front", width: 800, height: 1200 });
  return { productId, shoot: await shoots.create({ kind: "model", productId, name: "Blue kurta", quality: "standard" }) };
}

describe("photos", () => {
  it("walk queued → sending → done, with versions per shot", async () => {
    const { shoot } = await newShoot();
    const first = await photos.insertQueued({ shootId: shoot.id, shotKey: "k1", shot, title: "Front", estimateUsd: 0.05 });
    expect(first).toMatchObject({ status: "queued", version: 1, url: null, change: { kind: "new" } });
    await photos.markSending(first.id);
    expect((await photos.get(first.id))!.status).toBe("sending");
    await photos.markDone(first.id, { path: "Blue kurta/Front-v1.png", width: 1536, height: 1536 });
    expect(await photos.get(first.id)).toMatchObject({
      status: "done",
      url: "photo:///Pictures/Aaina/Blue kurta/Front-v1.png",
      width: 1536,
    });
    const again = await photos.insertQueued({
      shootId: shoot.id,
      shotKey: "k1",
      shot,
      title: "Front",
      change: { kind: "again" },
      parentId: first.id,
      estimateUsd: 0.05,
    });
    expect(again.version).toBe(2);
  });

  it("on start, sending becomes interrupted (maybe charged) and queued stays queued", async () => {
    const { shoot } = await newShoot();
    const a = await photos.insertQueued({ shootId: shoot.id, shotKey: "a", shot, title: "A", estimateUsd: 0.05 });
    const b = await photos.insertQueued({ shootId: shoot.id, shotKey: "b", shot, title: "B", estimateUsd: 0.05 });
    const c = await photos.insertQueued({ shootId: shoot.id, shotKey: "c", shot, title: "C", estimateUsd: 0.05 });
    await photos.markSending(a.id);
    await photos.markFailed(c.id, { code: "CONTENT_REFUSED", message: "No", charged: "no" });
    expect(await photos.markInterruptedOnStart()).toBe(1);
    expect(await photos.get(a.id)).toMatchObject({ status: "interrupted", error: { code: "INTERRUPTED", charged: "maybe" } });
    expect((await photos.get(b.id))!.status).toBe("queued");
    expect((await photos.get(c.id))!.status).toBe("failed");
    // Try again only re-queues failed photos, never interrupted ones.
    await photos.requeue(a.id);
    expect((await photos.get(a.id))!.status).toBe("interrupted");
    await photos.requeue(c.id);
    expect((await photos.get(c.id))!.status).toBe("queued");
    expect((await photos.queued(10)).map((p) => p.id)).toEqual([b.id, c.id]);
  });
});

describe("photos: interruption and folders", () => {
  it("markInterrupted keeps the reason and the time; rootOf tells where a finished file was written", async () => {
    const { shoot } = await newShoot();
    const a = await photos.insertQueued({ shootId: shoot.id, shotKey: "a", shot, title: "A", estimateUsd: 0.05 });
    expect(await photos.rootOf(a.id)).toBeNull();
    expect(await photos.rootOf("missing")).toBeNull();
    await photos.markSending(a.id);
    await photos.markInterrupted(a.id, { code: "INTERRUPTED", message: "Lost", charged: "maybe" });
    expect(await photos.get(a.id)).toMatchObject({ status: "interrupted", error: { code: "INTERRUPTED", charged: "maybe" } });
    expect((await photos.get(a.id))!.finishedAt).not.toBeNull();
    const b = await photos.insertQueued({ shootId: shoot.id, shotKey: "b", shot, title: "B", estimateUsd: 0.05 });
    await photos.markDone(b.id, { path: "x/B-v1.png", width: 1, height: 1 });
    expect(await photos.rootOf(b.id)).toBe("/Pictures/Aaina");
  });
});

describe("shoots", () => {
  it("are drafts until started, then making while photos are active, then done; the cover is the product until a photo is finished", async () => {
    const { shoot } = await newShoot();
    expect(shoot).toMatchObject({ status: "draft", draftStep: "model", photoCount: 0, coverUrl: "app://products/x/a.jpg" });
    const updated = await shoots.update(shoot.id, { model: { source: "studio", id: "aaina" }, plan: [shot], draftStep: "review" });
    expect(updated).toMatchObject({ model: { source: "studio", id: "aaina" }, plan: [shot] });
    await shoots.markStarted(shoot.id);
    const photo = await photos.insertQueued({ shootId: shoot.id, shotKey: "k", shot, title: "Front", estimateUsd: 0.05 });
    expect((await shoots.get(shoot.id))!.status).toBe("making");
    await photos.markSending(photo.id);
    await photos.markDone(photo.id, { path: "Blue kurta/Front-v1.png", width: 10, height: 10 });
    expect(await shoots.get(shoot.id)).toMatchObject({
      status: "done",
      photoCount: 1,
      coverUrl: "photo:///Pictures/Aaina/Blue kurta/Front-v1.png",
    });
  });

  it("filter by kind, draft and name", async () => {
    const { shoot, productId } = await newShoot();
    const flat = await shoots.create({ kind: "flat-lay", productId, name: "Flat lays", quality: "standard" });
    await shoots.markStarted(flat.id);
    expect((await shoots.list({ kind: "draft" })).map((s) => s.id)).toEqual([shoot.id]);
    expect((await shoots.list({ kind: "flat-lay" })).map((s) => s.id)).toEqual([flat.id]);
    expect((await shoots.list({ q: "kurta" })).map((s) => s.id)).toEqual([shoot.id]);
    expect(await shoots.list({ q: "100%" })).toEqual([]);
  });

  it("deleting a product removes its shoots and photos", async () => {
    const { shoot, productId } = await newShoot();
    await photos.insertQueued({ shootId: shoot.id, shotKey: "k", shot, title: "Front", estimateUsd: 0.05 });
    await products.remove(productId);
    expect(await shoots.get(shoot.id)).toBeNull();
    expect(await photos.forShoot(shoot.id)).toEqual([]);
  });
});

describe("products and own things", () => {
  it("keep photos in order with their urls and a stored reading", async () => {
    const id = await products.create({ name: "Tee" });
    await products.addPhoto({ productId: id, path: "products/p/1.jpg", role: "front", width: 1, height: 2 });
    await products.addPhoto({ productId: id, path: "products/p/2.jpg", role: "back", width: 1, height: 2 });
    const reading = {
      productType: "crewneck_tshirts",
      label: "T-shirt",
      audience: "unisex" as const,
      colour: "white",
      material: null,
      details: null,
      reach: "upper" as const,
      readBy: "key" as const,
      readAt: "2026-10-21T00:00:00Z",
    };
    await products.setReading(id, reading);
    const product = (await products.get(id))!;
    expect(product.photos.map((p) => [p.role, p.url])).toEqual([
      ["front", "app://products/p/1.jpg"],
      ["back", "app://products/p/2.jpg"],
    ]);
    expect(product.reading).toEqual(reading);
  });

  it("own models, poses and scenes round-trip, and unfinished ones fail on start", async () => {
    const own = createOwnRepo(db, urls);
    const model = await own.createModel({
      name: "Mia",
      gender: "woman",
      age: 30,
      appearance: "woman, 30",
      madeFrom: "description",
      status: "making-sheet",
    });
    await own.updateModel(model.id, { faces: [{ id: "f1", path: "own-models/m/f1.png" }] });
    expect((await own.model(model.id))!.faceOptions).toEqual([{ id: "f1", url: "app://own-models/m/f1.png" }]);
    const pose = await own.createPose({ name: "Walking", words: "walking", model: { source: "own", id: model.id } });
    const scene = await own.createScene({ name: "Cafe", words: "a cafe" });
    // A model whose faces were still being made (a "draft") can't finish either.
    const faces = await own.createModel({ name: "Ana", gender: "woman", age: 25, appearance: "woman, 25", madeFrom: "description" });
    const chosen = await own.createModel({
      name: "Leo",
      gender: "man",
      age: 40,
      appearance: "man, 40",
      madeFrom: "description",
      status: "choosing-face",
    });
    await own.failUnfinishedOnStart();
    expect((await own.model(faces.id))!.status).toBe("failed");
    expect((await own.model(chosen.id))!.status).toBe("choosing-face");
    expect((await own.pose(pose.id))!.status).toBe("failed");
    expect((await own.scene(scene.id))!.status).toBe("failed");
    expect((await own.model(model.id))!.status).toBe("failed");
    expect((await own.poses({ source: "own", id: model.id })).length).toBe(1);
  });
});

describe("settings", () => {
  it("start at the defaults and keep what is changed", async () => {
    const settings = createSettingsRepo(db, defaultSettings("/Pictures/Aaina", "/Downloads"));
    expect(await settings.get()).toMatchObject({
      photosFolder: "/Pictures/Aaina",
      quality: "standard",
      parallel: 2,
      saveFormat: "jpeg",
      theme: "system",
      notifyWhenReady: true,
      offlineCatalogue: false,
      autoUpdate: true,
      onboarded: false,
      pins: { models: [], poses: [], scenes: [] },
    });
    const next = await settings.update({ parallel: 3, pins: { models: ["aaina"], poses: [], scenes: [] } });
    expect(next).toMatchObject({ parallel: 3, pins: { models: ["aaina"] }, quality: "standard" });
    expect((await settings.update({ parallel: 4 })).pins.models).toEqual(["aaina"]);
  });
});
