import type { Api, Expression, Frame, ModelRef, Photo, Shoot, ShotPlan } from "../contract";
import type { DataLayer } from "../data";
import { estimateFor } from "../engine";
import type { Queue } from "../engine";
import { FLAT_LAY_TITLE, GHOST_ANGLE_NAME } from "../labels";
import type { Emit } from "./events";
import type { Sources } from "./sources";

const MAX_COLOURS = 6;
const MAX_FIX_WORDS = 500;
const TITLE_LENGTH = 40;

/** Text cut to `n` characters, ending with an ellipsis when it was longer. */
export const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

/** A model shot with the frame and expression the customer picked on Make again (other kinds are unchanged). */
const changedShot = (shot: ShotPlan, options?: { frame?: Frame; expression?: Expression }): ShotPlan =>
  shot.kind === "model" && options
    ? { ...shot, frame: options.frame ?? shot.frame, expression: options.expression ?? shot.expression }
    : shot;

type Deps = {
  data: Pick<DataLayer, "shoots" | "photos" | "products" | "own" | "files" | "settings">;
  queue: Pick<Queue, "kick">;
  sources: Pick<Sources, "catalogSource">;
  requireKey: () => Promise<void>;
  emit: Emit;
};

export function createShootsApi({
  data,
  queue,
  sources,
  requireKey,
  emit,
}: Deps): Pick<
  Api,
  | "shoots"
  | "shoot"
  | "createShoot"
  | "updateShoot"
  | "deleteShoot"
  | "photos"
  | "photo"
  | "recentPhotos"
  | "makeShoot"
  | "makeAgain"
  | "tryAgain"
  | "fixPhoto"
  | "otherColours"
  | "deletePhoto"
> {
  async function poseTitle(model: ModelRef | null, pose: Extract<ShotPlan, { kind: "model" }>["pose"]) {
    if (pose.source === "words") return { key: `words:${short(pose.words, TITLE_LENGTH)}`, title: short(pose.words, TITLE_LENGTH) };
    if (pose.source === "own") return { key: `own:${pose.id}`, title: (await data.own.pose(pose.id))?.name ?? "Your pose" };
    const found = model ? await sources.catalogSource.pose(model, pose.id) : null;
    return { key: `studio:${pose.id}`, title: found?.name ?? "Pose" };
  }

  /** The key (shared by all versions of the shot) and the title a planned shot is queued with. */
  async function describeShot(shot: ShotPlan, model: ModelRef | null): Promise<{ key: string; title: string }> {
    switch (shot.kind) {
      case "model": {
        const { key, title } = await poseTitle(model, shot.pose);
        return { key: `${key}|${shot.frame}|${shot.expression}`, title };
      }
      case "flat-lay":
        return {
          key: `flatlay:${shot.style}:${shot.side}`,
          title: `${FLAT_LAY_TITLE[shot.style]}${shot.side === "back" ? ", back" : ""}`,
        };
      case "ghost":
        return { key: `ghost:${shot.angle}`, title: `${GHOST_ANGLE_NAME[shot.angle]} view` };
    }
  }

  async function shootOf(photo: Photo): Promise<Shoot> {
    const shoot = await data.shoots.get(photo.shootId);
    if (!shoot) throw new Error("That shoot is gone.");
    return shoot;
  }

  async function photoOf(id: string): Promise<Photo> {
    const photo = await data.photos.get(id);
    if (!photo) throw new Error("That photo is gone.");
    return photo;
  }

  /** Queues a new version of `photo`'s shot. Nothing is sent until the queue picks it up. */
  async function queueVersion(
    photo: Photo,
    shoot: Shoot,
    extra: { shot?: ShotPlan; change?: Photo["change"]; parentId?: string | null; work?: "photo" | "edit" },
  ): Promise<Photo> {
    return data.photos.insertQueued({
      shootId: photo.shootId,
      shotKey: photo.shotKey,
      shot: extra.shot ?? photo.shot,
      title: photo.title,
      parentId: extra.parentId,
      change: extra.change,
      estimateUsd: estimateFor(shoot.quality, extra.work ?? "photo"),
    });
  }

  async function finishedPhotoOf(id: string, what: string): Promise<Photo> {
    const photo = await data.photos.get(id);
    if (!photo || photo.status !== "done") throw new Error(`Only a finished photo can ${what}.`);
    return photo;
  }

  return {
    shoots: (filter) => data.shoots.list(filter),
    shoot: (id) => data.shoots.get(id),
    async createShoot({ kind, productId }) {
      const product = await data.products.get(productId);
      if (!product) throw new Error("That product is gone.");
      return data.shoots.create({ kind, productId, name: product.name, quality: (await data.settings.get()).quality });
    },
    updateShoot: (id, patch) => data.shoots.update(id, patch),
    async deleteShoot(id) {
      const files = await data.photos.filesOf("shoot", id);
      await data.shoots.remove(id);
      for (const file of files) await data.files.removePhotoFile(file.root, file.path);
      emit({ type: "shoot", id });
    },
    photos: (shootId) => data.photos.forShoot(shootId),
    photo: (id) => data.photos.get(id),
    recentPhotos: (limit) => data.photos.recent(limit),

    async makeShoot(id) {
      await requireKey();
      const shoot = await data.shoots.get(id);
      if (!shoot) throw new Error("That shoot is gone.");
      if (!shoot.plan.length) throw new Error("Choose what to make first.");
      if (shoot.kind === "model" && !shoot.model) throw new Error("Choose a model first.");
      const made: Photo[] = [];
      for (const shot of shoot.plan) {
        const { key, title } = await describeShot(shot, shoot.model);
        made.push(
          await data.photos.insertQueued({ shootId: id, shotKey: key, shot, title, estimateUsd: estimateFor(shoot.quality, "photo") }),
        );
      }
      await data.shoots.markStarted(id);
      emit({ type: "shoot", id });
      void queue.kick();
      return made;
    },

    async makeAgain(photoId, note, options) {
      await requireKey();
      const photo = await photoOf(photoId);
      const trimmed = note?.trim();
      const next = await queueVersion(photo, await shootOf(photo), {
        shot: changedShot(photo.shot, options),
        change: { kind: "again", ...(trimmed ? { note: trimmed } : {}) },
      });
      void queue.kick();
      return next;
    },

    async tryAgain(photoId) {
      await requireKey();
      const photo = await photoOf(photoId);
      if (photo.status === "failed") {
        await data.photos.requeue(photoId);
        void queue.kick();
        return photoOf(photoId);
      }
      // Anything else could be on its way to OpenAI or already paid for; only an interrupted photo may be asked for again.
      if (photo.status !== "interrupted") throw new Error("Only a photo that didn't work can be tried again.");
      // It may have been charged, but the customer chose to ask again: a new version, and the old one stays.
      const next = await queueVersion(photo, await shootOf(photo), { parentId: photo.parentId, change: photo.change });
      void queue.kick();
      return next;
    },

    async fixPhoto(photoId, words) {
      await requireKey();
      const parent = await finishedPhotoOf(photoId, "be fixed");
      const text = words
        .replace(/[\u0000-\u001f]+/g, " ")
        .trim()
        .slice(0, MAX_FIX_WORDS);
      if (!text) throw new Error("Say what to fix.");
      const next = await queueVersion(parent, await shootOf(parent), {
        parentId: parent.id,
        change: { kind: "fix", words: text },
        work: "edit",
      });
      void queue.kick();
      return next;
    },

    async otherColours(photoId, colours) {
      await requireKey();
      const parent = await finishedPhotoOf(photoId, "change colour");
      const shoot = await shootOf(parent);
      const made: Photo[] = [];
      for (const colour of colours.slice(0, MAX_COLOURS)) {
        made.push(
          await data.photos.insertQueued({
            shootId: parent.shootId,
            shotKey: `${parent.shotKey}|colour:${colour.hex.toLowerCase()}`,
            shot: parent.shot,
            title: `${parent.title}, ${colour.name}`,
            parentId: parent.id,
            change: { kind: "colour", hex: colour.hex, name: colour.name },
            estimateUsd: estimateFor(shoot.quality, "edit"),
          }),
        );
      }
      void queue.kick();
      return made;
    },

    async deletePhoto(photoId) {
      const file = await data.photos.remove(photoId);
      if (file) await data.files.removePhotoFile(file.root, file.path);
      emit({ type: "photo", id: photoId });
    },
  };
}
