import type { Api, Gender, ModelRef, OwnModel } from "../contract";
import type { DataLayer } from "../data";
import { mimeOf } from "../engine";
import type { Works } from "../engine";
import type { Emit } from "./events";
import { short } from "./shoots";
import type { Sources } from "./sources";

const NAME_LENGTH = 40;
const PHOTOS_MIN = 1;
const PHOTOS_MAX = 3;
const AGE_MIN = 18;
const AGE_MAX = 90;
const NO_SHEET_YET = "Your model's sheet isn't ready yet.";

type Adult = "woman" | "man";
type Traits = Parameters<Works["makeFaces"]>[0];

/** Own models are adults only. */
function adultGender(gender: Gender): Adult {
  if (gender !== "woman" && gender !== "man") throw new Error("Aaina Desktop makes adult models only.");
  return gender;
}
function adultAge(age: number): number {
  if (!(age >= AGE_MIN && age <= AGE_MAX)) throw new Error(`Models must be between ${AGE_MIN} and ${AGE_MAX}.`);
  return age;
}

type Deps = {
  data: Pick<DataLayer, "own" | "files">;
  works: Pick<Works, "makeFaces" | "makeSheet" | "checkSheet" | "checkPersonPhoto" | "makePose" | "makeScene">;
  sources: Pick<Sources, "catalogSource">;
  requireKey: () => Promise<void>;
  emit: Emit;
};

export function createOwnApi({
  data,
  works,
  sources,
  requireKey,
  emit,
}: Deps): Pick<
  Api,
  | "ownModels"
  | "ownModel"
  | "createOwnModelFromWords"
  | "createOwnModelFromPhotos"
  | "chooseFace"
  | "remakeSheet"
  | "renameOwnModel"
  | "deleteOwnModel"
  | "ownPoses"
  | "makePose"
  | "ownScenes"
  | "makeScene"
> {
  /** Runs work the customer isn't waiting on: `fail` records a failure, and screens are told either way. */
  async function inBackground(work: () => Promise<void>, fail: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch {
      await fail().catch(() => undefined);
    } finally {
      emit({ type: "own" });
    }
  }

  const facePath = (modelId: string) => `own-models/${modelId}/face.png`;
  const photoPath = (modelId: string, n: number) => `own-models/${modelId}/photo-${n}.bin`;

  const makeFaces = (id: string, traits: Traits) =>
    inBackground(
      async () => {
        const { faces } = await works.makeFaces(traits);
        if (!faces.length) {
          await data.own.updateModel(id, { status: "failed" });
          return;
        }
        const stored: { id: string; path: string }[] = [];
        for (const [i, face] of faces.entries()) {
          const path = `own-models/${id}/face-${i + 1}.png`;
          await data.files.writeAppFile(path, face);
          stored.push({ id: `face-${i + 1}`, path });
        }
        await data.own.updateModel(id, { faces: stored, status: "choosing-face" });
      },
      () => data.own.updateModel(id, { status: "failed" }),
    );

  /** A check that can't run does not block the customer. */
  async function sheetPasses(png: Uint8Array): Promise<boolean> {
    try {
      return (await works.checkSheet(png)).pass;
    } catch {
      return true;
    }
  }

  const makeSheet = (id: string, pictures: Uint8Array[], traits: { gender: Adult; age: number }) =>
    inBackground(
      async () => {
        const png = await works.makeSheet({ pictures, traits });
        const path = `own-models/${id}/sheet.png`;
        await data.files.writeAppFile(path, png);
        await data.own.updateModel(id, { sheetPath: path, status: (await sheetPasses(png)) ? "ready" : "failed" });
      },
      () => data.own.updateModel(id, { status: "failed" }),
    );

  async function existing(id: string): Promise<OwnModel> {
    const model = await data.own.model(id);
    if (!model) throw new Error("That model is gone.");
    return model;
  }

  /** The reference sheet a new pose is made from. */
  async function sheetOf(model: ModelRef): Promise<{ bytes: Uint8Array; gender: string }> {
    if (model.source === "studio") {
      const studio = await sources.catalogSource.model(model.id);
      if (!studio?.sheetUrl) throw new Error("This model has no reference sheet yet, so it can't make new poses.");
      return { bytes: await sources.catalogSource.pictureBytes(studio.sheetUrl), gender: studio.gender ?? "woman" };
    }
    const own = await data.own.model(model.id);
    if (!own?.sheetPath) throw new Error(NO_SHEET_YET);
    return { bytes: await data.files.readAppFile(own.sheetPath), gender: own.gender };
  }

  const nameOrDefault = (name: string) => name.trim() || "My model";

  return {
    ownModels: () => data.own.models(),
    ownModel: (id) => data.own.model(id),

    async createOwnModelFromWords(input) {
      await requireKey();
      const gender = adultGender(input.gender);
      const age = adultAge(input.age);
      const traits: Traits = {
        gender,
        age,
        look: input.look ?? null,
        body: input.body ?? null,
        hair: input.hair ?? null,
        extra: input.words?.trim() || null,
      };
      const hair = input.hair?.trim().toLowerCase();
      const appearance = [input.look?.replace(/_/g, " "), `${gender} aged ${age}`, hair && (/\bhair\b/.test(hair) ? hair : `${hair} hair`)]
        .filter(Boolean)
        .join(", ");
      const model = await data.own.createModel({
        name: nameOrDefault(input.name),
        gender,
        age,
        look: input.look ?? null,
        body: input.body ?? null,
        appearance,
        madeFrom: "description",
      });
      emit({ type: "own", id: model.id });
      void makeFaces(model.id, traits);
      return model;
    },

    async createOwnModelFromPhotos(input) {
      await requireKey();
      if (input.consent !== true) throw new Error("Please confirm the person agreed to be used as a model.");
      if (input.paths.length < PHOTOS_MIN || input.paths.length > PHOTOS_MAX)
        throw new Error(`Choose ${PHOTOS_MIN} to ${PHOTOS_MAX} photos.`);
      const pictures = await Promise.all(input.paths.map((path) => data.files.readAbsolute(path)));
      if (pictures.some((bytes) => !mimeOf(bytes))) throw new Error("Use JPEG, PNG or WebP photos.");
      // The first photo (a front view) says who the person is; the others only have to be usable.
      const checks = [];
      for (const [i, picture] of pictures.entries()) {
        const check = await works.checkPersonPhoto(picture, i === 0 ? "front" : "other");
        if (check.problem) throw new Error(`Photo ${i + 1}: ${check.problem}`);
        checks.push(check);
      }
      const { gender, age } = checks[0];
      const model = await data.own.createModel({
        name: nameOrDefault(input.name),
        gender,
        age,
        appearance: `${gender} aged ${age}`,
        madeFrom: "photos",
        status: "making-sheet",
      });
      for (const [i, picture] of pictures.entries()) await data.files.writeAppFile(photoPath(model.id, i + 1), picture);
      emit({ type: "own", id: model.id });
      void makeSheet(model.id, pictures, { gender, age });
      return model;
    },

    async chooseFace(ownModelId, faceId) {
      await requireKey();
      const faces = await data.own.storedFaces(ownModelId);
      const chosen = faces.find((face) => face.id === faceId);
      const model = await data.own.model(ownModelId);
      if (!chosen || !model) throw new Error("Choose one of the three faces.");
      const bytes = await data.files.readAppFile(chosen.path);
      await data.files.writeAppFile(facePath(ownModelId), bytes);
      for (const face of faces) await data.files.removeApp(face.path);
      const updated = await data.own.updateModel(ownModelId, { faces: [], status: "making-sheet" });
      emit({ type: "own", id: ownModelId });
      void makeSheet(ownModelId, [bytes], { gender: adultGender(model.gender), age: model.age });
      return updated;
    },

    async remakeSheet(ownModelId) {
      await requireKey();
      const model = await existing(ownModelId);
      const candidates = model.madeFrom === "photos" ? [1, 2, 3].map((n) => photoPath(ownModelId, n)) : [facePath(ownModelId)];
      const pictures: Uint8Array[] = [];
      for (const path of candidates) if (await data.files.appFileExists(path)) pictures.push(await data.files.readAppFile(path));
      if (!pictures.length) throw new Error("The pictures this model was made from are gone. Make a new model.");
      const updated = await data.own.updateModel(ownModelId, { status: "making-sheet" });
      emit({ type: "own", id: ownModelId });
      void makeSheet(ownModelId, pictures, { gender: adultGender(model.gender), age: model.age });
      return updated;
    },

    async renameOwnModel(id, name) {
      const model = await data.own.updateModel(id, { name: nameOrDefault(name) });
      emit({ type: "own", id });
      return model;
    },

    async deleteOwnModel(id) {
      const ref: ModelRef = { source: "own", id };
      for (const pose of await data.own.poses(ref)) {
        const image = await data.own.poseImagePath(pose.id);
        if (image) await data.files.removeApp(image);
      }
      await data.own.removePosesOf(ref);
      await data.own.removeModel(id);
      await data.files.removeApp(`own-models/${id}`);
      emit({ type: "own" });
    },

    ownPoses: (model) => data.own.poses(model),

    async makePose(input) {
      await requireKey();
      const words = input.words?.trim() || null;
      if (!words && !input.referencePath) throw new Error("Describe the pose or add a photo.");
      const sheet = await sheetOf(input.model);
      const reference = input.referencePath ? await data.files.readAbsolute(input.referencePath) : null;
      const pose = await data.own.createPose({ name: short(words ?? "Pose from my photo", NAME_LENGTH), words, model: input.model });
      emit({ type: "own", id: pose.id });
      void inBackground(
        async () => {
          const png = await works.makePose({ sheet: sheet.bytes, gender: sheet.gender, words: input.words, reference });
          const path = `poses/${pose.id}.png`;
          await data.files.writeAppFile(path, png);
          await data.own.finishPose(pose.id, { imagePath: path });
        },
        () => data.own.finishPose(pose.id, { failed: true }),
      );
      return pose;
    },

    ownScenes: () => data.own.scenes(),

    async makeScene(input) {
      await requireKey();
      const words = input.words.trim() || null;
      if (!words && !input.referencePath) throw new Error("Describe the scene or add a photo.");
      const reference = input.referencePath ? await data.files.readAbsolute(input.referencePath) : null;
      const scene = await data.own.createScene({ name: short(words ?? "Scene from my photo", NAME_LENGTH), words });
      emit({ type: "own", id: scene.id });
      void inBackground(
        async () => {
          const png = await works.makeScene({ words: words ?? "A place like the one in my photo", reference });
          const path = `scenes/${scene.id}.png`;
          await data.files.writeAppFile(path, png);
          await data.own.finishScene(scene.id, { imagePath: path });
        },
        () => data.own.finishScene(scene.id, { failed: true }),
      );
      return scene;
    },
  };
}
