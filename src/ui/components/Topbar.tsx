import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { useOnline } from "../hooks/useOnline";
import { Icon } from "./Icon";
import { Notice } from "./Notice";

export type Crumb = { label?: React.ReactNode; to?: string; node?: React.ReactNode };

/** The sticky bar at the top of a page. On a Mac it is also the place to drag the window by. */
export function Topbar({
  crumbs,
  back,
  backLabel,
  children,
}: {
  crumbs: (string | Crumb)[];
  back?: string;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const online = useOnline();
  useEffect(() => {
    const on = () => ref.current?.classList.toggle("scrolled", window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const list: Crumb[] = crumbs.map((c) => (typeof c === "string" ? { label: c } : c));
  return (
    <header className="topbar" ref={ref} data-tauri-drag-region>
      {back && (
        <Link className="btn btn-ghost btn-icon" to={back} aria-label={backLabel ?? "Back"}>
          <Icon name="left" />
        </Link>
      )}
      <div className="crumbs" data-tauri-drag-region>
        {list.map((c, i) => {
          const last = i === list.length - 1;
          return (
            <span key={i} style={{ display: "contents" }}>
              {i > 0 && <span className="sep">/</span>}
              {c.node ?? (last || !c.to ? <span className={last ? "here" : undefined}>{c.label}</span> : <Link to={c.to}>{c.label}</Link>)}
            </span>
          );
        })}
      </div>
      <div className="grow" data-tauri-drag-region />
      {!online && (
        <Notice tone="warning" icon="offline" style={{ minHeight: 32, padding: "4px 12px", fontSize: "var(--text-xs)" }}>
          You're offline. Making photos is paused.
        </Notice>
      )}
      {children}
    </header>
  );
}

export function PageHead({ title, lede, children }: { title: React.ReactNode; lede?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="t-page">{title}</h1>
        {lede && (
          <p className="lede" style={{ maxWidth: "46ch" }}>
            {lede}
          </p>
        )}
      </div>
      {children && (
        <div className="page-tools" style={{ marginLeft: "auto" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Search field with its shortcut. ⌘K (set in the root) focuses the one on screen. */
export function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  hint = "K",
  width,
  label = "Search",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  hint?: string;
  width?: number | string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const f = (e: Event) => {
      e.preventDefault(); // tells the root that a search field on this screen took it
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener("aaina:focus-search", f);
    return () => window.removeEventListener("aaina:focus-search", f);
  }, []);
  return (
    <label className={["input-wrap", className].filter(Boolean).join(" ")} style={width ? { width } : undefined}>
      <Icon name="search" />
      <input
        ref={ref}
        className="input search"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
          if (e.key === "Escape") {
            if (value) onChange("");
            else ref.current?.blur();
          }
        }}
      />
      <ModHint k={hint} />
    </label>
  );
}

function ModHint({ k }: { k: string }) {
  const mac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
  return (
    <span className="kbd">
      {mac ? "⌘" : "Ctrl+"}
      {k}
    </span>
  );
}
