import type { Photo, PhotoStatus, ShotPlan } from "../contract";
import { fromJson, newId, now, toJson, type Sql } from "./sql";
import type { Urls } from "./urls";

export type PhotoRow = {
  id: string;
  shoot_id: string;
  shot_key: string;
  shot: string;
  title: string;
  version: number;
  parent_id: string | null;
  change: string;
  status: PhotoStatus;
  error: string | null;
  path: string | null;
  root: string | null;
  width: number | null;
  height: number | null;
  estimate_usd: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type NewPhoto = {
  shootId: string;
  shotKey: string;
  shot: ShotPlan;
  title: string;
  parentId?: string | null;
  change?: Photo["change"];
  estimateUsd: number;
};

export type PhotosRepo = ReturnType<typeof createPhotosRepo>;

/**
 * Photos and their money-safe lifecycle: queued → sending (saved BEFORE the paid call) → done / failed / interrupted.
 * `photosFolder` says where finished files are written, so `markDone` can remember the folder with the relative path.
 */
export function createPhotosRepo(db: Sql, urls: Urls, photosFolder: () => Promise<string>) {
  async function toPhoto(row: PhotoRow): Promise<Photo> {
    return {
      id: row.id,
      shootId: row.shoot_id,
      shotKey: row.shot_key,
      shot: fromJson<ShotPlan>(row.shot)!,
      title: row.title,
      version: row.version,
      parentId: row.parent_id,
      change: fromJson<Photo["change"]>(row.change) ?? { kind: "new" },
      status: row.status,
      error: fromJson<Photo["error"]>(row.error),
      path: row.path,
      url: row.path && row.root ? await urls.photo(row.root, row.path) : null,
      width: row.width,
      height: row.height,
      estimateUsd: row.estimate_usd,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      createdAt: row.created_at,
    };
  }

  const many = async (rows: PhotoRow[]) => Promise.all(rows.map(toPhoto));

  async function get(id: string): Promise<Photo | null> {
    const rows = await db.select<PhotoRow>(`SELECT * FROM photos WHERE id = $1`, [id]);
    return rows[0] ? toPhoto(rows[0]) : null;
  }

  const forShoot = async (shootId: string) =>
    many(await db.select<PhotoRow>(`SELECT * FROM photos WHERE shoot_id = $1 ORDER BY created_at, rowid`, [shootId]));

  /** Newest finished photos first. */
  const recent = async (limit: number) =>
    many(await db.select<PhotoRow>(`SELECT * FROM photos WHERE status = 'done' ORDER BY finished_at DESC LIMIT $1`, [limit]));

  /** The oldest queued photos, for the queue to start. */
  const queued = async (limit: number) =>
    many(await db.select<PhotoRow>(`SELECT * FROM photos WHERE status = 'queued' ORDER BY created_at, rowid LIMIT $1`, [limit]));

  /** The next version number for a shot in a shoot (1 for a new shot). */
  async function nextVersion(shootId: string, shotKey: string): Promise<number> {
    const [row] = await db.select<{ v: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS v FROM photos WHERE shoot_id = $1 AND shot_key = $2`,
      [shootId, shotKey],
    );
    return row.v;
  }

  async function insertQueued(input: NewPhoto): Promise<Photo> {
    const id = newId();
    const version = await nextVersion(input.shootId, input.shotKey);
    await db.execute(
      `INSERT INTO photos (id, shoot_id, shot_key, shot, title, version, parent_id, change, status, estimate_usd, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued',$9,$10)`,
      [
        id,
        input.shootId,
        input.shotKey,
        toJson(input.shot),
        input.title,
        version,
        input.parentId ?? null,
        toJson(input.change ?? { kind: "new" }),
        input.estimateUsd,
        now(),
      ],
    );
    return (await get(id))!;
  }

  /** Call and await this BEFORE the paid request: from here on the photo may be charged. */
  async function markSending(id: string): Promise<void> {
    await db.execute(`UPDATE photos SET status = 'sending', started_at = $1, error = NULL WHERE id = $2`, [now(), id]);
  }

  /** `path` is relative to the photos folder (the folder is remembered with it, so moving the setting later breaks nothing). */
  async function markDone(id: string, file: { path: string; width: number; height: number }): Promise<void> {
    await db.execute(
      `UPDATE photos SET status = 'done', path = $1, root = $2, width = $3, height = $4, finished_at = $5, error = NULL WHERE id = $6`,
      [file.path, await photosFolder(), file.width, file.height, now(), id],
    );
  }

  async function markFailed(id: string, error: NonNullable<Photo["error"]>): Promise<void> {
    await db.execute(`UPDATE photos SET status = 'failed', error = $1, finished_at = $2 WHERE id = $3`, [toJson(error), now(), id]);
  }

  /** Lost while sending: it may have been charged, so it is never resent automatically. */
  async function markInterrupted(id: string, error: NonNullable<Photo["error"]>): Promise<void> {
    await db.execute(`UPDATE photos SET status = 'interrupted', error = $1, finished_at = $2 WHERE id = $3`, [toJson(error), now(), id]);
  }

  /** The photos folder a finished photo was written to (null while it has no file). */
  async function rootOf(id: string): Promise<string | null> {
    const [row] = await db.select<{ root: string | null }>(`SELECT root FROM photos WHERE id = $1`, [id]);
    return row?.root ?? null;
  }

  /** Put a failed photo back in the queue for Try again (not for interrupted ones: those may have been charged). */
  async function requeue(id: string): Promise<void> {
    await db.execute(
      `UPDATE photos SET status = 'queued', error = NULL, started_at = NULL, finished_at = NULL WHERE id = $1 AND status = 'failed'`,
      [id],
    );
  }

  /** At app start: anything that was `sending` is lost mid-call and may have been charged; queued photos stay queued. */
  async function markInterruptedOnStart(): Promise<number> {
    const error = toJson({
      code: "INTERRUPTED",
      message: "The app closed or the connection dropped while this photo was being made. OpenAI may have charged for it.",
      charged: "maybe",
    });
    const { rowsAffected } = await db.execute(
      `UPDATE photos SET status = 'interrupted', error = $1, finished_at = $2 WHERE status = 'sending'`,
      [error, now()],
    );
    return rowsAffected;
  }

  /** Deletes the row and returns where its file was, so the caller can remove it. */
  async function remove(id: string): Promise<{ root: string; path: string } | null> {
    const [row] = await db.select<{ path: string | null; root: string | null }>(`SELECT path, root FROM photos WHERE id = $1`, [id]);
    await db.execute(`DELETE FROM photos WHERE id = $1`, [id]);
    return row?.path && row.root ? { root: row.root, path: row.path } : null;
  }

  /** Files of every photo in a shoot or product (before deleting it). */
  async function filesOf(where: "shoot" | "product", id: string): Promise<{ root: string; path: string }[]> {
    const sql =
      where === "shoot"
        ? `SELECT path, root FROM photos WHERE shoot_id = $1 AND path IS NOT NULL`
        : `SELECT p.path, p.root FROM photos p JOIN shoots s ON s.id = p.shoot_id WHERE s.product_id = $1 AND p.path IS NOT NULL`;
    return (await db.select<{ path: string; root: string }>(sql, [id])).filter((r) => r.root);
  }

  return {
    get,
    forShoot,
    recent,
    queued,
    nextVersion,
    insertQueued,
    markSending,
    markDone,
    markFailed,
    markInterrupted,
    rootOf,
    requeue,
    markInterruptedOnStart,
    remove,
    filesOf,
  };
}
