// Small parts shared by the Create, Library and Models screens, built on the shared components.
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { useMenu } from "../../components/Menu";
import { useApi, useLoad } from "../../hooks/useApi";

export { Icon, useApi, useLoad };
export type { IconName };

export function messageOf(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  return "Something went wrong. Please try again.";
}

export function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}
export const about = (n: number) => `about ${usd(n)}`;

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function humanize(v: string | null | undefined): string {
  if (!v) return "";
  const s = v.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : (many ?? one + "s")}`;
}

/** A slim inline message (Aaina's Notice). */
/** Three-dot menu on a tile caption. */
export function MoreMenu({
  items,
  label = "More",
}: {
  items: { label: string; icon?: IconName; danger?: boolean; onClick: () => void }[];
  label?: string;
}) {
  const m = useMenu();
  return (
    <>
      <button
        className="btn btn-ghost btn-icon btn-sm"
        aria-label={label}
        aria-haspopup="menu"
        onClick={(e) =>
          m.open(
            e.currentTarget,
            items.map((it) => ({ label: it.label, icon: it.icon, danger: it.danger, onSelect: it.onClick })),
          )
        }
      >
        <Icon name="more" size="sm" />
      </button>
      {m.node}
    </>
  );
}

/** A filter chip that opens a small menu of options (several can be on). */
export function ChipMenu({
  label,
  options,
  value,
  onChange,
  single,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const d = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", d);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", d);
      document.removeEventListener("keydown", k);
    };
  }, [open]);
  const on = value.length > 0;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={`chip dropdown${on ? " on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
        {on ? ` · ${value.length}` : ""}
      </button>
      {open && (
        <div
          className="menu"
          role="menu"
          style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40, maxHeight: 320, overflow: "auto" }}
        >
          {options.map((o) => {
            const sel = value.includes(o.value);
            return (
              <button
                key={o.value}
                role="menuitemcheckbox"
                aria-checked={sel}
                className="menu-item"
                onClick={() => {
                  if (single) {
                    onChange(sel ? [] : [o.value]);
                    setOpen(false);
                  } else onChange(sel ? value.filter((x) => x !== o.value) : [...value, o.value]);
                }}
              >
                <span style={{ flex: 1 }}>{o.label}</span>
                {sel && <Icon name="check" size="sm" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Same search the picker uses: every word must appear somewhere in the text. */
export function matches(q: string, ...texts: (string | null | undefined)[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function TileSkeletons({ n = 8, ratio = "3/4", cols = 4 }: { n?: number; ratio?: string; cols?: number }) {
  return (
    <div className="grid" style={{ ["--cols" as string]: cols }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div className="tile" key={i}>
          <div className="media skeleton" style={{ ["--ratio" as string]: ratio }} />
          <div className="stack" style={{ ["--gap" as string]: "6px" }}>
            <div className="skeleton" style={{ height: 12, width: "70%" }} />
            <div className="skeleton" style={{ height: 10, width: "45%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A picture. With `sheet` it shows the front portrait of a six-photo reference sheet. */
export function Pic({
  src,
  sheet,
  alt = "",
  className,
  style,
}: {
  src: string | null | undefined;
  sheet?: boolean;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!src) return null;
  if (sheet)
    return (
      <span
        className={["pic-crop", className].filter(Boolean).join(" ")}
        style={{ backgroundImage: `url("${src}")`, ...style }}
        role="img"
        aria-label={alt}
      />
    );
  return <img src={src} alt={alt} className={className} style={style} loading="lazy" />;
}

/** A slim notice with a button at the right (Notice only takes a text action). */
export function Note({
  tone,
  icon,
  children,
  action,
  style,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger" | "accent";
  icon?: IconName;
  children: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const i: IconName = icon ?? (tone === "warning" || tone === "danger" ? "alert" : tone === "success" ? "check" : "info");
  return (
    <div className={["notice", tone, className].filter(Boolean).join(" ")} role={tone === "danger" ? "alert" : undefined} style={style}>
      <Icon name={i} />
      <span>{children}</span>
      {action}
    </div>
  );
}
