import { ICONS, type IconName } from "./icons";

export type { IconName };

/** Aaina's stroke icon set. `size` "sm" (16px) or "lg" (24px); default 20px. */
export function Icon({
  name,
  size,
  className,
  style,
}: {
  name: IconName;
  size?: "sm" | "lg";
  className?: string;
  style?: React.CSSProperties;
}) {
  const cls = ["ico", size, className].filter(Boolean).join(" ");
  return (
    <svg className={cls} style={style} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />
  );
}

/** Aaina's mark (crop marks around the mirrored "A", marigold dot). */
export function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <g fill="none" stroke="var(--fg-subtle)" strokeWidth="1.1">
        <path d="M1.5 8.5V1.5h7" />
        <path d="M31.5 1.5h7v7" />
        <path d="M1.5 31.5v7h7" />
        <path d="M31.5 38.5h7v-7" />
      </g>
      <path d="M12 21.5 20 7l8 14.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" />
      <path d="M9 21.5h22" stroke="currentColor" strokeWidth="0.9" />
      <path d="M12 21.5 20 36l8-14.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeOpacity="0.2" />
      <circle cx="33.5" cy="6.5" r="1.6" fill="var(--accent)" />
    </svg>
  );
}
