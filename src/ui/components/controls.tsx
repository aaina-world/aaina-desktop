import { Icon, type IconName } from "./Icon";

export type SegOption<T extends string | number> = { value: T; label: React.ReactNode; count?: number };

/** A pill group of mutually exclusive options. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
  style,
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={["segmented", className].filter(Boolean).join(" ")} role="tablist" aria-label={label} style={style}>
      {options.map((o) => (
        <button key={String(o.value)} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null && <span className="num subtle">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  pressed,
  onClick,
  children,
  small,
  className,
  disabled,
}: {
  pressed?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  small?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={["chip", small && "chip-sm", className].filter(Boolean).join(" ")}
      aria-pressed={!!pressed}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** A row of chips: one choice (`value` is a string) or several (`value` is an array). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T | T[];
  onChange: (v: T) => void;
  small?: boolean;
}) {
  const on = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className="chips">
      {options.map((o) => (
        <Chip key={o.value} pressed={on(o.value)} small={small} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  compact,
}: {
  icon: IconName;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={["empty", compact && "compact"].filter(Boolean).join(" ")}>
      <div className="art" style={compact ? { width: 88, height: 88 } : undefined}>
        <Icon name={icon} />
      </div>
      <h2 className="t-section">{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({
  height = 12,
  width = "100%",
  style,
}: {
  height?: number | string;
  width?: number | string;
  style?: React.CSSProperties;
}) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

/** Placeholder tiles with the final shape, so nothing jumps when photos arrive. */
export function SkeletonGrid({ count = 8, cols, label = "Loading" }: { count?: number; cols?: number; label?: string }) {
  return (
    <div className="grid" style={cols ? ({ "--cols": cols } as React.CSSProperties) : undefined} aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div className="tile" key={i}>
          <div className="media skeleton" />
          <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
            <Skeleton height={12} width="70%" />
            <Skeleton height={10} width="45%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A picture tile: a media area with overlays, and a caption under it. */
export function Tile({
  img,
  alt = "",
  contain,
  selected,
  onClick,
  tl,
  tr,
  title,
  meta,
  meta2,
  children,
  className,
}: {
  img?: string | null;
  alt?: string;
  contain?: boolean;
  selected?: boolean;
  onClick?: () => void;
  tl?: React.ReactNode;
  tr?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  meta2?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={["tile", contain && "contain", selected && "selectable", className].filter(Boolean).join(" ")}
      aria-selected={selected}
      onClick={onClick}
    >
      <div className="media">
        {img && <img src={img} alt={alt} loading="lazy" />}
        {tl && <span className="over-tl">{tl}</span>}
        {tr && <span className="over-tr">{tr}</span>}
        {children}
      </div>
      <div className="cap">
        <div className="grow">
          <div className="t">{title}</div>
          {meta && <div className="m">{meta}</div>}
          {meta2 && <div className="m num">{meta2}</div>}
        </div>
      </div>
    </div>
  );
}
