import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Expression, Frame } from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import { Notice } from "../../components/Notice";
import type { CreateData } from "./data";
import type { useDraft } from "./draft";
import { BarSummary, Flow, StepHead, reachable, stepPath } from "./flow";
import { Icon, Note, Pic, about, messageOf, plural, useApi } from "./kit";
import { modelShots } from "./PosesStep";
import { PriceCard } from "./flow";

type Draft = ReturnType<typeof useDraft>;

export const FRAMES: [Frame, string][] = [
  ["as-posed", "As posed"],
  ["full-length", "Full length"],
  ["head-to-knee", "Head to knee"],
  ["waist-up", "Waist up"],
  ["close-up", "Close-up"],
];
export const EXPRESSIONS: [Expression, string][] = [
  ["as-posed", "As posed"],
  ["neutral", "Neutral"],
  ["soft-smile", "Soft smile"],
  ["big-smile", "Big smile"],
  ["serious", "Serious"],
  ["looking-away", "Looking away"],
];

export function ReviewStep({ draft, data }: { draft: Draft; data: CreateData }) {
  const api = useApi();
  const nav = useNavigate();
  const { shoot, product } = draft;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const plan = shoot?.plan ?? [];
  const shots = modelShots(plan);
  const n = shots.length;
  const quality = shoot?.quality ?? "standard";
  const per = ESTIMATE_USD.photo[quality];
  const info = data.modelInfo;
  const sc = data.sceneInfo;
  const front = product?.photos.find((p) => p.role === "front") ?? product?.photos[0];
  const reading = product?.reading;
  const canMake = data.conn ? data.conn.canMakePhotos : true;
  const reach = reachable(shoot, !!product?.photos.length);

  function update(i: number, change: { frame?: Frame; expression?: Expression }) {
    let k = -1;
    draft.patch({
      plan: plan.map((s) => {
        if (s.kind !== "model") return s;
        k++;
        return k === i ? { ...s, ...change } : s;
      }),
    });
  }
  function remove(i: number) {
    let k = -1;
    draft.patch({
      plan: plan.filter((s) => {
        if (s.kind !== "model") return true;
        k++;
        return k !== i;
      }),
    });
  }

  async function make() {
    if (!api || !shoot || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.makeShoot(shoot.id);
      void nav(`/shoots/${shoot.id}`);
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <Flow
      kind="model"
      current="review"
      shootId={shoot?.id}
      reach={reach}
      crumb={product?.name || "Your product"}
      back={stepPath(shoot?.id, "scene")}
      saving={draft.saving}
      saveError={draft.saveError}
      aside={
        <>
          <PriceCard quality={quality} count={n} editable onQuality={(q) => draft.patch({ quality: q })}>
            Billed by OpenAI to your key. Nothing is sent until you press Make.
          </PriceCard>
          <div className="card pad t-caption" style={{ padding: "var(--s-4)" }}>
            <b style={{ color: "var(--fg)" }}>A photo OpenAI refuses isn't charged.</b> Finished photos are saved to{" "}
            <span className="t-mono">{data.settings?.photosFolder ?? "your photos folder"}</span>.
          </div>
        </>
      }
      bar={
        <>
          <BarSummary
            thumbs={shots.map((s) => data.poseInfo(s.pose).img)}
            title={plural(n, "photo")}
            sub={canMake ? `${quality === "high" ? "High" : "Standard"} quality · ${about(per * n)}` : "Add your key to continue"}
          />
          <Link className="btn btn-secondary" to={stepPath(shoot?.id, "scene")}>
            Back
          </Link>
          <button className="btn btn-primary" disabled={!canMake || n === 0 || busy} onClick={make}>
            {busy ? "Starting" : `Make ${plural(n, "photo")}`} <span className="cost">{about(per * n)}</span>
          </button>
        </>
      }
    >
      <StepHead
        eyebrow={`On a model${info ? ` · ${info.name}` : ""}`}
        title=""
        em="Review"
        lede={`${plural(n, "photo")}, one per pose. Each is usually ready in about a minute.`}
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
          Add your OpenAI key in Settings to make photos. You can still change everything here.
        </Note>
      )}
      {err && (
        <Notice tone="danger" style={{ marginBottom: "var(--s-4)" }}>
          {err}
        </Notice>
      )}
      <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
        <div className="card card-row">
          {front && (
            <img
              src={front.url}
              alt=""
              style={{
                width: 56,
                height: 56,
                borderRadius: "var(--r-sm)",
                objectFit: "contain",
                background: "#fff",
                border: "1px solid var(--line)",
              }}
            />
          )}
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{product?.name}</div>
            <div className="t-caption">
              {[plural(product?.photos.length ?? 0, "photo"), reading?.label, reading?.colour].filter(Boolean).join(" · ")}
            </div>
          </div>
          <Link className="btn btn-secondary btn-sm" to={stepPath(shoot?.id, "product")}>
            Change
          </Link>
        </div>
        <div className="pair">
          <div className="card pickcard">
            {info?.img ? (
              <Pic src={info.img} sheet={info.sheet} alt={info.name} />
            ) : (
              <span className="ph">
                <Icon name="user" />
              </span>
            )}
            <div className="grow">
              <div className="k">Model</div>
              <div className="v">{info?.name}</div>
              <div className="s">
                {info?.own ? "Your model" : "Studio model"}
                {info?.age ? ` · ${info.age}` : ""}
              </div>
            </div>
            <Link className="btn btn-secondary btn-sm" to={stepPath(shoot?.id, "model")}>
              Change
            </Link>
          </div>
          <div className="card pickcard">
            {sc?.img ? (
              <img src={sc.img} alt="" />
            ) : (
              <span className="ph" style={sc?.colour ? { background: sc.colour } : undefined}>
                <Icon name="sun" />
              </span>
            )}
            <div className="grow">
              <div className="k">Scene</div>
              <div className="v">{sc?.name}</div>
              <div className="s">{sc?.sub}</div>
            </div>
            <Link className="btn btn-secondary btn-sm" to={stepPath(shoot?.id, "scene")}>
              Change
            </Link>
          </div>
        </div>
        <div>
          <div className="section-head">
            <h2 className="t-title">Poses</h2>
            <Link className="link" to={stepPath(shoot?.id, "poses")}>
              Add or change poses
            </Link>
          </div>
          {n === 0 && (
            <div className="empty" style={{ padding: "var(--s-10) var(--s-6)" }}>
              <span className="art">
                <Icon name="people" />
              </span>
              <h2 className="t-section">No poses picked</h2>
              <p>Pick at least one pose to make a photo.</p>
              <Link className="btn btn-primary" to={stepPath(shoot?.id, "poses")}>
                Choose poses
              </Link>
            </div>
          )}
          {shots.map((s, i) => {
            const pi = data.poseInfo(s.pose);
            return (
              <div className="card prow" key={i + JSON.stringify(s.pose)}>
                <div className="th">{pi.img ? <img src={pi.img} alt={pi.name} /> : <Icon name="edit" size="sm" />}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{pi.name}</div>
                  <div className="t-caption">{pi.sub}</div>
                  <div className="opts">
                    <div className="opt">
                      <span className="lab">Frame</span>
                      <div className="chips" data-single>
                        {FRAMES.map(([v, l]) => (
                          <button key={v} className="chip chip-sm" aria-pressed={s.frame === v} onClick={() => update(i, { frame: v })}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="opt">
                      <span className="lab">Expression</span>
                      <div className="chips" data-single>
                        {EXPRESSIONS.map(([v, l]) => (
                          <button
                            key={v}
                            className="chip chip-sm"
                            aria-pressed={s.expression === v}
                            onClick={() => update(i, { expression: v })}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove pose" title="Remove pose" onClick={() => remove(i)}>
                  <Icon name="x" />
                </button>
              </div>
            );
          })}
          {n > 0 && <p className="t-caption mt-4">Frame and expression are free. Pick As posed to keep the pose photo exactly.</p>}
        </div>
      </div>
    </Flow>
  );
}
