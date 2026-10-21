// The two calls the repositories need. The Tauri SQL plugin's Database satisfies it; tests use node:sqlite.
export interface Sql {
  execute(query: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
  select<T>(query: string, params?: unknown[]): Promise<T[]>;
}

/** Rows keep objects (reading, plan, error…) as JSON text. */
export const toJson = (value: unknown): string | null => (value === null || value === undefined ? null : JSON.stringify(value));
export function fromJson<T>(text: string | null | undefined): T | null {
  if (text === null || text === undefined || text === "") return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
