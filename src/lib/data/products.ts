import type { PhotoRole, Product, ProductPhoto, ProductReading } from "../contract";
import { fromJson, newId, now, toJson, type Sql } from "./sql";
import type { Urls } from "./urls";

type ProductRow = { id: string; name: string; reading: string | null; created_at: string; updated_at: string };
type PhotoRow = { id: string; product_id: string; path: string; role: PhotoRole; width: number; height: number; position: number };

export type ProductsRepo = ReturnType<typeof createProductsRepo>;

export function createProductsRepo(db: Sql, urls: Urls) {
  async function photoOf(row: PhotoRow): Promise<ProductPhoto> {
    return { id: row.id, path: row.path, url: await urls.app(row.path), role: row.role, width: row.width, height: row.height };
  }

  async function build(rows: ProductRow[]): Promise<Product[]> {
    if (!rows.length) return [];
    const photoRows = await db.select<PhotoRow>(`SELECT * FROM product_photos ORDER BY position, rowid`);
    const byProduct = new Map<string, PhotoRow[]>();
    for (const row of photoRows) byProduct.set(row.product_id, [...(byProduct.get(row.product_id) ?? []), row]);
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        photos: await Promise.all((byProduct.get(row.id) ?? []).map(photoOf)),
        reading: fromJson<ProductReading>(row.reading),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    );
  }

  const list = async () => build(await db.select<ProductRow>(`SELECT * FROM products ORDER BY updated_at DESC`));

  async function get(id: string): Promise<Product | null> {
    const rows = await db.select<ProductRow>(`SELECT * FROM products WHERE id = $1`, [id]);
    return (await build(rows))[0] ?? null;
  }

  async function create(input: { id?: string; name: string }): Promise<string> {
    const id = input.id ?? newId();
    const at = now();
    await db.execute(`INSERT INTO products (id, name, reading, created_at, updated_at) VALUES ($1, $2, NULL, $3, $3)`, [
      id,
      input.name,
      at,
    ]);
    return id;
  }

  async function addPhoto(input: { productId: string; path: string; role: PhotoRole; width: number; height: number }): Promise<string> {
    const id = newId();
    const [{ next }] = await db.select<{ next: number }>(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM product_photos WHERE product_id = $1`,
      [input.productId],
    );
    await db.execute(`INSERT INTO product_photos (id, product_id, path, role, width, height, position) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
      id,
      input.productId,
      input.path,
      input.role,
      input.width,
      input.height,
      next,
    ]);
    await touch(input.productId);
    return id;
  }

  async function setPhotoRole(photoId: string, role: PhotoRole): Promise<void> {
    await db.execute(`UPDATE product_photos SET role = $1 WHERE id = $2`, [role, photoId]);
  }

  async function setReading(id: string, reading: ProductReading | null): Promise<void> {
    await db.execute(`UPDATE products SET reading = $1, updated_at = $2 WHERE id = $3`, [toJson(reading), now(), id]);
  }

  async function rename(id: string, name: string): Promise<void> {
    await db.execute(`UPDATE products SET name = $1, updated_at = $2 WHERE id = $3`, [name, now(), id]);
  }

  const touch = async (id: string) => void (await db.execute(`UPDATE products SET updated_at = $1 WHERE id = $2`, [now(), id]));

  /** Relative paths of a product's photo files (to delete after `remove`). */
  const photoPaths = async (id: string) =>
    (await db.select<{ path: string }>(`SELECT path FROM product_photos WHERE product_id = $1`, [id])).map((r) => r.path);

  /** Deletes the product, its photos and (by cascade) its shoots and their photos. */
  async function remove(id: string): Promise<void> {
    await db.execute(`DELETE FROM products WHERE id = $1`, [id]);
  }

  return { list, get, create, addPhoto, setPhotoRole, setReading, rename, photoPaths, remove };
}
