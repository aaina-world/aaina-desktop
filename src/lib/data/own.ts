import type { Gender, ModelRef, OwnModel, OwnPose, OwnScene } from "../contract";
import { fromJson, newId, now, toJson, type Sql } from "./sql";
import type { Urls } from "./urls";

type ModelRow = {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  look: string | null;
  body: string | null;
  appearance: string;
  made_from: OwnModel["madeFrom"];
  status: OwnModel["status"];
  face_options: string;
  sheet_path: string | null;
  created_at: string;
};
type PoseRow = {
  id: string;
  name: string;
  words: string | null;
  image_path: string | null;
  model_source: ModelRef["source"];
  model_id: string;
  status: OwnPose["status"];
  created_at: string;
};
type SceneRow = {
  id: string;
  name: string;
  words: string | null;
  image_path: string | null;
  status: OwnScene["status"];
  created_at: string;
};

/** Face options are stored as `{ id, path }` (relative); the contract shows `{ id, url }`. */
type StoredFace = { id: string; path: string };

export type OwnRepo = ReturnType<typeof createOwnRepo>;

export function createOwnRepo(db: Sql, urls: Urls) {
  const urlOrEmpty = async (path: string | null) => (path ? urls.app(path) : "");

  // ---- models ----
  async function toModel(row: ModelRow): Promise<OwnModel> {
    const faces = fromJson<StoredFace[]>(row.face_options) ?? [];
    return {
      id: row.id,
      name: row.name,
      gender: row.gender,
      age: row.age,
      look: row.look,
      body: row.body,
      appearance: row.appearance,
      madeFrom: row.made_from,
      status: row.status,
      faceOptions: await Promise.all(faces.map(async (face) => ({ id: face.id, url: await urls.app(face.path) }))),
      sheetUrl: row.sheet_path ? await urls.app(row.sheet_path) : null,
      sheetPath: row.sheet_path,
      createdAt: row.created_at,
    };
  }

  const models = async () => Promise.all((await db.select<ModelRow>(`SELECT * FROM own_models ORDER BY created_at DESC`)).map(toModel));
  async function model(id: string): Promise<OwnModel | null> {
    const rows = await db.select<ModelRow>(`SELECT * FROM own_models WHERE id = $1`, [id]);
    return rows[0] ? toModel(rows[0]) : null;
  }

  async function createModel(input: {
    id?: string;
    name: string;
    gender: Gender;
    age: number;
    look?: string | null;
    body?: string | null;
    appearance: string;
    madeFrom: OwnModel["madeFrom"];
    status?: OwnModel["status"];
  }): Promise<OwnModel> {
    const id = input.id ?? newId();
    await db.execute(
      `INSERT INTO own_models (id, name, gender, age, look, body, appearance, made_from, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        input.name,
        input.gender,
        input.age,
        input.look ?? null,
        input.body ?? null,
        input.appearance,
        input.madeFrom,
        input.status ?? "draft",
        now(),
      ],
    );
    return (await model(id))!;
  }

  async function updateModel(
    id: string,
    patch: Partial<{ name: string; status: OwnModel["status"]; faces: StoredFace[]; sheetPath: string | null }>,
  ): Promise<OwnModel> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.name !== undefined) set("name", patch.name);
    if (patch.status !== undefined) set("status", patch.status);
    if (patch.faces !== undefined) set("face_options", toJson(patch.faces));
    if (patch.sheetPath !== undefined) set("sheet_path", patch.sheetPath);
    if (sets.length) {
      params.push(id);
      await db.execute(`UPDATE own_models SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
    }
    return (await model(id))!;
  }

  /** Stored (relative) face picture paths, for choosing one and deleting the rest. */
  const storedFaces = async (id: string) =>
    fromJson<StoredFace[]>(
      (await db.select<{ face_options: string }>(`SELECT face_options FROM own_models WHERE id = $1`, [id]))[0]?.face_options,
    ) ?? [];
  const removeModel = async (id: string) => void (await db.execute(`DELETE FROM own_models WHERE id = $1`, [id]));

  // ---- poses ----
  async function toPose(row: PoseRow): Promise<OwnPose> {
    return {
      id: row.id,
      name: row.name,
      words: row.words,
      imageUrl: await urlOrEmpty(row.image_path),
      modelRef: { source: row.model_source, id: row.model_id },
      createdAt: row.created_at,
      status: row.status,
    };
  }
  async function poses(model?: ModelRef): Promise<OwnPose[]> {
    const rows = model
      ? await db.select<PoseRow>(`SELECT * FROM own_poses WHERE model_source = $1 AND model_id = $2 ORDER BY created_at DESC`, [
          model.source,
          model.id,
        ])
      : await db.select<PoseRow>(`SELECT * FROM own_poses ORDER BY created_at DESC`);
    return Promise.all(rows.map(toPose));
  }
  async function pose(id: string): Promise<OwnPose | null> {
    const rows = await db.select<PoseRow>(`SELECT * FROM own_poses WHERE id = $1`, [id]);
    return rows[0] ? toPose(rows[0]) : null;
  }
  async function createPose(input: { id?: string; name: string; words: string | null; model: ModelRef }): Promise<OwnPose> {
    const id = input.id ?? newId();
    await db.execute(
      `INSERT INTO own_poses (id, name, words, model_source, model_id, status, created_at) VALUES ($1,$2,$3,$4,$5,'making',$6)`,
      [id, input.name, input.words, input.model.source, input.model.id, now()],
    );
    return (await pose(id))!;
  }
  async function finishPose(id: string, result: { imagePath: string } | { failed: true }): Promise<OwnPose> {
    if ("failed" in result) await db.execute(`UPDATE own_poses SET status = 'failed' WHERE id = $1`, [id]);
    else await db.execute(`UPDATE own_poses SET status = 'ready', image_path = $1 WHERE id = $2`, [result.imagePath, id]);
    return (await pose(id))!;
  }
  const poseImagePath = async (id: string) =>
    (await db.select<{ image_path: string | null }>(`SELECT image_path FROM own_poses WHERE id = $1`, [id]))[0]?.image_path ?? null;
  const removePose = async (id: string) => void (await db.execute(`DELETE FROM own_poses WHERE id = $1`, [id]));
  const removePosesOf = async (model: ModelRef) =>
    void (await db.execute(`DELETE FROM own_poses WHERE model_source = $1 AND model_id = $2`, [model.source, model.id]));

  // ---- scenes ----
  async function toScene(row: SceneRow): Promise<OwnScene> {
    return {
      id: row.id,
      name: row.name,
      words: row.words,
      imageUrl: await urlOrEmpty(row.image_path),
      createdAt: row.created_at,
      status: row.status,
    };
  }
  const scenes = async () => Promise.all((await db.select<SceneRow>(`SELECT * FROM own_scenes ORDER BY created_at DESC`)).map(toScene));
  async function scene(id: string): Promise<OwnScene | null> {
    const rows = await db.select<SceneRow>(`SELECT * FROM own_scenes WHERE id = $1`, [id]);
    return rows[0] ? toScene(rows[0]) : null;
  }
  async function createScene(input: { id?: string; name: string; words: string | null }): Promise<OwnScene> {
    const id = input.id ?? newId();
    await db.execute(`INSERT INTO own_scenes (id, name, words, status, created_at) VALUES ($1,$2,$3,'making',$4)`, [
      id,
      input.name,
      input.words,
      now(),
    ]);
    return (await scene(id))!;
  }
  async function finishScene(id: string, result: { imagePath: string } | { failed: true }): Promise<OwnScene> {
    if ("failed" in result) await db.execute(`UPDATE own_scenes SET status = 'failed' WHERE id = $1`, [id]);
    else await db.execute(`UPDATE own_scenes SET status = 'ready', image_path = $1 WHERE id = $2`, [result.imagePath, id]);
    return (await scene(id))!;
  }
  const sceneImagePath = async (id: string) =>
    (await db.select<{ image_path: string | null }>(`SELECT image_path FROM own_scenes WHERE id = $1`, [id]))[0]?.image_path ?? null;
  const removeScene = async (id: string) => void (await db.execute(`DELETE FROM own_scenes WHERE id = $1`, [id]));

  /** Things left "making" when the app closed can never finish: mark them failed (they cost at most one call). */
  async function failUnfinishedOnStart(): Promise<void> {
    await db.execute(`UPDATE own_poses SET status = 'failed' WHERE status = 'making'`);
    await db.execute(`UPDATE own_scenes SET status = 'failed' WHERE status = 'making'`);
    await db.execute(`UPDATE own_models SET status = 'failed' WHERE status IN ('draft', 'making-sheet')`);
  }

  return {
    models,
    model,
    createModel,
    updateModel,
    storedFaces,
    removeModel,
    poses,
    pose,
    createPose,
    finishPose,
    poseImagePath,
    removePose,
    removePosesOf,
    scenes,
    scene,
    createScene,
    finishScene,
    sceneImagePath,
    removeScene,
    failUnfinishedOnStart,
  };
}
