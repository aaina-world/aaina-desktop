// Numbered migrations. NEVER edit one once it has shipped: add a new one at the end. Each is a list of single
// statements (the SQL plugin runs one statement per call).
export type Migration = { id: number; name: string; statements: string[] };

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "first tables",
    statements: [
      `CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        reading TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE product_photos (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        role TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX product_photos_product ON product_photos(product_id, position)`,
      `CREATE TABLE shoots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        model TEXT,
        scene TEXT,
        quality TEXT NOT NULL,
        plan TEXT NOT NULL,
        started INTEGER NOT NULL DEFAULT 0,
        draft_step TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX shoots_product ON shoots(product_id)`,
      `CREATE TABLE photos (
        id TEXT PRIMARY KEY,
        shoot_id TEXT NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
        shot_key TEXT NOT NULL,
        shot TEXT NOT NULL,
        title TEXT NOT NULL,
        version INTEGER NOT NULL,
        parent_id TEXT,
        change TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        path TEXT,
        root TEXT,
        width INTEGER,
        height INTEGER,
        estimate_usd REAL NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX photos_shoot ON photos(shoot_id, created_at)`,
      `CREATE INDEX photos_status ON photos(status)`,
      `CREATE TABLE own_models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT NOT NULL,
        age INTEGER NOT NULL,
        look TEXT,
        body TEXT,
        appearance TEXT NOT NULL,
        made_from TEXT NOT NULL,
        status TEXT NOT NULL,
        face_options TEXT NOT NULL DEFAULT '[]',
        sheet_path TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE own_poses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        words TEXT,
        image_path TEXT,
        model_source TEXT NOT NULL,
        model_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE own_scenes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        words TEXT,
        image_path TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
  },
];
