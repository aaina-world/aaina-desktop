import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The same list, limited to the dialog's body (the prefix has to go in front of every alternative, not only the first). */
const IN_BODY = FOCUSABLE.split(", ")
  .map((part) => ".dialog-body " + part)
  .join(", ");

export type DialogProps = {
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A round icon at the left of the heading. */
  icon?: IconName;
  iconTone?: "danger" | "accent" | "info";
  /** A small picture at the left of the heading (the photo being changed). */
  thumb?: string | null;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Footer without a top rule, buttons at the right (small confirmations). */
  plainFoot?: boolean;
  alert?: boolean;
  hideClose?: boolean;
  /** No heading: just a body (the coffee dialog). `title` is then only the accessible name. */
  bare?: boolean;
};

/** Scrim + dialog. Esc and a click on the scrim close it; Tab stays inside; focus returns to where it was. */
export function Dialog({
  onClose,
  size = "md",
  title,
  description,
  icon,
  iconTone,
  thumb,
  children,
  footer,
  plainFoot,
  alert,
  hideClose,
  bare,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const first =
      root.querySelector<HTMLElement>("[data-autofocus]") ??
      root.querySelector<HTMLElement>(IN_BODY) ??
      root.querySelector<HTMLElement>(".dialog-foot .btn-primary, .dialog-foot .btn-danger") ??
      root.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "Tab") {
        const list = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (!list.length) return;
        const a = list[0];
        const z = list[list.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        } else if (!root.contains(document.activeElement)) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      before?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={["dialog", size === "md" ? "" : size].filter(Boolean).join(" ")}
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={bare ? undefined : id}
        aria-label={bare && typeof title === "string" ? title : undefined}
      >
        {!bare && (
          <div className="dialog-head">
            {thumb && <img className="dthumb" src={thumb} alt="" />}
            {icon && (
              <span className={["dicon", iconTone].filter(Boolean).join(" ")}>
                <Icon name={icon} />
              </span>
            )}
            <div>
              <div className="t" id={id}>
                {title}
              </div>
              {description && <div className="d">{description}</div>}
            </div>
            {!hideClose && (
              <button className="btn btn-ghost btn-icon close" onClick={onClose} aria-label="Close">
                <Icon name="x" />
              </button>
            )}
          </div>
        )}
        {children && <div className="dialog-body">{children}</div>}
        {footer && (
          <div className="dialog-foot" style={plainFoot ? { borderTop: 0, justifyContent: "flex-end" } : undefined}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
