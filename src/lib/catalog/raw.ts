// The shapes Aaina publishes on its CDN (https://static.aaina.world/catalog/…). Only the fields the app reads.
export const CDN_BASE = "https://static.aaina.world/catalog/";

export type RawPointer = {
  schema: string;
  publishedAt: string;
  lists: { models: string; scenes: string; poses: Record<string, string> };
};

export type RawModelPhoto = {
  angle: string;
  imageUrl: string;
  sha256?: string;
  status?: string;
  available?: boolean;
  galleryHidden?: boolean;
  title?: string;
};
export type RawModel = {
  id: string;
  name: string;
  minor?: boolean;
  previewImageUrl?: string | null;
  faceImageUrl?: string | null;
  gender?: string | null;
  ageGroup?: string | null;
  age?: number | null;
  look?: string | null;
  body?: string | null;
  tags?: string[];
  appearance?: string | null;
  suits?: Record<string, [number, number]>;
  photos?: RawModelPhoto[];
  poolKey?: string | null;
  sharedPoses?: boolean;
};
/** `pools` maps a pool key to the suits of its best model: pooled models carry no suits of their own. */
export type RawModels = { schema: string; items: RawModel[]; pools?: Record<string, Record<string, [number, number]>> };

export type RawPose = {
  id: string;
  title: string;
  imageUrl: string;
  prompt?: string; // studio poses: the direction in words
  pose?: string; // Aaina's bank: the direction in words
  angle?: string;
  facing?: string;
  modelId?: string;
  bestFor?: string[];
  alsoWorksFor?: string[];
  creativeTags?: string[];
  framing?: string;
  crop?: string;
  mine?: boolean;
  generationAvailable?: boolean;
  shownOn?: { modelId: string; name: string } | null;
};
/** `looks` are Aaina's original bank; `studio` are studio poses (a pooled list holds many models' poses). */
export type RawPoses = { schema: string; modelId: string; looks: RawPose[]; studio: RawPose[] };

export type RawScene = {
  id: string;
  title: string;
  imageUrl: string;
  bestFor?: string[];
  alsoWorksFor?: string[];
  creativeTags?: string[];
  region?: string | null;
  selectionAvailable?: boolean;
};
export type RawScenes = { schema: string; items: RawScene[] };

export type RawSheetsPointer = { schema: string; publishedAt: string; list: string; count: number };
export type RawSheet = { modelId: string; sha256: string; width: number; height: number; url: string };
export type RawSheets = { schema: string; items: RawSheet[] };
