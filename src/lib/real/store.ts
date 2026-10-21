import type { DataLayer } from "../data";
import type { EngineStore } from "../engine";

/** Lets the photo queue use the repositories without knowing about them. */
export function createEngineStore(data: Pick<DataLayer, "photos" | "shoots" | "products" | "files" | "settings">): EngineStore {
  return {
    queued: (limit) => data.photos.queued(limit),
    photo: (id) => data.photos.get(id),
    shoot: (id) => data.shoots.get(id),
    product: (id) => data.products.get(id),
    shootPhotos: (shootId) => data.photos.forShoot(shootId),
    markSending: (id) => data.photos.markSending(id),
    async saveDone(photo, shoot, png, size) {
      const path = await data.files.writePhotoFile(await data.settings.photosFolder(), shoot.name, photo.title, photo.version, png);
      await data.photos.markDone(photo.id, { path, width: size.width, height: size.height });
    },
    markFailed: (id, error) => data.photos.markFailed(id, error),
    markInterrupted: (id, error) => data.photos.markInterrupted(id, error),
    readProductPhoto: (path) => data.files.readAppFile(path),
    async readPhotoFile(photo) {
      if (!photo.path) throw new Error("That photo isn't finished.");
      const root = (await data.photos.rootOf(photo.id)) ?? (await data.settings.photosFolder());
      return data.files.readAbsolute(await data.files.join(root, photo.path));
    },
  };
}
