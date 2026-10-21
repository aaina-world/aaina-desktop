import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Api } from "../contract";
import { photoFileBase, safeName, type DataLayer } from "../data";
import { markAiMade, renderForSave } from "../engine";
import type { EngineStore } from "../engine";

const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const isAbsolute = (path: string) => /^([a-zA-Z]:[\\/]|\/)/.test(path);
const hasExtension = (name: string) => /\.[a-z0-9]+$/i.test(name);

type Deps = {
  data: Pick<DataLayer, "photos" | "files" | "settings">;
  readPhotoFile: EngineStore["readPhotoFile"];
};

/** Saving, copying and showing photos, opening links and the file pickers. */
export function createFilesApi({
  data,
  readPhotoFile,
}: Deps): Pick<Api, "savePhotos" | "copyPhoto" | "showInFolder" | "openUrl" | "pickFiles" | "pickFolder"> {
  return {
    async savePhotos(request) {
      const extension = request.format === "jpeg" ? "jpg" : "png";
      const paths: string[] = [];
      for (const id of request.photoIds) {
        const photo = await data.photos.get(id);
        if (!photo?.path) continue;
        const shaped = await renderForSave(await readPhotoFile(photo), request.shape, request.format);
        const bytes = markAiMade(shaped, request.format, photo.shot.kind === "model");
        const chosen = request.fileName && request.photoIds.length === 1 ? request.fileName : null;
        // Photo titles can hold the customer's own words, so neither name is trusted as a file name.
        const name = chosen ? safeName(chosen, "Photo") : photoFileBase(photo.title, photo.version);
        paths.push(await data.files.writeAbsolute(request.folder, hasExtension(name) ? name : `${name}.${extension}`, bytes));
      }
      return { paths };
    },
    async copyPhoto(photoId) {
      const photo = await data.photos.get(photoId);
      if (!photo?.path) throw new Error("That photo isn't finished.");
      await writeImage(await readPhotoFile(photo));
    },
    async showInFolder(path) {
      await data.files.reveal(isAbsolute(path) ? path : await data.files.join(await data.settings.photosFolder(), path));
    },
    async openUrl(url) {
      if (!/^https?:\/\//i.test(url)) throw new Error("Only web links can be opened.");
      await openUrl(url);
    },
    async pickFiles({ multiple }) {
      const picked = await openDialog({ multiple, directory: false, filters: [{ name: "Photos", extensions: PHOTO_EXTENSIONS }] });
      return picked === null ? [] : Array.isArray(picked) ? picked : [picked];
    },
    async pickFolder() {
      // `recursive`: the app may then write inside the chosen folder too (a backup's sub-folders, a shoot's folder).
      const picked = await openDialog({ directory: true, multiple: false, recursive: true });
      return typeof picked === "string" ? picked : null;
    },
  };
}
