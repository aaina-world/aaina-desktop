import type { CatalogModel, CatalogPose, CatalogScene, Gender } from "../contract";
import type { RawModel, RawModels, RawPose, RawScene, RawSheet } from "./raw";

// Pure mapping from the CDN's JSON to the app's contract types. `show` turns a CDN-relative picture path into something
// displayable (the CDN, or the cached copy).
export type Show = (relative: string) => string;

/** The studio's styles a pose or scene may be tagged with; its other creative tags (studio, clean…) are not styles. */
const STYLES = new Set(["catalogue", "casual", "editorial", "streetwear", "formal", "ethnic", "party", "sporty"]);
const styleOf = (tags: string[] | undefined) => (tags ?? []).filter((tag) => STYLES.has(tag)).slice(0, 3);

const GENDERS = new Set(["woman", "man", "girl", "boy"]);

/** Scenes that are just a plain white or grey studio. */
const PLAIN_SCENES = new Set(["loc_pose_bank_white_room", "loc_pure_white_cyclorama", "loc_light_grey_seamless"]);

export function mapModel(raw: RawModel, pools: RawModels["pools"], sheet: RawSheet | undefined, show: Show): CatalogModel {
  const photos = (raw.photos ?? []).filter((photo) => photo.available !== false && photo.status !== "rejected");
  const sheetPhoto = photos.find((photo) => photo.angle === "sheet");
  const poolKey = raw.poolKey ?? null;
  const preview = raw.previewImageUrl ?? photos.find((photo) => photo.angle !== "sheet")?.imageUrl ?? sheetPhoto?.imageUrl ?? null;
  // A sheet model's preview is its six-photo sheet; its face picture makes a better card.
  const card = preview && sheetPhoto && preview === sheetPhoto.imageUrl && raw.faceImageUrl ? raw.faceImageUrl : preview;
  const sheetPath = sheet?.url ?? null;
  return {
    id: raw.id,
    name: raw.name,
    gender: GENDERS.has(raw.gender ?? "") ? (raw.gender as Gender) : null,
    ageGroup: raw.ageGroup ?? null,
    age: raw.age ?? null,
    look: raw.look ?? null,
    body: raw.body ?? null,
    tags: raw.tags ?? [],
    appearance: raw.appearance ?? null,
    minor: Boolean(raw.minor),
    cardUrl: card ? show(card) : "",
    faceUrl: raw.faceImageUrl ? show(raw.faceImageUrl) : null,
    sheetUrl: sheetPath ? show(sheetPath) : sheetPhoto ? show(sheetPhoto.imageUrl) : null,
    photoUrls: photos.filter((photo) => photo.angle !== "sheet").map((photo) => show(photo.imageUrl)),
    poolKey,
    suits: raw.suits ?? (poolKey ? (pools?.[poolKey] ?? null) : null),
  };
}

export function mapModels(raw: RawModels, sheets: Map<string, RawSheet>, show: Show): CatalogModel[] {
  return raw.items.map((item) => mapModel(item, raw.pools, sheets.get(item.id), show));
}

export function mapPose(raw: RawPose, listModelId: string, show: Show): CatalogPose {
  return {
    id: raw.id,
    name: raw.title,
    imageUrl: show(raw.imageUrl),
    modelId: raw.modelId ?? (listModelId.startsWith("pool:") ? null : listModelId),
    shownOn: raw.shownOn ?? null,
    best: raw.bestFor ?? [],
    also: raw.alsoWorksFor ?? [],
    style: styleOf(raw.creativeTags),
    framing: raw.crop ?? raw.framing ?? null,
    direction: raw.prompt ?? raw.pose ?? null,
    angle: raw.angle ?? raw.facing ?? null,
  };
}

/** The poses of one list: Aaina's bank first (only the ones that can be made), then studio poses; never customers' own. */
export function mapPoses(looks: RawPose[], studio: RawPose[], listModelId: string, show: Show): CatalogPose[] {
  return [...looks.filter((pose) => pose.generationAvailable !== false), ...studio.filter((pose) => !pose.mine)].map((pose) =>
    mapPose(pose, listModelId, show),
  );
}

export function mapScene(raw: RawScene, show: Show): CatalogScene {
  return {
    id: raw.id,
    name: raw.title,
    imageUrl: show(raw.imageUrl),
    bestFor: raw.bestFor ?? [],
    also: raw.alsoWorksFor ?? [],
    style: styleOf(raw.creativeTags),
    region: raw.region && raw.region !== "anywhere" ? raw.region : null,
    plain: PLAIN_SCENES.has(raw.id),
  };
}

export const mapScenes = (items: RawScene[], show: Show) =>
  items.filter((scene) => scene.selectionAvailable !== false).map((scene) => mapScene(scene, show));
