// The frame every Create step shares: top bar with the stepper and "Saved", the page, summary aside and sticky action bar.
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import type { CatalogScene, ModelRef, Quality, Shoot, ShootKind } from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import { Icon, Pic, usd, about, type IconName } from "./kit";

export type StepKey = "product" | "model" | "poses" | "scene" | "review" | "styles" | "angles";
export const STEPS: Record<ShootKind, { key: StepKey; label: string }[]> = {
  model: [
    { key: "product", label: "Product" },
    { key: "model", label: "Model" },
    { key: "poses", label: "Poses" },
    { key: "scene", label: "Scene" },
    { key: "review", label: "Review" },
  ],
  "flat-lay": [
    { key: "product", label: "Product" },
    { key: "styles", label: "Styles" },
    { key: "review", label: "Review" },
  ],
  ghost: [
    { key: "product", label: "Product" },
    { key: "angles", label: "Angles" },
    { key: "review", label: "Review" },
  ],
};

export const KIND_LABEL: Record<ShootKind, string> = { model: "On a model", "flat-lay": "Flat-lay", ghost: "Ghost mannequin" };

/** The furthest step this draft can open, from what is already chosen. */
export function reachable(shoot: Shoot | null, hasPhotos: boolean): StepKey {
  if (!shoot || !hasPhotos) return "product";
  if (shoot.kind === "flat-lay") return "styles";
  if (shoot.kind === "ghost") return "angles";
  if (!shoot.model) return "model";
  if (!shoot.plan.length) return "poses";
  if (!shoot.scene) return "scene";
  return "review";
}

export function stepPath(shootId: string | undefined, step: StepKey) {
  return shootId ? `/create/${shootId}/${step}` : "/create/new";
}

export function Flow(props: {
  kind: ShootKind;
  current: StepKey;
  shootId?: string;
  reach: StepKey;
  crumb: string;
  back: string;
  saving: boolean;
  saveError?: string | null;
  children: ReactNode;
  aside: ReactNode;
  bar: ReactNode;
}) {
  const steps = STEPS[props.kind];
  const order = steps.map((s) => s.key);
  const idx = (k: StepKey) => (k === "review" && props.kind === "model" ? 4 : order.indexOf(k));
  const cur = idx(props.current);
  const reach = idx(props.reach);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const on = () => ref.current?.classList.toggle("scrolled", window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // A flat-lay or ghost shoot has its review on the same page: the last step scrolls to it.
  const last = props.kind !== "model" ? order.length - 1 : -1;
  return (
    <>
      <header className="topbar" ref={ref} data-tauri-drag-region>
        <div className="flowbar grow">
          <Link className="btn btn-ghost btn-icon" to={props.back} aria-label="Back">
            <Icon name="left" />
          </Link>
          <div className="crumbs">
            <Link to="/">New shoot</Link>
            <span className="sep">/</span>
            <span className="here">{props.crumb}</span>
          </div>
          <nav className="stepper" aria-label="Steps">
            {steps.map((s, i) => {
              const done = i < cur && i <= reach;
              const inner = (
                <>
                  <span className="n">{done ? <Icon name="check" size="sm" style={{ width: 12, height: 12 }} /> : i + 1}</span>
                  {s.label}
                </>
              );
              const sep = i > 0 ? <span className="step-sep" key={"s" + i} /> : null;
              if (i === cur)
                return [
                  sep,
                  <span className="step" aria-current="step" key={s.key}>
                    {inner}
                  </span>,
                ];
              if (i === last)
                return [
                  sep,
                  <button
                    className="step"
                    key={s.key}
                    onClick={() => document.getElementById("review")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    {inner}
                  </button>,
                ];
              if (i <= reach)
                return [
                  sep,
                  <Link className={`step${done ? " done" : ""}`} key={s.key} to={stepPath(props.shootId, s.key)}>
                    {inner}
                  </Link>,
                ];
              return [
                sep,
                <span className="step locked" key={s.key}>
                  {inner}
                </span>,
              ];
            })}
          </nav>
          <span className={`saved${props.saving ? " busy" : ""}`} title="Drafts save automatically">
            <Icon name={props.saveError ? "alert" : "check"} />
            {props.saveError ? "Not saved" : props.saving ? "Saving" : "Saved"}
          </span>
        </div>
      </header>
      <div className="page">
        <div className="split">
          <section style={{ minWidth: 0 }}>{props.children}</section>
          <aside id="review">{props.aside}</aside>
        </div>
      </div>
      <div className="actionbar">{props.bar}</div>
    </>
  );
}

export function StepHead({
  eyebrow,
  title,
  em,
  lede,
  extra,
}: {
  eyebrow: string;
  title: string;
  em: string;
  lede: string;
  extra?: ReactNode;
}) {
  return (
    <div className="page-head" style={{ marginBottom: "var(--s-5)" }}>
      <div>
        <span className="t-eyebrow">{eyebrow}</span>
        <h1 className="t-page mt-2">
          {title} <em className="italic">{em}</em>
        </h1>
        <p className="lede">{lede}</p>
        {extra}
      </div>
    </div>
  );
}

export function SumRow({
  k,
  v,
  img,
  sheet,
  icon,
  contain,
  to,
  onEdit,
  subtle,
  bg,
  edit = "Change",
}: {
  k: string;
  v?: ReactNode;
  img?: string | null;
  sheet?: boolean;
  icon?: IconName;
  contain?: boolean;
  to?: string;
  onEdit?: () => void;
  subtle?: boolean;
  bg?: string;
  edit?: string;
}) {
  return (
    <div className="sum-row">
      {img ? (
        <Pic src={img} sheet={sheet} style={contain ? { objectFit: "contain" } : undefined} />
      ) : (
        <span className="ph" style={bg ? { background: bg } : undefined}>
          <Icon name={icon ?? "shirt"} size="sm" />
        </span>
      )}
      <div className="grow">
        <div className="k">{k}</div>
        <div className={`v${subtle ? " subtle" : ""}`}>{v}</div>
      </div>
      {to && (
        <Link className="edit" to={to}>
          {edit}
        </Link>
      )}
      {onEdit && (
        <button className="edit" onClick={onEdit}>
          {edit}
        </button>
      )}
    </div>
  );
}

export function PickedRow({
  label,
  shots,
  max = 6,
  contain,
}: {
  label: string;
  shots: { img?: string | null; name: string }[];
  max?: number;
  contain?: boolean;
}) {
  const empty = Math.max(0, max - shots.length);
  return (
    <div className="sum-row" style={{ alignItems: "flex-start" }}>
      <div className="grow">
        <div className="k" style={{ marginBottom: 8 }}>
          {label}
        </div>
        <div className="picked">
          {shots.map((s, i) =>
            s.img ? (
              <img key={i} src={s.img} alt="" style={contain ? { objectFit: "contain" } : undefined} />
            ) : (
              <span className="pk" key={i} title={s.name}>
                <Icon name="edit" size="sm" />
              </span>
            ),
          )}
          {Array.from({ length: empty }, (_, i) => (
            <span className="empty-slot" key={"e" + i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The cost card before the last step: both prices; or the count × price once poses are picked. */
export function PriceCard({
  quality,
  count,
  unitLabel,
  children,
  editable,
  onQuality,
}: {
  quality: Quality;
  count: number;
  unitLabel?: string;
  children?: ReactNode;
  editable?: boolean;
  onQuality?: (q: Quality) => void;
}) {
  const per = ESTIMATE_USD.photo[quality];
  const unit = unitLabel ?? "photo";
  return (
    <div className="card price-card">
      {editable && (
        <div className="quality">
          <span className="t-small">Quality</span>
          <div className="segmented" role="tablist" aria-label="Quality">
            <button role="tab" aria-selected={quality === "standard"} onClick={() => onQuality?.("standard")}>
              Standard
            </button>
            <button role="tab" aria-selected={quality === "high"} onClick={() => onQuality?.("high")}>
              High
            </button>
          </div>
        </div>
      )}
      {count === 0 && !editable ? (
        <>
          <div className="price-line">
            <span>Standard quality</span>
            <b>
              about {usd(ESTIMATE_USD.photo.standard)} a {unit}
            </b>
          </div>
          <div className="price-line">
            <span>High quality</span>
            <b>
              about {usd(ESTIMATE_USD.photo.high)} a {unit}
            </b>
          </div>
          <div className="price-total">
            <span className="t-small muted">From</span>
            <span className="v num">{about(ESTIMATE_USD.photo.standard)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="price-line">
            <span>
              {count} {count === 1 ? unit : unit + "s"} × {about(per)}
            </span>
            <b>{about(per * count)}</b>
          </div>
          <div className="price-total">
            <span className="t-small muted">Total</span>
            <span className="v num">{about(per * count)}</span>
          </div>
        </>
      )}
      <div className="t-caption">{children ?? "Billed by OpenAI to your key. Nothing is sent until you press Make."}</div>
    </div>
  );
}

export function BarSummary({
  thumbs,
  title,
  sub,
  contain,
  sheet,
}: {
  thumbs?: (string | null | undefined)[];
  title: ReactNode;
  sub: ReactNode;
  contain?: boolean;
  sheet?: boolean;
}) {
  return (
    <div className="summary">
      {thumbs && thumbs.some(Boolean) && (
        <div className="thumbs">
          {thumbs
            .filter(Boolean)
            .slice(0, 4)
            .map((t, i) => (
              <Pic key={i} src={t} sheet={sheet} style={contain ? { objectFit: "contain", background: "#fff" } : undefined} />
            ))}
        </div>
      )}
      <div className="txt">
        <b>{title}</b>
        <span className="num">{sub}</span>
      </div>
    </div>
  );
}

export function sceneName(scene: Shoot["scene"], lookup?: CatalogScene[] | null, ownName?: string): { name: string; sub: string } | null {
  if (!scene) return null;
  if (scene.source === "colour")
    return {
      name: scene.hex.toLowerCase() === "#ffffff" ? "White studio" : scene.name,
      sub: scene.hex.toLowerCase() === "#ffffff" ? "Plain white" : "Plain colour",
    };
  if (scene.source === "own") return { name: ownName ?? "Your scene", sub: "Made by you" };
  const s = lookup?.find((x) => x.id === scene.id);
  return { name: s?.name ?? "Studio scene", sub: s?.plain ? "Plain studio" : "Studio scene" };
}

export const sameModel = (a: ModelRef | null, b: ModelRef) => !!a && a.source === b.source && a.id === b.id;
