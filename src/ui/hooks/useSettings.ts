import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "../../lib/api";
import type { Settings } from "../../lib/contract";

let current: Settings | null = null;
let loading = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

async function load() {
  if (current || loading) return;
  loading = true;
  try {
    current = await (await api()).settings();
    emit();
  } finally {
    loading = false;
  }
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
