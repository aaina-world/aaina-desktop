import { useOs } from "../hooks/useOs";

export const formatUsd = (n: number) => "$" + (n < 0.1 ? n.toFixed(n * 100 === Math.round(n * 100) ? 2 : 3) : n.toFixed(2));

/** "about $0.05", "about $0.05 a photo", "3 × about $0.05". Always rough, always OpenAI's price. */
export function costText(usd: number, opts: { count?: number; unit?: string } = {}) {
  const base = `about ${formatUsd(usd)}`;
  if (opts.count && opts.count > 1) return `${opts.count} × ${base}`;
  return opts.unit ? `${base} ${opts.unit}` : base;
}

export function Cost({
  usd,
  count,
  unit,
  className,
  style,
}: {
  usd: number;
  count?: number;
  unit?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={["cost", className].filter(Boolean).join(" ")} style={style}>
      {costText(usd, { count, unit })}
    </span>
  );
}

/** A keyboard shortcut chip. `mod` adds the system's command key (⌘ or Ctrl+). */
export function Kbd({
  children,
  mod,
  className,
  style,
}: {
  children?: React.ReactNode;
  mod?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const os = useOs();
  return (
    <span className={["kbd", className].filter(Boolean).join(" ")} style={style}>
      {mod ? os.mod : null}
      {children}
    </span>
  );
}

/** Kbd that blends into a filled button. */
export function KbdOnButton({ children, mod }: { children?: React.ReactNode; mod?: boolean }) {
  return (
    <Kbd
      mod={mod}
      style={{
        background: "transparent",
        borderColor: "color-mix(in srgb, currentColor 35%, transparent)",
        color: "inherit",
        marginLeft: 4,
      }}
    >
      {children}
    </Kbd>
  );
}
