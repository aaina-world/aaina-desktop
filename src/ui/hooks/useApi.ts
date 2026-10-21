import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { Api } from "../../lib/contract";

/** The Api, once it has loaded (null for a moment at start). */
export function useApi(): Api | null {
  const [a, setA] = useState<Api | null>(null);
  useEffect(() => {
    let live = true;
    void api().then((x) => live && setA(x));
    return () => {
      live = false;
    };
  }, []);
  return a;
}

export type Loaded<T> = { data: T | null; loading: boolean; error: string | null; reload: () => void };
type EventType = "photo" | "shoot" | "catalog" | "own" | "connection";

/**
 * Loads something through the Api and loads it again when the Api reports a change of the given kinds
 * (default: any). `fn` must be stable per `deps`. While reloading, the old data stays (no flash).
 */
export function useLoad<T>(fn: (a: Api) => Promise<T>, deps: unknown[] = [], on: EventType[] | "all" = "all"): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const onRef = useRef(on);
  onRef.current = on;

  useEffect(() => {
    let live = true;
    let unsub: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void api().then((a) => {
      if (!live) return;
      fnRef.current(a).then(
        (data) => live && setState({ data, loading: false, error: null }),
        (e) => live && setState((s) => ({ data: s.data, loading: false, error: e instanceof Error ? e.message : "Something went wrong." })),
      );
      unsub = a.subscribe((ev) => {
        const want = onRef.current;
        if (want !== "all" && !want.includes(ev.type)) return;
        clearTimeout(timer);
        timer = setTimeout(() => setTick((t) => t + 1), 80);
      });
    });
    return () => {
      live = false;
      clearTimeout(timer);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  // A change of deps starts a fresh load with the loading state on (tick reloads keep the old data).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

/** Re-renders every `ms` while `active`; returns Date.now(). */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}
