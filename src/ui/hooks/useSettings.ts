import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "../../lib/api";
import { logWarning } from "../../lib/log";
import type { Settings } from "../../lib/contract";

let current: Settings | null = null;
let loading = false;
/** Why the app could not start (its settings never loaded), shown instead of an empty window. */
let failed: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

async function load() {
  if (current || loading) return;
  loading = true;
  try {
    current = await (await api()).settings();
    failed = null;
    emit();
  } catch (e) {
    failed = e instanceof Error ? e.message : String(e);
    void logWarning("The app could not start", e);
    emit();
  } finally {
    loading = false;
  }
}

/** Why the app could not start, if it couldn't, and a way to try again. */
export function useStartProblem() {
  const problem = useSyncExternalStore(
    (s) => {
      subs.add(s);
      return () => subs.delete(s);
    },
    () => failed,
  );
  const retry = useCallback(() => {
    failed = null;
    emit();
    void load();
  }, []);
  return { problem, retry };
}

/** Settings shared by every screen: one copy, updated at once everywhere (theme, folder…). */
export function useSettings() {
  const settings = useSyncExternalStore(
    (s) => {
      subs.add(s);
      return () => subs.delete(s);
    },
    () => current,
  );
  useEffect(() => {
    void load();
  }, []);
  const update = useCallback(async (patch: Partial<Settings>) => {
    if (current) {
      current = { ...current, ...patch };
      emit();
    }
    try {
      current = await (await api()).updateSettings(patch);
    } finally {
      emit();
    }
    return current;
  }, []);
  return { settings, update };
}
