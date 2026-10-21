import { Icon, type IconName } from "./Icon";

export type Tone = "info" | "success" | "warning" | "danger" | "accent";
const DEFAULT_ICON: Record<Tone, IconName> = { info: "info", success: "check", warning: "alert", danger: "alert", accent: "info" };

/** A slim inline message. Errors go inline, toasts only confirm. */
export function Notice({
  tone,
  icon,
  action,
  children,
  className,
  style,
}: {
  tone?: Tone;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={["notice", tone, className].filter(Boolean).join(" ")} role={tone === "danger" ? "alert" : undefined} style={style}>
      <Icon name={icon ?? DEFAULT_ICON[tone ?? "info"]} />
      <span>{children}</span>
      {action && (
        <button className="action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** A list or screen that could not load. */
export function LoadError({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  return (
    <Notice tone="danger" action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}>
      {children}
    </Notice>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <div className="field-error" role="alert">
      <Icon name="alert" size="sm" />
      {children}
    </div>
  );
}
