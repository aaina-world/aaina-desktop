import { useSyncExternalStore } from "react";
import { Icon, type IconName } from "./Icon";

type ToastItem = { id: number; message: React.ReactNode; icon: IconName; action?: { label: string; onClick: () => void } };
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** A small confirmation after an action that has nothing else to show. Fades away by itself. */
export function toast(
  message: React.ReactNode,
  options: { icon?: IconName; action?: { label: string; onClick: () => void }; ms?: number } = {},
) {
  const id = nextId++;
  items = [...items, { id, message, icon: options.icon ?? "check", action: options.action }];
  emit();
  setTimeout(
    () => {
      items = items.filter((t) => t.id !== id);
      emit();
    },
    options.ms ?? (options.action ? 6000 : 3200),
  );
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Mount once, near the root. */
export function ToastHost() {
  const list = useSyncExternalStore(subscribe, () => items);
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {list.map((t) => (
        <span className="toast" key={t.id}>
          <Icon name={t.icon} style={{ color: "var(--success)" }} />
          {t.message}
          {t.action && (
            <button
              className="undo"
              onClick={() => {
                t.action!.onClick();
                items = items.filter((x) => x.id !== t.id);
                emit();
              }}
            >
              {t.action.label}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
