// The one contract between the screens (src/ui), the data layer (src/lib/data, src/lib/catalog) and the photo engine
// (src/lib/engine). Screens only ever call `Api` (src/lib/api.ts picks the real one inside the app and the mock one in a
// plain browser). Change this file only by agreement: every part builds against it.

// ---------- Catalogue (read-only, from Aaina's public CDN, cached on disk) ----------

export type Gender = "woman" | "man" | "girl" | "boy";
export type CatalogModel = {
  id: string;
  name: string;
  gender: Gender | null;
  ageGroup: string | null; // "adult" | "kids" | "teen" | "baby" … as Aaina publishes it
  age: number | null;
  look: string | null;
  body: string | null;
  tags: string[]; // modest, maternity, adaptive, supermodel
  appearance: string | null; // one line, e.g. "young Indian woman, age 26, with long straight black hair"
  minor: boolean;
  cardUrl: string; // displayable URL of the card picture (CDN, or asset: URL once cached)
  faceUrl: string | null;
  sheetUrl: string | null; // the full 6-photo reference sheet, when published
  photoUrls: string[]; // older models without a sheet: their approved reference photos
  poolKey: string | null; // poses come from this shared pool when set
  suits: Record<string, [number, number]> | null;
};

export type CatalogPose = {
  id: string;
  name: string;
  imageUrl: string; // displayable
  modelId: string | null; // model the pose was made on
  shownOn: { modelId: string; name: string } | null; // pooled pose made on another model
  best: string[]; // product types it was made for
  also: string[];
  style: string[];
  framing: string | null;
  direction?: string | null; // the pose in words, sent with the pose picture
  angle?: string | null; // front, three-quarter, side, back
};

export type CatalogScene = {
  id: string;
  name: string;
  imageUrl: string; // displayable
  bestFor: string[];
  also: string[];
  style: string[];
  region: string | null;
  plain: boolean; // White studio / plain grey
};

export type CatalogStatus = {
  state: "ready" | "loading" | "offline" | "never-loaded";
  publishedAt: string | null;
  checkedAt: string | null;
  modelCount: number;
  cacheBytes: number;
  progress?: { done: number; total: number };
};

// ---------- Your things (kept on this computer) ----------

export type PhotoRole = "front" | "back" | "detail";
export type ProductPhoto = { id: string; path: string; url: string; role: PhotoRole; width: number; height: number };

/** What the product reading says, editable by the seller. */
export type ProductReading = {
  productType: string | null; // a POSE_CATEGORIES key when known, e.g. "crewneck_tshirts"
  label: string; // "T-shirt"
  audience: "women" | "men" | "girls" | "boys" | "babies" | "unisex" | null;
  colour: string | null;
  material: string | null;
  details: string | null; // one short line of visible details (print, buttons…)
  reach: "upper" | "lower" | "full" | "feet" | "accessory" | null; // which part of the body it covers
  readBy: "chatgpt" | "key" | "seller";
  readAt: string;
};

export type Product = {
  id: string;
  name: string;
  photos: ProductPhoto[];
  reading: ProductReading | null;
  createdAt: string;
  updatedAt: string;
};

export type OwnModel = {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  look: string | null;
  body: string | null;
  appearance: string; // one line used in prompts
  madeFrom: "description" | "photos";
  status: "draft" | "choosing-face" | "making-sheet" | "ready" | "failed";
  faceOptions: { id: string; url: string }[];
  sheetUrl: string | null;
  sheetPath: string | null;
  createdAt: string;
};

export type OwnPose = {
  id: string;
  name: string;
  words: string | null;
  imageUrl: string;
  modelRef: ModelRef;
  createdAt: string;
  status: "making" | "ready" | "failed";
};
export type OwnScene = {
  id: string;
  name: string;
  words: string | null;
  imageUrl: string;
  createdAt: string;
  status: "making" | "ready" | "failed";
};

export type ModelRef = { source: "studio" | "own"; id: string };
export type PoseRef = { source: "studio"; id: string } | { source: "own"; id: string } | { source: "words"; words: string };
export type SceneRef = { source: "studio"; id: string } | { source: "own"; id: string } | { source: "colour"; hex: string; name: string };

export type Frame = "as-posed" | "full-length" | "head-to-knee" | "waist-up" | "close-up";
export type Expression = "as-posed" | "neutral" | "soft-smile" | "big-smile" | "serious" | "looking-away";
export type Quality = "standard" | "high";
export type ShootKind = "model" | "flat-lay" | "ghost";
export type FlatLayStyle = "clean" | "folded" | "styled";
export type GhostAngle = "front" | "three-quarter" | "side" | "back-three-quarter" | "back";

/** One planned photo in a shoot (a pose with its options, a flat-lay style, or a ghost angle). */
export type ShotPlan =
  | { kind: "model"; pose: PoseRef; frame: Frame; expression: Expression }
  | { kind: "flat-lay"; style: FlatLayStyle; side: "front" | "back" }
  | { kind: "ghost"; angle: GhostAngle };

export type Shoot = {
  id: string;
  name: string; // product name by default; renamable
  kind: ShootKind;
  productId: string;
  model: ModelRef | null;
  scene: SceneRef | null;
  quality: Quality;
  plan: ShotPlan[]; // the draft's choices; kept after making
  status: "draft" | "making" | "done";
  draftStep: "product" | "model" | "poses" | "scene" | "review" | null;
  coverUrl: string | null;
  photoCount: number;
  /** Distinct shots with a finished photo, and photos that failed or were interrupted (filled by real/ and mock/ from the photos). */
  readyCount?: number;
  failedCount?: number;
  createdAt: string;
  updatedAt: string;
};

/** A made (or being made) photo. Versions of one shot share `shotKey`; edits point to `parentId`. */
export type PhotoStatus =
  | "queued" // waiting its turn on this computer; nothing sent
  | "sending" // sent to OpenAI; it may charge from here on
  | "done"
  | "failed" // OpenAI refused or answered nothing usable; not charged when refused
  | "interrupted"; // the app closed or the network dropped while sending: may have been charged; never resent automatically
export type Photo = {
  id: string;
  shootId: string;
  shotKey: string; // stable per planned shot, e.g. pose id + frame + expression
  shot: ShotPlan;
  title: string; // pose name, flat-lay style or ghost angle in words
  version: number; // 1, 2 … within the shot
  parentId: string | null; // for Fix something / Other colours
  change:
    { kind: "new" } | { kind: "again"; note?: string } | { kind: "fix"; words: string } | { kind: "colour"; hex: string; name: string };
  status: PhotoStatus;
  error: { code: PhotoErrorCode; message: string; charged: "no" | "maybe" } | null;
  path: string | null; // the PNG on disk once done
  url: string | null; // displayable
  width: number | null;
  height: number | null;
  estimateUsd: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type PhotoErrorCode =
  | "NOT_CONNECTED" // no key / not signed in
  | "KEY_REFUSED" // 401
  | "VERIFY_ORGANIZATION" // OpenAI asks the organisation to verify before images
  | "OUT_OF_CREDIT" // insufficient_quota / billing
  | "RATE_LIMITED" // 429 after our own waiting
  | "CONTENT_REFUSED" // moderation / safety refusal
  | "NETWORK" // no internet before sending
  | "INTERRUPTED" // lost while sending
  | "BAD_ANSWER" // answered but not a usable picture
  | "UNKNOWN";

// ---------- Settings and connection ----------

export type Connection = {
  chatgpt: { signedIn: boolean; email: string | null; plan: string | null };
  key: { present: boolean; last4: string | null; status: "unknown" | "works" | "refused" | "verify-organization" | "out-of-credit" };
  canRead: boolean; // product readings possible (ChatGPT or key)
  canMakePhotos: boolean; // photos possible (key, until ChatGPT plans can make images)
};

export type Settings = {
  onboarded: boolean;
  photosFolder: string; // absolute path; default <Pictures>/Aaina
  quality: Quality;
  parallel: 1 | 2 | 3 | 4;
  saveFormat: "jpeg" | "png";
  theme: "system" | "light" | "dark";
  notifyWhenReady: boolean;
  offlineCatalogue: boolean;
  autoUpdate: boolean;
  pins: { models: string[]; poses: string[]; scenes: string[] };
};

/** Rough OpenAI prices in US dollars shown before paid actions (never "credits"). */
export const ESTIMATE_USD = {
  photo: { standard: 0.05, high: 0.2 },
  reading: 0.002,
  edit: 0.05,
  pose: 0.04,
  scene: 0.04,
  faces: 0.15,
  sheet: 0.2,
} as const;

// ---------- Save ----------

export type SaveShape = "original" | "square" | "portrait-4x5" | "tall-3x4" | "landscape-4x3" | "white-square";
export type SaveRequest = { photoIds: string[]; format: "jpeg" | "png"; shape: SaveShape; folder: string; fileName?: string };

// ---------- The API every screen uses ----------

export type Unsubscribe = () => void;

export interface Api {
  // Catalogue
  catalogStatus(): Promise<CatalogStatus>;
  refreshCatalog(): Promise<CatalogStatus>;
  /** Deletes cached catalogue pictures and lists (downloaded again when needed). */
  clearCatalogCache(): Promise<CatalogStatus>;
  models(): Promise<CatalogModel[]>;
  posesFor(model: ModelRef): Promise<CatalogPose[]>;
  scenes(): Promise<CatalogScene[]>;
  /** Models in suggestion order for a product (Aaina's own ranking). */
  suggestModels(productId: string | null): Promise<CatalogModel[]>;

  // Products
  products(): Promise<Product[]>;
  product(id: string): Promise<Product | null>;
  createProduct(files: { path: string; role: PhotoRole }[], name?: string): Promise<Product>;
  updateProduct(
    id: string,
    patch: Partial<Pick<Product, "name" | "reading">> & { photos?: { id: string; role: PhotoRole }[] },
  ): Promise<Product>;
  addProductPhotos(id: string, files: { path: string; role: PhotoRole }[]): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  /** Reads the product with ChatGPT or the key. */
  readProduct(id: string): Promise<ProductReading>;

  // Shoots and photos
  shoots(filter?: { kind?: ShootKind | "draft"; q?: string }): Promise<Shoot[]>;
  shoot(id: string): Promise<Shoot | null>;
  createShoot(input: { kind: ShootKind; productId: string }): Promise<Shoot>;
  updateShoot(id: string, patch: Partial<Pick<Shoot, "name" | "model" | "scene" | "quality" | "plan" | "draftStep">>): Promise<Shoot>;
  deleteShoot(id: string): Promise<void>;
  photos(shootId: string): Promise<Photo[]>;
  photo(id: string): Promise<Photo | null>;
  recentPhotos(limit: number): Promise<Photo[]>;
  /** Queues every shot in the shoot's plan. */
  makeShoot(id: string): Promise<Photo[]>;
  /** A new version; `options` replace the shot's frame and expression (model photos only). */
  makeAgain(photoId: string, note?: string, options?: { frame?: Frame; expression?: Expression }): Promise<Photo>;
  tryAgain(photoId: string): Promise<Photo>;
  fixPhoto(photoId: string, words: string): Promise<Photo>;
  otherColours(photoId: string, colours: { hex: string; name: string }[]): Promise<Photo[]>;
  deletePhoto(photoId: string): Promise<void>;
  /** Called whenever any photo, shoot or own item changes (queue progress, finishes, failures). */
  subscribe(listener: (event: { type: "photo" | "shoot" | "catalog" | "own" | "connection"; id?: string }) => void): Unsubscribe;

  // Your own models, poses and scenes
  ownModels(): Promise<OwnModel[]>;
  ownModel(id: string): Promise<OwnModel | null>;
  createOwnModelFromWords(input: {
    name: string;
    gender: Gender;
    age: number;
    look?: string;
    body?: string;
    hair?: string;
    words?: string;
  }): Promise<OwnModel>;
  createOwnModelFromPhotos(input: { name: string; paths: string[]; consent: true; gender?: Gender; age?: number }): Promise<OwnModel>;
  chooseFace(ownModelId: string, faceId: string): Promise<OwnModel>;
  remakeSheet(ownModelId: string): Promise<OwnModel>;
  renameOwnModel(id: string, name: string): Promise<OwnModel>;
  deleteOwnModel(id: string): Promise<void>;
  ownPoses(model?: ModelRef): Promise<OwnPose[]>;
  makePose(input: { model: ModelRef; words?: string; referencePath?: string }): Promise<OwnPose>;
  ownScenes(): Promise<OwnScene[]>;
  makeScene(input: { words: string; referencePath?: string }): Promise<OwnScene>;

  // Save, copy, folders
  savePhotos(request: SaveRequest): Promise<{ paths: string[] }>;
  copyPhoto(photoId: string): Promise<void>;
  showInFolder(path: string): Promise<void>;
  openUrl(url: string): Promise<void>;
  pickFiles(options: { multiple: boolean }): Promise<string[]>;
  pickFolder(): Promise<string | null>;

  // Connection and settings
  connection(): Promise<Connection>;
  setKey(key: string): Promise<Connection>; // checks it with a free call first
  removeKey(): Promise<Connection>;
  signInWithChatGPT(): Promise<Connection>;
  signOutChatGPT(): Promise<Connection>;
  settings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  appVersion(): Promise<string>;
  backup(toFolder: string): Promise<string>;
  restore(zipPath: string): Promise<void>;
  deleteEverything(): Promise<void>;
}
