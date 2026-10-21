// The narrow interfaces the engine needs from the data layer and the catalogue. real/ adapts the real repositories to these;
// tests use in-memory fakes. The engine never imports Tauri plugins for data.
import type { CatalogModel, CatalogPose, CatalogScene, ModelRef, Photo, Product, Shoot } from "../contract";

export interface EngineStore {
  /** Oldest queued photos first. */
  queued(limit: number): Promise<Photo[]>;
  photo(id: string): Promise<Photo | null>;
  shoot(id: string): Promise<Shoot | null>;
  product(id: string): Promise<Product | null>;
  shootPhotos(shootId: string): Promise<Photo[]>;
  /** Saved BEFORE the paid request. */
  markSending(id: string): Promise<void>;
  /** Writes the PNG into the photos folder and marks the photo done. */
  saveDone(photo: Photo, shoot: Shoot, png: Uint8Array, size: { width: number; height: number }): Promise<void>;
  /** Refused or unusable answer. */
  markFailed(id: string, error: NonNullable<Photo["error"]>): Promise<void>;
  /** Lost while sending: may have been charged, never resent automatically. */
  markInterrupted(id: string, error: NonNullable<Photo["error"]>): Promise<void>;
  /** A product photo's bytes (path as stored on the product). */
  readProductPhoto(path: string): Promise<Uint8Array>;
  /** A finished photo's bytes (for Fix something, Other colours, ghost angles). */
  readPhotoFile(photo: Photo): Promise<Uint8Array>;
}

export interface CatalogSource {
  model(id: string): Promise<CatalogModel | null>;
  pose(model: ModelRef, poseId: string): Promise<CatalogPose | null>;
  scene(id: string): Promise<CatalogScene | null>;
  /** The bytes of a catalogue picture (card, pose, scene or sheet address). */
  pictureBytes(address: string): Promise<Uint8Array>;
}

export interface OwnSource {
  model(
    id: string,
  ): Promise<{ id: string; name: string; gender: "woman" | "man" | "girl" | "boy"; appearance: string; sheetPath: string | null } | null>;
  pose(id: string): Promise<{ words: string | null; imagePath: string | null } | null>;
  scene(id: string): Promise<{ imagePath: string | null } | null>;
  /** A file under the app data folder (relative path). */
  readFile(relative: string): Promise<Uint8Array>;
}
