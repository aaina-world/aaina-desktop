import type { Catalog } from "../catalog";
import type { CatalogPose, Gender } from "../contract";
import type { DataLayer } from "../data";
import type { CatalogSource, OwnSource } from "../engine";

type Deps = { catalog: Catalog; data: Pick<DataLayer, "own" | "files"> };

/** What the photo queue and the own-model work read from the catalogue and from the customer's own things. */
export function createSources({ catalog, data }: Deps) {
  /** Poses an own model can use: the studio poses of the first studio model of the same gender that has any (Aaina's shared pool). */
  async function poolPosesFor(gender: Gender): Promise<CatalogPose[]> {
    const models = (await catalog.models()).filter((m) => m.gender === gender && !m.minor && m.poolKey);
    for (const model of models) {
      const poses = await catalog.posesFor({ source: "studio", id: model.id });
      if (poses.length) return poses;
    }
    return [];
  }

  const catalogSource: CatalogSource = {
    model: async (id) => (await catalog.models()).find((m) => m.id === id) ?? null,
    async pose(model, poseId) {
      let poses: CatalogPose[] = [];
      if (model.source === "studio") poses = await catalog.posesFor(model);
      else {
        const own = await data.own.model(model.id);
        if (own) poses = await poolPosesFor(own.gender);
      }
      return poses.find((p) => p.id === poseId) ?? null;
    },
    scene: async (id) => (await catalog.scenes()).find((s) => s.id === id) ?? null,
    pictureBytes: (address) => catalog.pictureBytes(address),
  };

  const ownSource: OwnSource = {
    async model(id) {
      const m = await data.own.model(id);
      return m ? { id: m.id, name: m.name, gender: m.gender, appearance: m.appearance, sheetPath: m.sheetPath } : null;
    },
    async pose(id) {
      const pose = await data.own.pose(id);
      return pose ? { words: pose.words, imagePath: await data.own.poseImagePath(id) } : null;
    },
    async scene(id) {
      return (await data.own.scene(id)) ? { imagePath: await data.own.sceneImagePath(id) } : null;
    },
    readFile: (relative) => data.files.readAppFile(relative),
  };

  return { poolPosesFor, catalogSource, ownSource };
}
export type Sources = ReturnType<typeof createSources>;
