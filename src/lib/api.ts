import type { Api } from "./contract";

/** True inside the desktop app; false in a plain browser (npm run dev), where the mock Api with sample data is used. */
export const inApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let current: Promise<Api> | null = null;

/** The Api for this run. Loaded lazily so the browser preview never pulls in Tauri plugins and the app never ships the mock. */
export function api(): Promise<Api> {
  current ??= inApp ? import("./real").then((m) => m.createApi()) : import("./mock").then((m) => m.createMockApi());
  return current;
}
