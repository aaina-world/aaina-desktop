import type { ModelRef, SceneRef, Shoot, ShootKind, ShotPlan } from "../contract";
import { fromJson, newId, now, toJson, type Sql } from "./sql";
import type { Urls } from "./urls";

type ShootRow = {
  id: string;
  name: string;
  kind: ShootKind;
  product_id: string;
  model: string | null;
  scene: string | null;
  quality: Shoot["quality"];
  plan: string;
  started: number;
  draft_step: Shoot["draftStep"];
  created_at: string;
  updated_at: string;
  photo_count: number;
  active_count: number;
  ready_count: number;
  failed_count: number;
  cover_path: string | null;
  cover_root: string | null;
};

// Cover = the newest finished photo. Active = photos still queued or being sent.
const SELECT = `
  SELECT s.*,
    (SELECT COUNT(*) FROM photos p WHERE p.shoot_id = s.id) AS photo_count,
    (SELECT COUNT(*) FROM photos p WHERE p.shoot_id = s.id AND p.status IN ('queued','sending')) AS active_count,
    (SELECT COUNT(DISTINCT p.shot_key) FROM photos p WHERE p.shoot_id = s.id AND p.status = 'done') AS ready_count,
    (SELECT COUNT(*) FROM photos p WHERE p.shoot_id = s.id AND p.status IN ('failed','interrupted')) AS failed_count,
    (SELECT p.path FROM photos p WHERE p.shoot_id = s.id AND p.status = 'done' ORDER BY p.finished_at DESC LIMIT 1) AS cover_path,
    (SELECT p.root FROM photos p WHERE p.shoot_id = s.id AND p.status = 'done' ORDER BY p.finished_at DESC LIMIT 1) AS cover_root
  FROM shoots s`;

export type ShootsRepo = ReturnType<typeof createShootsRepo>;
export type ShootPatch = Partial<{
  name: string;
  model: ModelRef | null;
  scene: SceneRef | null;
  quality: Shoot["quality"];
  plan: ShotPlan[];
  draftStep: Shoot["draftStep"];
}>;

export function createShootsRepo(db: Sql, urls: Urls) {
  async function toShoot(row: ShootRow): Promise<Shoot> {
    const status: Shoot["status"] = !row.started ? "draft" : row.active_count > 0 ? "making" : "done";
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      productId: row.product_id,
      model: fromJson<ModelRef>(row.model),
      scene: fromJson<SceneRef>(row.scene),
      quality: row.quality,
      plan: fromJson<ShotPlan[]>(row.plan) ?? [],
      status,
      draftStep: row.draft_step,
      coverUrl: row.cover_path && row.cover_root ? await urls.photo(row.cover_root, row.cover_path) : null,
      photoCount: row.photo_count,
      readyCount: row.ready_count,
      failedCount: row.failed_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** Newest first. `kind: "draft"` means shoots not yet made; `q` matches the name. */
  async function list(filter: { kind?: ShootKind | "draft"; q?: string } = {}): Promise<Shoot[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.kind === "draft") where.push(`s.started = 0`);
    else if (filter.kind) {
      params.push(filter.kind);
      where.push(`s.kind = $${params.length}`);
    }
    const q = filter.q?.trim();
    if (q) {
      params.push(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
      where.push(`s.name LIKE $${params.length} ESCAPE '\\'`);
    }
    const rows = await db.select<ShootRow>(
      `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY s.updated_at DESC`,
      params,
    );
    return Promise.all(rows.map(toShoot));
  }

  async function get(id: string): Promise<Shoot | null> {
    const rows = await db.select<ShootRow>(`${SELECT} WHERE s.id = $1`, [id]);
    return rows[0] ? toShoot(rows[0]) : null;
  }

  async function create(input: { kind: ShootKind; productId: string; name: string; quality: Shoot["quality"] }): Promise<Shoot> {
    const id = newId();
    const at = now();
    await db.execute(
      `INSERT INTO shoots (id, name, kind, product_id, quality, plan, started, draft_step, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,'[]',0,$6,$7,$7)`,
      [id, input.name, input.kind, input.productId, input.quality, input.kind === "model" ? "model" : "review", at],
    );
    return (await get(id))!;
  }

  async function update(id: string, patch: ShootPatch): Promise<Shoot> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.name !== undefined) set("name", patch.name);
    if (patch.model !== undefined) set("model", toJson(patch.model));
    if (patch.scene !== undefined) set("scene", toJson(patch.scene));
    if (patch.quality !== undefined) set("quality", patch.quality);
    if (patch.plan !== undefined) set("plan", toJson(patch.plan));
    if (patch.draftStep !== undefined) set("draft_step", patch.draftStep);
    set("updated_at", now());
    params.push(id);
    await db.execute(`UPDATE shoots SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
    return (await get(id))!;
  }

  /** The shoot has been made (no longer a draft); its status then follows its photos. */
  async function markStarted(id: string): Promise<void> {
    await db.execute(`UPDATE shoots SET started = 1, draft_step = NULL, updated_at = $1 WHERE id = $2`, [now(), id]);
  }

  async function remove(id: string): Promise<void> {
    await db.execute(`DELETE FROM shoots WHERE id = $1`, [id]);
  }

  return { list, get, create, update, markStarted, remove };
}
