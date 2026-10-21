// Problems worth a look later go to the app's log file (Settings → Your data → Open log folder), never to the screen.
// In a plain browser (sample data) they go to the console. Never log secrets, keys or tokens.
import { inApp } from "./api";

const describe = (detail: unknown) =>
  detail instanceof Error ? `${detail.name}: ${detail.message}` : typeof detail === "string" ? detail : JSON.stringify(detail);

export async function logWarning(where: string, detail?: unknown): Promise<void> {
  const line = detail === undefined ? where : `${where}: ${describe(detail)}`;
  if (!inApp) return void console.warn(line);
  try {
    const { warn } = await import("@tauri-apps/plugin-log");
    await warn(line);
  } catch {
    console.warn(line);
  }
}
