import { useEffect, useRef } from "react";
import { api, inApp } from "../../lib/api";
import type { Api } from "../../lib/contract";
import { logWarning } from "../../lib/log";
import { checkForUpdate, type UpdateCheck } from "../../lib/updates";
import { toast } from "../components/Toast";

/** Asks GitHub whether a newer release is out (through the app's own HTTP client in the app, so the CSP allows it). */
export async function latestRelease(a: Api): Promise<UpdateCheck> {
  const fetcher = inApp ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  return checkForUpdate(await a.appVersion(), fetcher);
}

/** Says a newer version is out, with a link to it. */
export function announceUpdate(a: Api, update: Extract<UpdateCheck, { kind: "newer" }>): void {
  toast(`Version ${update.version} is ready`, {
    icon: "refresh",
    ms: 12000,
    action: { label: "Get it", onClick: () => void a.openUrl(update.url) },
  });
}

/** Once per app start, when the setting is on: a quiet check that only speaks up when there is something new. */
export function useUpdateCheckOnStart(enabled: boolean): void {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    done.current = true;
    void (async () => {
      try {
        const a = await api();
        const result = await latestRelease(a);
        if (result.kind === "newer") announceUpdate(a, result);
      } catch (error) {
        void logWarning("Update check on start failed", error);
      }
    })();
  }, [enabled]);
}
