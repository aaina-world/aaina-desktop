import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

export type MenuEntry =
  "sep" | { label: React.ReactNode; icon?: IconName; right?: React.ReactNode; danger?: boolean; disabled?: boolean; onSelect: () => void };

/** A menu at a screen point (right-click) or under an element. Esc, outside click, scroll or resize close it. */
export function Menu({ at, items, onClose }: { at: { x: number; y: number }; items: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)),
    });
  }, [at.x, at.y]);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>(".menu-item:not([disabled])");
    first?.focus();
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = Array.from(ref.current?.querySelectorAll<HTMLElement>(".menu-item:not([disabled])") ?? []);
        const i = list.indexOf(document.activeElement as HTMLElement);
        list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
      }
    };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="menu menu-fixed" role="menu" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) =>
        it === "sep" ? (
          <div className="menu-sep" key={i} />
        ) : (
          <button
            key={i}
            className={["menu-item", it.danger && "danger"].filter(Boolean).join(" ")}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
          >
            {it.icon && <Icon name={it.icon} />}
            {it.label}
            {it.right != null && <span className="r">{it.right}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

/** State for one menu: `open(point | element, items)`, and `node` to render. */
export function useMenu() {
  const [state, setState] = useState<{ at: { x: number; y: number }; items: MenuEntry[] } | null>(null);
  const close = useCallback(() => setState(null), []);
  const open = useCallback((where: { x: number; y: number } | HTMLElement | React.MouseEvent, items: MenuEntry[]) => {
    let at: { x: number; y: number };
    if (where instanceof HTMLElement) {
      const r = where.getBoundingClientRect();
      at = { x: r.right - 232, y: r.bottom + 4 };
    } else if ("clientX" in where) {
      at = { x: where.clientX, y: where.clientY };
    } else at = where;
    setState({ at, items });
  }, []);
  const node = state ? <Menu at={state.at} items={state.items} onClose={close} /> : null;
  return { open, close, node };
}
