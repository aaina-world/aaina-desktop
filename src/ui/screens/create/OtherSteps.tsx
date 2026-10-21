// The three-step variants: Flat-lay (styles) and Ghost mannequin (angles).
import { Link, useNavigate } from "react-router";
import type { FlatLayStyle, GhostAngle, Quality, ShotPlan } from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import { GHOST_ANGLE_NAME } from "../../../lib/labels";
import { Notice } from "../../components/Notice";
import type { CreateData } from "./data";
import type { useDraft } from "./draft";
import { BarSummary, Flow, PickedRow, PriceCard, StepHead, SumRow, reachable, stepPath } from "./flow";
import { Icon, Note, about, messageOf, plural, useApi } from "./kit";
import { useState } from "react";
import cleanImg from "./img/clean.webp";
import foldedImg from "./img/folded.webp";
import styledImg from "./img/styled.webp";
import gFront from "./img/pocket-front.webp";
import gThreeQ from "./img/pocket-three-quarter.webp";
import gSide from "./img/pocket-side.webp";
import gBackThreeQ from "./img/pocket-back-three-quarter.webp";
import gBack from "./img/pocket-back.webp";

type Draft = ReturnType<typeof useDraft>;

const FLAT: { style: FlatLayStyle; name: string; sub: string; img: string }[] = [
  { style: "clean", name: "Clean", sub: "White, marketplace ready", img: cleanImg },
  { style: "folded", name: "Neatly folded", sub: "A shop fold", img: foldedImg },
  { style: "styled", name: "Styled", sub: "Linen, wood or marble", img: styledImg },
];
const GHOST: { angle: GhostAngle; name: string; sub: string; img: string; needsBack?: boolean }[] = [
  { angle: "front", name: GHOST_ANGLE_NAME["front"], sub: "Straight on", img: gFront },
  { angle: "three-quarter", name: GHOST_ANGLE_NAME["three-quarter"], sub: "Turned 45°", img: gThreeQ },
  { angle: "side", name: GHOST_ANGLE_NAME["side"], sub: "Turned 90°", img: gSide },
  {
    angle: "back-three-quarter",
    name: GHOST_ANGLE_NAME["back-three-quarter"],
    sub: "Turned from behind",
    img: gBackThreeQ,
    needsBack: true,
  },
  { angle: "back", name: GHOST_ANGLE_NAME["back"], sub: "From behind", img: gBack },
];

function useMake(draft: Draft) {
  const api = useApi();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function make() {
    if (!api || !draft.shoot || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.makeShoot(draft.shoot.id);
      void nav(`/shoots/${draft.shoot.id}`);
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  return { make, busy, err };
}

function Aside({
  draft,
  picked,
  noun,
  rows,
}: {
  draft: Draft;
  picked: { img: string; name: string }[];
  noun: string;
  rows: React.ReactNode;
}) {
  const { shoot, product } = draft;
  const front = product?.photos.find((p) => p.role === "front") ?? product?.photos[0];
  const q = shoot?.quality ?? "standard";
  return (
    <>
      <div className="card summary-card">
        <SumRow k="Product" v={product?.name} img={front?.url} contain to={stepPath(shoot?.id, "product")} />
        <PickedRow label={`${noun} · ${picked.length}`} shots={picked} max={Math.max(picked.length, 0)} contain={noun === "Angles"} />
        {rows}
      </div>
      <PriceCard
        quality={q}
        count={picked.length}
        unitLabel={noun === "Styles" ? "style" : "angle"}
        editable
        onQuality={(x: Quality) => draft.patch({ quality: x })}
      />
    </>
  );
}

export function FlatLayStep({ draft, data }: { draft: Draft; data: CreateData }) {
  const { shoot, product } = draft;
  const { make, busy, err } = useMake(draft);
  const plan = (shoot?.plan ?? []).filter((p): p is Extract<ShotPlan, { kind: "flat-lay" }> => p.kind === "flat-lay");
  const hasBack = !!product?.photos.some((p) => p.role === "back");
  const side = plan[0]?.side === "back" && hasBack ? "back" : "front";
  const picked = FLAT.filter((f) => plan.some((p) => p.style === f.style));
  const per = ESTIMATE_USD.photo[shoot?.quality ?? "standard"];
  const canMake = data.conn ? data.conn.canMakePhotos : true;
  const write = (styles: FlatLayStyle[], s: "front" | "back") =>
    draft.patch({ plan: styles.map((style) => ({ kind: "flat-lay" as const, style, side: s })) });
  const toggle = (style: FlatLayStyle) => {
    const cur = picked.map((p) => p.style);
    write(
      cur.includes(style) ? cur.filter((x) => x !== style) : FLAT.map((f) => f.style).filter((x) => x === style || cur.includes(x)),
      side,
    );
  };
  return (
    <Flow
      kind="flat-lay"
      current="styles"
      shootId={shoot?.id}
      reach={reachable(shoot, !!product?.photos.length)}
      crumb={`Flat-lay · ${product?.name ?? ""}`}
      back={stepPath(shoot?.id, "product")}
      saving={draft.saving}
      saveError={draft.saveError}
      aside={<Aside draft={draft} noun="Styles" picked={picked.map((p) => ({ img: p.img, name: p.name }))} rows={null} />}
      bar={
        <>
          <BarSummary
            thumbs={picked.map((p) => p.img)}
            contain
            title={picked.length ? plural(picked.length, "style") : "Pick a style"}
            sub={`${plural(picked.length, "photo")} · ${(shoot?.quality ?? "standard") === "high" ? "High" : "Standard"} quality`}
          />
          <Link className="btn btn-secondary" to={stepPath(shoot?.id, "product")}>
            Back
          </Link>
          <button className="btn btn-primary" disabled={!canMake || !picked.length || busy} onClick={make}>
            {busy ? "Starting" : `Make ${plural(picked.length, "photo")}`} <span className="cost">{about(per * picked.length)}</span>
          </button>
        </>
      }
    >
      <StepHead
        eyebrow={`Flat-lay · ${product?.name ?? ""}`}
        title="Choose"
        em="styles"
        lede="Your product laid flat and shot from above. One square photo per style."
      />
      {!canMake && (
        <Note
          tone="warning"
          icon="key"
          style={{ marginBottom: "var(--s-4)" }}
          action={
            <Link className="btn btn-secondary btn-sm" to="/settings">
              Add your key
            </Link>
          }
        >
          Add your OpenAI key in Settings to make photos.
        </Note>
      )}
      {err && (
        <Notice tone="danger" style={{ marginBottom: "var(--s-4)" }}>
          {err}
        </Notice>
      )}
      <div className="styles">
        {FLAT.map((f) => (
          <button
            key={f.style}
            className="tile selectable"
            aria-selected={picked.some((p) => p.style === f.style)}
            onClick={() => toggle(f.style)}
          >
            <div className="media" style={{ ["--ratio" as string]: "1/1" }}>
              <img src={f.img} alt={`${f.name} example`} />
              <span className="sel-mark">
                <Icon name="check" size="sm" />
              </span>
            </div>
            <div className="cap">
              <div className="grow">
                <div className="t">{f.name}</div>
                <div className="m wrap">{f.sub}</div>
                <span className="cost">{about(per)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="sidebar-row mt-6">
        <span className="label">Side</span>
        <div className="chips" data-single>
          <button
            className="chip"
            aria-pressed={side === "front"}
            onClick={() =>
              write(
                picked.map((p) => p.style),
                "front",
              )
            }
          >
            Front
          </button>
          <button
            className="chip"
            aria-pressed={side === "back"}
            disabled={!hasBack}
            onClick={() =>
              write(
                picked.map((p) => p.style),
                "back",
              )
            }
          >
            Back
          </button>
        </div>
        <span className="t-caption">
          {hasBack ? (
            `Back is offered because your ${product?.reading?.label?.toLowerCase() ?? "product"} has a back photo.`
          ) : (
            <>
              Add a{" "}
              <Link className="link" to={stepPath(shoot?.id, "product")}>
                back photo
              </Link>{" "}
              to get the back side.
            </>
          )}
        </span>
      </div>
      <div className="row spread mt-4" style={{ flexWrap: "wrap" }}>
        <div className="t-small">
          <b>One square photo per style</b> <span className="muted">· {about(per)} each</span>
        </div>
      </div>
    </Flow>
  );
}

export function GhostStep({ draft, data }: { draft: Draft; data: CreateData }) {
  const { shoot, product } = draft;
  const { make, busy, err } = useMake(draft);
  const plan = (shoot?.plan ?? []).filter((p): p is Extract<ShotPlan, { kind: "ghost" }> => p.kind === "ghost");
  const hasBack = !!product?.photos.some((p) => p.role === "back");
  const picked = GHOST.filter((g) => plan.some((p) => p.angle === g.angle) && (!g.needsBack || hasBack));
  const per = ESTIMATE_USD.photo[shoot?.quality ?? "standard"];
  const canMake = data.conn ? data.conn.canMakePhotos : true;
  const toggle = (a: GhostAngle) => {
    const cur = picked.map((p) => p.angle);
    const next = GHOST.map((g) => g.angle).filter((x) => (x === a ? !cur.includes(a) : cur.includes(x)));
    draft.patch({ plan: next.map((angle) => ({ kind: "ghost" as const, angle })) });
  };
  const label = product?.reading?.label?.toLowerCase() ?? "product";
  return (
    <Flow
      kind="ghost"
      current="angles"
      shootId={shoot?.id}
      reach={reachable(shoot, !!product?.photos.length)}
      crumb={`Ghost mannequin · ${product?.name ?? ""}`}
      back={stepPath(shoot?.id, "product")}
      saving={draft.saving}
      saveError={draft.saveError}
      aside={
        <Aside
          draft={draft}
          noun="Angles"
          picked={picked.map((p) => ({ img: p.img, name: p.name }))}
          rows={<SumRow k="Background" v="White" icon="sun" subtle />}
        />
      }
      bar={
        <>
          <BarSummary
            thumbs={picked.map((p) => p.img)}
            contain
            title={picked.length ? plural(picked.length, "angle") : "Pick an angle"}
            sub={`${plural(picked.length, "photo")} · ${(shoot?.quality ?? "standard") === "high" ? "High" : "Standard"} quality`}
          />
          <Link className="btn btn-secondary" to={stepPath(shoot?.id, "product")}>
            Back
          </Link>
          <button className="btn btn-primary" disabled={!canMake || !picked.length || busy} onClick={make}>
            {busy ? "Starting" : `Make ${plural(picked.length, "photo")}`} <span className="cost">{about(per * picked.length)}</span>
          </button>
        </>
      }
    >
      <StepHead
        eyebrow={`Ghost mannequin · ${product?.name ?? ""}`}
        title="Choose"
        em="angles"
        lede="The garment alone, with an invisible 3D fit. Pick the angles you need."
      />
      {!canMake && (
        <Note
          tone="warning"
          icon="key"
          style={{ marginBottom: "var(--s-4)" }}
          action={
            <Link className="btn btn-secondary btn-sm" to="/settings">
              Add your key
            </Link>
          }
        >
          Add your OpenAI key in Settings to make photos.
        </Note>
      )}
      {err && (
        <Notice tone="danger" style={{ marginBottom: "var(--s-4)" }}>
          {err}
        </Notice>
      )}
      <div className="angles">
        {GHOST.map((g) => {
          const locked = g.needsBack && !hasBack;
          const n = picked.findIndex((p) => p.angle === g.angle) + 1;
          if (locked) {
            return (
              <div key={g.angle} className="tile disabled contain" aria-disabled="true">
                <div className="media" style={{ ["--ratio" as string]: "1/1" }}>
                  <img src={g.img} alt={`${g.name} example`} style={{ objectFit: "contain" }} />
                  <span className="lockmark">
                    <Icon name="lock" />
                  </span>
                </div>
                <div className="cap">
                  <div className="grow">
                    <div className="t">{g.name}</div>
                    <div className="m wrap">Add a back photo to get this angle</div>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <button key={g.angle} className="tile selectable contain" aria-selected={n > 0} onClick={() => toggle(g.angle)}>
              <div className="media" style={{ ["--ratio" as string]: "1/1" }}>
                <img src={g.img} alt={`${g.name} example`} style={{ objectFit: "contain" }} />
                <span className="sel-mark">{n ? <span className="order">{n}</span> : <Icon name="check" size="sm" />}</span>
              </div>
              <div className="cap">
                <div className="grow">
                  <div className="t">{g.name}</div>
                  <div className="m wrap">{g.sub}</div>
                  <span className="cost">{about(per)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="row spread mt-4" style={{ flexWrap: "wrap" }}>
        <div className="t-small">
          <b>One photo per angle</b> <span className="muted">· {about(per)} each</span>
        </div>
        <span className="t-caption">{plural(picked.length, "angle")} picked</span>
      </div>
      {!hasBack && (
        <Note
          tone="info"
          style={{ marginTop: "var(--s-4)" }}
          action={
            <Link className="btn btn-secondary btn-sm" to={stepPath(shoot?.id, "product")}>
              Add back photo
            </Link>
          }
        >
          {GHOST_ANGLE_NAME["back-three-quarter"]} needs a back photo of your {label}.
        </Note>
      )}
      <Note icon="sun" style={{ marginTop: "var(--s-4)" }}>
        On a white background. Save on transparent or light grey later.
      </Note>
      <p className="t-caption mt-4">Examples show a plain T-shirt. Your photos show your own garment.</p>
    </Flow>
  );
}
