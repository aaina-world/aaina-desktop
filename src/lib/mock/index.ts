// An in-memory Api with sample data, so every screen runs in a plain browser (`npm run dev`) with no network.
// Settings and the connection are kept in localStorage so a reload doesn't send you back to the welcome screen.
import {
  ESTIMATE_USD,
  type Api,
  type CatalogModel,
  type CatalogStatus,
  type Connection,
  type ModelRef,
  type OwnModel,
  type OwnPose,
  type OwnScene,
  type Photo,
  type PhotoErrorCode,
  type Product,
  type ProductReading,
  type Settings,
  type Shoot,
  type ShootKind,
  type ShotPlan,
} from "../contract";
import { IMG } from "./images";
import { FACE_OPTIONS, FLAT_RESULTS, GHOST_RESULTS, MODELS, MODEL_RESULTS, SCENES, posesOf } from "./data";

type Listener = Parameters<Api["subscribe"]>[0];
const now = () => new Date().toISOString();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000,
  HOUR = 3_600_000,
  DAY = 86_400_000;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? { ...d, ...(JSON.parse(v) as Partial<T>) } : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};

const DEFAULT_SETTINGS: Settings = {
  onboarded: typeof location === "undefined" || !location.search.includes("firstrun"),
  photosFolder: "~/Pictures/Aaina",
  quality: "standard",
  parallel: 3,
  saveFormat: "jpeg",
  theme: "system",
  notifyWhenReady: true,
  offlineCatalogue: true,
  autoUpdate: true,
  pins: { models: [], poses: [], scenes: [] },
};
const DEFAULT_CONNECTION: Connection = {
  chatgpt: { signedIn: false, email: null, plan: null },
  key: { present: false, last4: null, status: "unknown" },
  canRead: false,
  canMakePhotos: false,
};

export async function createMockApi(): Promise<Api> {
  let settings: Settings = store.get("aaina-mock-settings", DEFAULT_SETTINGS);
  let conn: Connection = store.get("aaina-mock-connection", DEFAULT_CONNECTION);
  let catalog: CatalogStatus = {
    state: "ready",
    publishedAt: ago(DAY),
    checkedAt: ago(2 * HOUR),
    modelCount: MODELS.length,
    cacheBytes: 1_288_490_188,
  };
  const listeners = new Set<Listener>();
  const emit: (type: Parameters<Listener>[0]["type"], id?: string) => void = (type, id) => listeners.forEach((l) => l({ type, id }));

  const products = new Map<string, Product>();
  const shoots = new Map<string, Shoot>();
  const photos = new Map<string, Photo>();
  const ownModels = new Map<string, OwnModel>();
  const ownPoses = new Map<string, OwnPose>();
  const ownScenes = new Map<string, OwnScene>();

  // ---------- helpers ----------
  const posesAll = () => MODELS.flatMap((x) => posesOf(x.id)).slice(0, 16);
  const poseTitle = (s: ShotPlan): string => {
    if (s.kind === "flat-lay")
      return { clean: "Clean", folded: "Neatly folded", styled: "Styled" }[s.style] + (s.side === "back" ? ", back" : "");
    if (s.kind === "ghost")
      return { front: "Front", "three-quarter": "Three-quarter", side: "Side", "back-three-quarter": "Back three-quarter", back: "Back" }[
        s.angle
      ];
    if (s.pose.source === "words") return s.pose.words.slice(0, 40);
    const found =
      posesAll().find((p) => p.id === (s.pose as { id: string }).id) ?? (s.pose.source === "own" ? ownPoses.get(s.pose.id) : undefined);
    return found?.name ?? "Pose";
  };
  const shotKeyOf = (s: ShotPlan) =>
    s.kind === "model"
      ? `${s.pose.source}:${"id" in s.pose ? s.pose.id : s.pose.words}:${s.frame}:${s.expression}`
      : s.kind === "flat-lay"
        ? `flat:${s.style}:${s.side}`
        : `ghost:${s.angle}`;
  const resultFor = (kind: ShootKind, n: number) => {
    const l = kind === "model" ? MODEL_RESULTS : kind === "ghost" ? GHOST_RESULTS : FLAT_RESULTS;
    return l[n % l.length];
  };
  let resultCounter = 0;

  function newPhoto(shoot: Shoot, shot: ShotPlan, extra: Partial<Photo> = {}): Photo {
    const p: Photo = {
      id: uid(),
      shootId: shoot.id,
      shotKey: shotKeyOf(shot),
      shot,
      title: poseTitle(shot),
      version: 1,
      parentId: null,
      change: { kind: "new" },
      status: "queued",
      error: null,
      path: null,
      url: null,
      width: null,
      height: null,
      estimateUsd: shoot.quality === "high" ? ESTIMATE_USD.photo.high : ESTIMATE_USD.photo.standard,
      startedAt: null,
      finishedAt: null,
      createdAt: now(),
      ...extra,
    };
    photos.set(p.id, p);
    return p;
  }
  function finishedFields(shoot: Shoot, title: string, at: string) {
    const url = resultFor(shoot.kind, resultCounter++);
    return { status: "done" as const, url, path: `${shoot.name}/${title}.png`, width: 1536, height: 1536, finishedAt: at, startedAt: at };
  }
  function refreshShoot(id: string) {
    const s = shoots.get(id);
    if (!s || s.status === "draft") return;
    const list = [...photos.values()].filter((p) => p.shootId === id);
    const keys = new Set(list.filter((p) => p.status === "done").map((p) => p.shotKey));
    const anyActive = [...photos.values()].some((p) => p.shootId === id && (p.status === "queued" || p.status === "sending"));
    const firstDone = list.filter((p) => p.status === "done").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    shoots.set(id, {
      ...s,
      status: anyActive ? "making" : "done",
      photoCount: keys.size,
      readyCount: keys.size,
      failedCount: list.filter((p) => p.status === "failed" || p.status === "interrupted").length,
      coverUrl: firstDone?.url ?? s.coverUrl,
      updatedAt: now(),
    });
    emit("shoot", id);
  }

  // ---------- the photo queue ----------
  const queue: string[] = [];
  const running = new Set<string>();
  function enqueue(p: Photo) {
    if (conn.key.present && conn.key.status !== "works" && conn.key.status !== "unknown") {
      const code: PhotoErrorCode =
        conn.key.status === "refused" ? "KEY_REFUSED" : conn.key.status === "out-of-credit" ? "OUT_OF_CREDIT" : "VERIFY_ORGANIZATION";
      const msg = {
        KEY_REFUSED: "OpenAI didn't accept the key.",
        OUT_OF_CREDIT: "The OpenAI account is out of credit.",
        VERIFY_ORGANIZATION: "OpenAI wants the organisation verified first.",
      }[code as "KEY_REFUSED"];
      photos.set(p.id, { ...p, status: "failed", error: { code, message: msg, charged: "no" } });
      emit("photo", p.id);
      return;
    }
    queue.push(p.id);
    pump();
  }
  function pump() {
    while (running.size < settings.parallel && queue.length) {
      const id = queue.shift()!;
      const p = photos.get(id);
      if (!p || p.status !== "queued") continue;
      running.add(id);
      photos.set(id, { ...p, status: "sending", startedAt: now() });
      emit("photo", id);
      refreshShoot(p.shootId);
      setTimeout(() => complete(id), 5000 + Math.random() * 4000);
    }
  }
  function complete(id: string) {
    running.delete(id);
    const p = photos.get(id);
    const s = p && shoots.get(p.shootId);
    if (!p || !s) return pump();
    const bad = p.change.kind === "again" && /fail/i.test(p.change.note ?? "");
    if (bad)
      photos.set(id, {
        ...p,
        status: "failed",
        finishedAt: now(),
        error: { code: "BAD_ANSWER", message: "OpenAI answered, but not with a usable photo.", charged: "no" },
      });
    else photos.set(id, { ...p, ...finishedFields(s, p.title, now()), startedAt: p.startedAt });
    emit("photo", id);
    refreshShoot(p.shootId);
    pump();
  }

  // ---------- seed ----------
  function seedProduct(name: string, img: string, reading: Partial<ProductReading> = {}, ageMs = 3 * DAY): Product {
    const id = uid();
    const p: Product = {
      id,
      name,
      createdAt: ago(ageMs),
      updatedAt: ago(ageMs),
      photos: [{ id: uid(), path: `${name}.jpg`, url: img, role: "front", width: 1200, height: 1500 }],
      reading: {
        productType: "crewneck_tshirts",
        label: "T-shirt",
        audience: "unisex",
        colour: "cobalt blue",
        material: "cotton jersey",
        details: "crew neck, short sleeves, small chest print",
        reach: "upper",
        readBy: "chatgpt",
        readAt: ago(3 * DAY),
        ...reading,
      },
    };
    products.set(id, p);
    return p;
  }
  function seedShoot(
    name: string,
    kind: ShootKind,
    img: string,
    opts: {
      model?: string;
      scene?: string;
      ageMs: number;
      done: number;
      extra?: "making" | "failed" | "draft" | "interrupted";
      versions?: number;
    },
  ) {
    const product = seedProduct(name, img, kind === "model" ? {} : { label: "Garment" }, opts.ageMs);
    const created = ago(opts.ageMs);
    const modelRef: ModelRef | null = kind === "model" ? { source: "studio", id: opts.model ?? "tara" } : null;
    const total = opts.done + (opts.extra && opts.extra !== "draft" ? (opts.extra === "making" ? 2 : 1) : 0);
    const plan: ShotPlan[] = Array.from({ length: Math.max(total, 1) }, (_, i) =>
      kind === "model"
        ? { kind: "model", pose: { source: "studio", id: posesAll()[i % 16].id }, frame: "as-posed", expression: "as-posed" }
        : kind === "ghost"
          ? { kind: "ghost", angle: (["front", "three-quarter", "side", "back-three-quarter", "back"] as const)[i % 5] }
          : { kind: "flat-lay", style: (["clean", "folded", "styled"] as const)[i % 3], side: i > 2 ? "back" : "front" },
    );
    const shoot: Shoot = {
      id: uid(),
      name,
      kind,
      productId: product.id,
      model: modelRef,
      scene: kind === "model" ? { source: "studio", id: opts.scene ?? "plaster-arches" } : null,
      quality: "standard",
      plan,
      status: opts.extra === "draft" ? "draft" : opts.extra === "making" ? "making" : "done",
      draftStep: opts.extra === "draft" ? "poses" : null,
      coverUrl: opts.extra === "draft" ? img : null,
      photoCount: opts.done,
      createdAt: created,
      updatedAt: created,
    };
    shoots.set(shoot.id, shoot);
    if (opts.extra === "draft") return shoot;
    plan.forEach((shot, i) => {
      const base = { createdAt: created };
      if (i < opts.done) {
        const p = newPhoto(shoot, shot, base);
        photos.set(p.id, { ...p, ...finishedFields(shoot, p.title, created), createdAt: created });
        if (opts.versions && i < opts.versions) {
          const v2 = newPhoto(shoot, shot, { version: 2, parentId: p.id, change: { kind: "again" }, createdAt: ago(opts.ageMs - 5 * MIN) });
          photos.set(v2.id, { ...v2, ...finishedFields(shoot, p.title, v2.createdAt), createdAt: v2.createdAt });
        }
      } else if (opts.extra === "failed") {
        const p = newPhoto(shoot, shot, base);
        photos.set(p.id, {
          ...p,
          status: "failed",
          error: { code: "CONTENT_REFUSED", message: "OpenAI's safety check declined this one.", charged: "no" },
        });
      } else if (opts.extra === "interrupted") {
        const p = newPhoto(shoot, shot, base);
        photos.set(p.id, {
          ...p,
          status: "interrupted",
          startedAt: created,
          error: { code: "INTERRUPTED", message: "The app closed while this photo was being made.", charged: "maybe" },
        });
      } else if (opts.extra === "making") {
        const p = newPhoto(shoot, shot, base);
        if (i === opts.done) {
          photos.set(p.id, { ...p, status: "sending", startedAt: ago(20_000) });
          running.add(p.id);
          setTimeout(() => complete(p.id), 7000);
        } else queue.push(p.id);
      }
    });
    const cover = [...photos.values()].find((p) => p.shootId === shoot.id && p.status === "done");
    shoots.set(shoot.id, { ...shoot, coverUrl: cover?.url ?? (opts.extra === "making" ? img : null) });
    return shoots.get(shoot.id)!;
  }

  seedShoot("Cobalt T-shirt", "model", IMG.realGhost, { ageMs: 6 * MIN, done: 3, extra: "making", versions: 1 });
  seedShoot("Camel coat", "model", IMG.startChloe, { ageMs: 5 * HOUR, done: 4, model: "chloe", scene: "limewash-hall" });
  seedShoot("Sage linen blazer", "ghost", IMG.ghostFront, { ageMs: DAY, done: 3 });
  seedShoot("Linen shirt", "model", IMG.sampleGarment, { ageMs: DAY + 2 * HOUR, done: 0, extra: "draft" });
  seedShoot("Denim jacket", "model", IMG.realAaina, { ageMs: 2 * DAY, done: 2, model: "aaina", extra: "failed" });
  seedShoot("Summer kurta", "flat-lay", IMG.flatlayClean, { ageMs: 2 * DAY + HOUR, done: 4 });
  seedShoot("Cream kurta set", "model", IMG.startPhotoshoot, { ageMs: 4 * DAY, done: 6, model: "nia", scene: "bali-villa" });
  seedShoot("Wool blazer", "ghost", IMG.realGhost, { ageMs: 7 * DAY, done: 5 });
  seedShoot("Sage block-print kurta", "model", IMG.startPicture, { ageMs: 9 * DAY, done: 6, model: "kabir", scene: "accra-courtyard" });
  seedShoot("Linen shirt set", "flat-lay", IMG.flatlayStyled, { ageMs: 12 * DAY, done: 3 });
  seedShoot("Rust wrap dress", "model", IMG.realPoster, { ageMs: 13 * DAY, done: 3, extra: "interrupted", model: "camille" });
  setTimeout(pump, 100);

  ownModels.set("own-1", {
    id: "own-1",
    name: "Priya",
    gender: "woman",
    age: 28,
    look: "South Asian",
    body: "average",
    appearance: "woman, age 28, warm brown skin, long dark wavy hair",
    madeFrom: "description",
    status: "ready",
    faceOptions: [],
    sheetUrl: IMG.sheetSample,
    sheetPath: "models/priya/sheet.png",
    createdAt: ago(5 * DAY),
  });
  ownPoses.set("op-1", {
    id: "op-1",
    name: "Hands on hips, looking left",
    words: "Hands on hips, looking left",
    imageUrl: IMG.pose3,
    modelRef: { source: "studio", id: "tara" },
    createdAt: ago(3 * DAY),
    status: "ready",
  });
  ownScenes.set("os-1", {
    id: "os-1",
    name: "Sunlit terrace",
    words: "A sunlit terrace with white walls and terracotta pots",
    imageUrl: IMG.sceneBaliVilla,
    createdAt: ago(3 * DAY),
    status: "ready",
  });

  // ---------- the Api ----------
  const saveSettings = () => store.set("aaina-mock-settings", settings);
  const saveConn = () => {
    conn = { ...conn, canRead: conn.chatgpt.signedIn || conn.key.present, canMakePhotos: conn.key.present && conn.key.status === "works" };
    store.set("aaina-mock-connection", conn);
    emit("connection");
    return conn;
  };
  const need = <T>(v: T | undefined | null, what: string): T => {
    if (v == null) throw new Error(`${what} not found`);
    return v;
  };
  const nonNull = (a: Partial<Shoot>) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));

  const api: Api = {
    // Catalogue
    async catalogStatus() {
      await wait(120);
      return catalog;
    },
    async refreshCatalog() {
      catalog = { ...catalog, state: "loading" };
      emit("catalog");
      await wait(1300);
      catalog = { ...catalog, state: "ready", checkedAt: now(), publishedAt: now() };
      emit("catalog");
      return catalog;
    },
    async models() {
      await wait(200);
      return MODELS;
    },
    async posesFor(model) {
      await wait(150);
      return posesOf(model.source === "studio" ? model.id : MODELS[0].id);
    },
    async scenes() {
      await wait(150);
      return SCENES;
    },
    async suggestModels(productId) {
      await wait(150);
      const aud = productId ? products.get(productId)?.reading?.audience : null;
      const want = (x: CatalogModel) =>
        aud === "women" || aud === "girls" ? x.gender === "woman" : aud === "men" || aud === "boys" ? x.gender === "man" : true;
      return [...MODELS.filter(want), ...MODELS.filter((x) => !want(x))];
    },

    // Products
    async products() {
      await wait(120);
      return [...products.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async product(id) {
      await wait(60);
      return products.get(id) ?? null;
    },
    async createProduct(files, name) {
      const id = uid();
      const first = files[0]?.path ?? "Product";
      const base = first
        .split(/[\\/]/)
        .pop()!
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[-_]+/g, " ");
      const p: Product = {
        id,
        name: name ?? (base.startsWith("blob") || !base ? "New product" : base.charAt(0).toUpperCase() + base.slice(1)),
        photos: files.map((f) => ({
          id: uid(),
          path: f.path,
          url: f.path.startsWith("blob:") || f.path.startsWith("http") ? f.path : IMG.sampleGarment,
          role: f.role,
          width: 1200,
          height: 1500,
        })),
        reading: null,
        createdAt: now(),
        updatedAt: now(),
      };
      products.set(id, p);
      emit("shoot");
      return p;
    },
    async updateProduct(id, patch) {
      const p = need(products.get(id), "Product");
      const photosPatched = patch.photos
        ? p.photos.map((ph) => ({ ...ph, role: patch.photos!.find((x) => x.id === ph.id)?.role ?? ph.role }))
        : p.photos;
      const next: Product = {
        ...p,
        name: patch.name ?? p.name,
        reading: patch.reading === undefined ? p.reading : patch.reading,
        photos: photosPatched,
        updatedAt: now(),
      };
      products.set(id, next);
      emit("shoot");
      return next;
    },
    async addProductPhotos(id, files) {
      const p = need(products.get(id), "Product");
      const next = {
        ...p,
        photos: [
          ...p.photos,
          ...files.map((f) => ({
            id: uid(),
            path: f.path,
            url: f.path.startsWith("blob:") ? f.path : IMG.sampleGarment,
            role: f.role,
            width: 1200,
            height: 1500,
          })),
        ],
        updatedAt: now(),
      };
      products.set(id, next);
      return next;
    },
    async deleteProduct(id) {
      products.delete(id);
      emit("shoot");
    },
    async readProduct(id) {
      const p = need(products.get(id), "Product");
      if (!conn.chatgpt.signedIn && !conn.key.present) throw new Error("Connect ChatGPT or add an OpenAI key to read products.");
      await wait(1200);
      const reading: ProductReading = {
        productType: "crewneck_tshirts",
        label: "T-shirt",
        audience: "unisex",
        colour: "cobalt blue",
        material: "cotton jersey",
        details: "crew neck, short sleeves",
        reach: "upper",
        readBy: conn.chatgpt.signedIn ? "chatgpt" : "key",
        readAt: now(),
      };
      products.set(id, { ...p, reading });
      return reading;
    },

    // Shoots and photos
    async shoots(filter) {
      await wait(180);
      let list = [...shoots.values()];
      if (filter?.kind === "draft") list = list.filter((s) => s.status === "draft");
      else if (filter?.kind) list = list.filter((s) => s.kind === filter.kind);
      if (filter?.q) {
        const q = filter.q.toLowerCase();
        list = list.filter((s) => s.name.toLowerCase().includes(q));
      }
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async shoot(id) {
      await wait(60);
      return shoots.get(id) ?? null;
    },
    async createShoot({ kind, productId }) {
      const prod = need(products.get(productId), "Product");
      const s: Shoot = {
        id: uid(),
        name: prod.name,
        kind,
        productId,
        model: null,
        scene: null,
        quality: settings.quality,
        plan: [],
        status: "draft",
        draftStep: "model",
        coverUrl: prod.photos[0]?.url ?? null,
        photoCount: 0,
        createdAt: now(),
        updatedAt: now(),
      };
      shoots.set(s.id, s);
      emit("shoot", s.id);
      return s;
    },
    async updateShoot(id, patch) {
      const s = need(shoots.get(id), "Shoot");
      const next = { ...s, ...nonNull(patch), updatedAt: now() };
      shoots.set(id, next);
      emit("shoot", id);
      return next;
    },
    async deleteShoot(id) {
      for (const p of [...photos.values()]) if (p.shootId === id) photos.delete(p.id);
      shoots.delete(id);
      emit("shoot", id);
    },
    async photos(shootId) {
      await wait(100);
      return [...photos.values()]
        .filter((p) => p.shootId === shootId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.version - b.version);
    },
    async photo(id) {
      await wait(30);
      return photos.get(id) ?? null;
    },
    async clearCatalogCache() {
      await wait(300);
      catalog = { ...catalog, cacheBytes: 0 };
      emit("catalog");
      return catalog;
    },
    async recentPhotos(limit) {
      await wait(100);
      return [...photos.values()]
        .filter((p) => p.status === "done")
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
        .slice(0, limit);
    },
    async makeShoot(id) {
      const s = need(shoots.get(id), "Shoot");
      const plan: ShotPlan[] = s.plan.length
        ? s.plan
        : s.kind === "model"
          ? [0, 1, 2, 3].map((i) => ({
              kind: "model" as const,
              pose: { source: "studio" as const, id: posesAll()[i].id },
              frame: "as-posed",
              expression: "as-posed",
            }))
          : s.kind === "ghost"
            ? [
                { kind: "ghost", angle: "front" },
                { kind: "ghost", angle: "side" },
              ]
            : [
                { kind: "flat-lay", style: "clean", side: "front" },
                { kind: "flat-lay", style: "folded", side: "front" },
              ];
      shoots.set(id, { ...s, plan, status: "making", draftStep: null, updatedAt: now() });
      const made = plan.map((shot) => newPhoto(shoots.get(id)!, shot));
      made.forEach(enqueue);
      emit("shoot", id);
      return made;
    },
    async makeAgain(photoId, note, options) {
      const old = need(photos.get(photoId), "Photo");
      const s = need(shoots.get(old.shootId), "Shoot");
      const v =
        Math.max(...[...photos.values()].filter((p) => p.shootId === old.shootId && p.shotKey === old.shotKey).map((p) => p.version)) + 1;
      const shot: ShotPlan =
        old.shot.kind === "model" && options
          ? { ...old.shot, frame: options.frame ?? old.shot.frame, expression: options.expression ?? old.shot.expression }
          : old.shot;
      const p = newPhoto(s, shot, { version: v, parentId: old.id, change: { kind: "again", note } });
      shoots.set(s.id, { ...s, status: "making" });
      enqueue(p);
      emit("shoot", s.id);
      return photos.get(p.id)!;
    },
    async tryAgain(photoId) {
      const old = need(photos.get(photoId), "Photo");
      photos.set(photoId, { ...old, status: "queued", error: null, startedAt: null });
      shoots.set(old.shootId, { ...shoots.get(old.shootId)!, status: "making" });
      enqueue(photos.get(photoId)!);
      emit("shoot", old.shootId);
      return photos.get(photoId)!;
    },
    async fixPhoto(photoId, words) {
      const old = need(photos.get(photoId), "Photo");
      const s = need(shoots.get(old.shootId), "Shoot");
      const v =
        Math.max(...[...photos.values()].filter((p) => p.shootId === old.shootId && p.shotKey === old.shotKey).map((p) => p.version)) + 1;
      const p = newPhoto(s, old.shot, { version: v, parentId: old.id, change: { kind: "fix", words }, estimateUsd: ESTIMATE_USD.edit });
      shoots.set(s.id, { ...s, status: "making" });
      enqueue(p);
      emit("shoot", s.id);
      return photos.get(p.id)!;
    },
    async otherColours(photoId, colours) {
      const old = need(photos.get(photoId), "Photo");
      const s = need(shoots.get(old.shootId), "Shoot");
      let v = Math.max(...[...photos.values()].filter((p) => p.shootId === old.shootId && p.shotKey === old.shotKey).map((p) => p.version));
      shoots.set(s.id, { ...s, status: "making" });
      const made = colours.map((c) => {
        const p = newPhoto(s, old.shot, {
          version: ++v,
          parentId: old.id,
          change: { kind: "colour", hex: c.hex, name: c.name },
          estimateUsd: ESTIMATE_USD.edit,
        });
        enqueue(p);
        return photos.get(p.id)!;
      });
      emit("shoot", s.id);
      return made;
    },
    async deletePhoto(photoId) {
      const p = photos.get(photoId);
      photos.delete(photoId);
      if (p) refreshShoot(p.shootId);
      emit("photo", photoId);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    // Own models, poses, scenes
    async ownModels() {
      await wait(100);
      return [...ownModels.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async ownModel(id) {
      await wait(50);
      return ownModels.get(id) ?? null;
    },
    async createOwnModelFromWords(input) {
      const m: OwnModel = {
        id: uid(),
        name: input.name,
        gender: input.gender,
        age: input.age,
        look: input.look ?? null,
        body: input.body ?? null,
        appearance: input.words || `${input.gender}, age ${input.age}`,
        madeFrom: "description",
        status: "draft",
        faceOptions: [],
        sheetUrl: null,
        sheetPath: null,
        createdAt: now(),
      };
      ownModels.set(m.id, m);
      emit("own", m.id);
      setTimeout(() => {
        ownModels.set(m.id, { ...m, status: "choosing-face", faceOptions: FACE_OPTIONS.map((url, i) => ({ id: `f${i}`, url })) });
        emit("own", m.id);
      }, 2500);
      return m;
    },
    async createOwnModelFromPhotos(input) {
      const m: OwnModel = {
        id: uid(),
        name: input.name,
        gender: "woman",
        age: 30,
        look: null,
        body: null,
        appearance: "from your photos",
        madeFrom: "photos",
        status: "making-sheet",
        faceOptions: [],
        sheetUrl: null,
        sheetPath: null,
        createdAt: now(),
      };
      ownModels.set(m.id, m);
      emit("own", m.id);
      setTimeout(() => {
        ownModels.set(m.id, { ...m, status: "ready", sheetUrl: IMG.sheetSample, sheetPath: `models/${m.id}/sheet.png` });
        emit("own", m.id);
      }, 4000);
      return m;
    },
    async chooseFace(id, faceId) {
      const m = need(ownModels.get(id), "Model");
      const next = { ...m, status: "making-sheet" as const, faceOptions: m.faceOptions.filter((f) => f.id === faceId) };
      ownModels.set(id, next);
      emit("own", id);
      setTimeout(() => {
        ownModels.set(id, { ...next, status: "ready", sheetUrl: IMG.sheetSample, sheetPath: `models/${id}/sheet.png` });
        emit("own", id);
      }, 4000);
      return next;
    },
    async remakeSheet(id) {
      const m = need(ownModels.get(id), "Model");
      const next = { ...m, status: "making-sheet" as const };
      ownModels.set(id, next);
      emit("own", id);
      setTimeout(() => {
        ownModels.set(id, { ...next, status: "ready", sheetUrl: IMG.sheetSample });
        emit("own", id);
      }, 4000);
      return next;
    },
    async renameOwnModel(id, name) {
      const m = need(ownModels.get(id), "Model");
      const next = { ...m, name };
      ownModels.set(id, next);
      emit("own", id);
      return next;
    },
    async deleteOwnModel(id) {
      ownModels.delete(id);
      emit("own", id);
    },
    async ownPoses(model) {
      await wait(80);
      return [...ownPoses.values()].filter((p) => !model || (p.modelRef.source === model.source && p.modelRef.id === model.id));
    },
    async makePose(input) {
      const p: OwnPose = {
        id: uid(),
        name: (input.words ?? "Pose from a photo").slice(0, 40),
        words: input.words ?? null,
        imageUrl: IMG.pose5,
        modelRef: input.model,
        createdAt: now(),
        status: "making",
      };
      ownPoses.set(p.id, p);
      emit("own", p.id);
      setTimeout(() => {
        ownPoses.set(p.id, { ...p, status: "ready" });
        emit("own", p.id);
      }, 3000);
      return p;
    },
    async ownScenes() {
      await wait(80);
      return [...ownScenes.values()];
    },
    async makeScene(input) {
      const s: OwnScene = {
        id: uid(),
        name: input.words.slice(0, 40),
        words: input.words,
        imageUrl: IMG.sceneAustralianBeachHouse,
        createdAt: now(),
        status: "making",
      };
      ownScenes.set(s.id, s);
      emit("own", s.id);
      setTimeout(() => {
        ownScenes.set(s.id, { ...s, status: "ready" });
        emit("own", s.id);
      }, 3000);
      return s;
    },

    // Save, copy, folders
    async savePhotos(req) {
      await wait(500);
      return {
        paths: req.photoIds.map(
          (_, i) =>
            `${req.folder}/${req.fileName ?? "photo"}${req.photoIds.length > 1 ? "-" + (i + 1) : ""}.${req.format === "jpeg" ? "jpg" : "png"}`,
        ),
      };
    },
    async copyPhoto() {
      await wait(150);
    },
    async showInFolder(path) {
      console.info("[mock] show in folder:", path);
    },
    async openUrl(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    pickFiles({ multiple }) {
      return new Promise<string[]>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png,image/webp";
        input.multiple = multiple;
        input.onchange = () => resolve(Array.from(input.files ?? []).map((f) => URL.createObjectURL(f)));
        input.oncancel = () => resolve([]);
        input.click();
      });
    },
    async pickFolder() {
      return "~/Pictures/Aaina Photos";
    },

    // Connection and settings
    async connection() {
      return conn;
    },
    async checkKey() {
      await wait(800);
      return conn;
    },
    async setKey(key) {
      await wait(1100);
      const trimmed = key.trim();
      const last4 = trimmed.slice(-4);
      const status: Connection["key"]["status"] =
        !/^sk-/.test(trimmed) || trimmed.length < 20 || /refused/i.test(trimmed)
          ? "refused"
          : /verify/i.test(trimmed)
            ? "verify-organization"
            : /credit/i.test(trimmed)
              ? "out-of-credit"
              : "works";
      conn = { ...conn, key: { present: true, last4, status } };
      return saveConn();
    },
    async removeKey() {
      conn = { ...conn, key: { present: false, last4: null, status: "unknown" } };
      return saveConn();
    },
    async signInWithChatGPT() {
      await wait(1500);
      conn = { ...conn, chatgpt: { signedIn: true, email: "you@example.com", plan: "Plus" } };
      return saveConn();
    },
    async signOutChatGPT() {
      conn = { ...conn, chatgpt: { signedIn: false, email: null, plan: null } };
      return saveConn();
    },
    async settings() {
      return settings;
    },
    async updateSettings(patch) {
      settings = { ...settings, ...patch };
      saveSettings();
      pump();
      return settings;
    },
    async appVersion() {
      return "1.0.0";
    },
    async backup(folder) {
      await wait(900);
      return `${folder}/aaina-backup.zip`;
    },
    async restore() {
      await wait(900);
    },
    async deleteEverything() {
      shoots.clear();
      photos.clear();
      products.clear();
      queue.length = 0;
      emit("shoot");
    },
  };
  return api;
}
