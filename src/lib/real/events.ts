import type { Api } from "../contract";

export type ApiEvent = Parameters<Parameters<Api["subscribe"]>[0]>[0];
export type Emit = (event: ApiEvent) => void;

/** The listeners behind `Api.subscribe`. A listener that throws never stops the others. */
export function createEvents() {
  const listeners = new Set<(event: ApiEvent) => void>();
  const emit: Emit = (event) => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        /* a listener's problem */
      }
    }
  };
  const subscribe: Api["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return { emit, subscribe };
}
