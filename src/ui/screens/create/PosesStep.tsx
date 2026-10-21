import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { CatalogPose, OwnPose, PoseRef, ShotPlan } from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import { FRAMING_NAMES, framingName } from "../../../lib/labels";
import { LoadError } from "../../components/Notice";
import { Segmented } from "../../components/controls";
import type { CreateData } from "./data";
import type { useDraft } from "./draft";
import { DescribePoseDialog, MakePoseDialog } from "./dialogs";
import { BarSummary, Flow, PickedRow, PriceCard, StepHead, SumRow, reachable, stepPath } from "./flow";
import { ChipMenu, Icon, TileSkeletons, about, fmtDate, humanize, matches, useDebounced } from "./kit";

type Draft = ReturnType<typeof useDraft>;
export const MAX_POSES = 6;
const PAGE = 24;

export const poseKey = (p: PoseRef) => (p.source === "words" ? "words:" + p.words : p.source + ":" + p.id);
export const modelShots = (plan: ShotPlan[]) => plan.filter((p): p is Extract<ShotPlan, { kind: "model" }> => p.kind === "model");

function poseSub(p: CatalogPose) {
  return [framingName(p.framing), p.style[0] ? humanize(p.style[0]) : ""].filter(Boolean).join(" · ") || "Studio pose";
}

export function PosesStep({ draft, data }: { draft: Draft; data: CreateData }) {
  const { shoot, product } = draft;
  const [tab, setTab] = useState<"sug" | "all" | "own">("sug");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [framing, setFraming] = useState<string[]>([]);
  const [style, setStyle] = useState<string[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [dlg, setDlg] = useState<"make" | "describe" | null>(null);
  const [full, setFull] = useState(false);
  const [described, setDescribed] = useState<string[]>(() =>
    modelShots(shoot?.plan ?? []).flatMap((s) => (s.pose.source === "words" ? [s.pose.words] : [])),
  );

  const shots = modelShots(shoot?.plan ?? []);
  const order = new Map(shots.map((s, i) => [poseKey(s.pose), i + 1]));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the empty fallback only matters while loading; the memo below is cheap
  const pins = data.settings?.pins.poses ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the empty fallback only matters while loading; the memo below is cheap
  const studio = data.poses.data?.studio ?? [];
  const mine = data.poses.data?.own ?? [];
  const info = data.modelInfo;
  const type = product?.reading?.productType ?? null;
  const label = product?.reading?.label;

  function toggle(pose: PoseRef) {
    if (!shoot) return;
    const k = poseKey(pose);
    const plan = shoot.plan;
    if (order.has(k)) {
      setFull(false);
      draft.patch({ plan: plan.filter((s) => !(s.kind === "model" && poseKey(s.pose) === k)) });
      return;
    }
    if (shots.length >= MAX_POSES) {
      setFull(true);
      return;
    }
    draft.patch({ plan: [...plan, { kind: "model", pose, frame: "as-posed", expression: "as-posed" }] });
  }

  const filterPose = (p: CatalogPose) =>
    (!framing.length || framing.includes(framingName(p.framing) ?? "")) &&
    (!style.length || p.style.some((s) => style.includes(s))) &&
    matches(dq, p.name, framingName(p.framing), ...p.style, ...p.best, ...p.also);
  const shown = new Set(studio.map((p) => framingName(p.framing)));
  const framings = FRAMING_NAMES.filter((name) => shown.has(name));
  const styles = Array.from(new Set(studio.flatMap((p) => p.style))).sort();

  const suggested = useMemo(() => {
    const score = (p: CatalogPose) => (type && p.best.includes(type) ? 0 : type && p.also.includes(type) ? 1 : 2);
    const list = [...studio].sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)) || score(a) - score(b));
    const fit = type ? list.filter((p) => score(p) < 2) : [];
    return { list: (fit.length ? fit : list.slice(0, 12)).slice(0, 24), fit: fit.length > 0 };
  }, [studio, type, pins]);

  const poseTile = (p: CatalogPose) => {
    const ref: PoseRef = { source: "studio", id: p.id };
    const n = order.get(poseKey(ref));
    const pinned = pins.includes(p.id);
    return (
      <div
        key={p.id}
        className="tile selectable"
        aria-selected={!!n}
        role="button"
        tabIndex={0}
        onClick={() => toggle(ref)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle(ref);
          }
        }}
      >
        <div className="media">
          <span className="over-tl">
            <button
              className={`icon-btn-glass${pinned ? " on" : " hover-only"}`}
              title={pinned ? "Unpin" : "Pin"}
              aria-label={pinned ? `Unpin ${p.name}` : `Pin ${p.name}`}
              onClick={(e) => {
                e.stopPropagation();
                data.togglePin("poses", p.id);
              }}
            >
              <Icon name="pin" />
            </button>
          </span>
          <img src={p.imageUrl} alt="" loading="lazy" />
          <span className="sel-mark">{n ? <span className="order">{n}</span> : null}</span>
          {p.shownOn && (
            <span className="over-bl">
              <span className="badge glass pill">Shown on {p.shownOn.name}</span>
            </span>
          )}
        </div>
        <div className="cap">
          <div className="grow">
            <div className="t">{p.name}</div>
            <div className="m">{poseSub(p)}</div>
          </div>
        </div>
      </div>
    );
  };

  const ownTile = (p: OwnPose) => {
    const ref: PoseRef = { source: "own", id: p.id };
    const n = order.get(poseKey(ref));
    const ready = p.status === "ready";
    return (
      <button key={p.id} className="tile selectable" aria-selected={!!n} disabled={!ready} onClick={() => ready && toggle(ref)}>
        <div className="media">
          {p.imageUrl && (
            <img
              src={p.imageUrl}
              alt=""
              loading="lazy"
              style={p.status === "making" ? { filter: "blur(10px) saturate(.6)", transform: "scale(1.1)" } : undefined}
            />
          )}
          {p.status === "making" && (
            <div className="making">
              <span className="spinner" />
              <span style={{ fontWeight: 600, color: "var(--fg)" }}>Making the pose</span>
            </div>
          )}
          {ready && <span className="sel-mark">{n ? <span className="order">{n}</span> : null}</span>}
          <span className="over-bl">
            {p.status === "failed" ? (
              <span className="badge danger pill">Didn't work</span>
            ) : (
              <span className="badge glass pill">Made by you</span>
            )}
          </span>
        </div>
        <div className="cap">
          <div className="grow">
            <div className="t">{p.name || p.words || "Your pose"}</div>
            <div className="m">
              {p.status === "failed"
                ? "Not billed if OpenAI refused"
                : p.status === "making"
                  ? "About a minute"
                  : `Made ${fmtDate(p.createdAt)}`}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const wordsTile = (w: string) => {
    const ref: PoseRef = { source: "words", words: w };
    const n = order.get(poseKey(ref));
    return (
      <button key={w} className="tile selectable words" aria-selected={!!n} onClick={() => toggle(ref)}>
        <div className="media" style={{ ["--ratio" as string]: "3/4" }}>
          <div className="wt">{w}</div>
          <span className="sel-mark">{n ? <span className="order">{n}</span> : null}</span>
          <span className="over-bl">
            <span className="badge glass pill">Described</span>
          </span>
        </div>
        <div className="cap">
          <div className="grow">
            <div className="t">Described pose</div>
            <div className="m">Used as written</div>
          </div>
        </div>
      </button>
    );
  };

  const addTile = (icon: "plus" | "edit", title: string, sub: string, cost: string, onClick: () => void) => (
    <button className="tile add" onClick={onClick}>
      <div className="media" style={{ ["--ratio" as string]: "3/4" }}>
        <div>
          <span className="plus-disc">
            <Icon name={icon} />
          </span>
          <div className="t-small" style={{ fontWeight: 600, color: "var(--fg)" }}>
            {title}
          </div>
          <div className="t-caption mt-1">{sub}</div>
          <div className="cost mt-2" style={{ display: "block" }}>
            {cost}
          </div>
        </div>
      </div>
      <div className="cap">
        <div className="grow">
          <div className="t">&nbsp;</div>
        </div>
      </div>
    </button>
  );

  const reach = reachable(shoot, !!product?.photos.length);
  const front = product?.photos.find((p) => p.role === "front") ?? product?.photos[0];
  const n = shots.length;
  const per = ESTIMATE_USD.photo[shoot?.quality ?? "standard"];
  const allList = studio.filter(filterPose).sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)));
  const filtersOn = framing.length + style.length > 0;
  const loading = data.poses.loading && !data.poses.data;

  return (
    <Flow
      kind="model"
      current="poses"
      shootId={shoot?.id}
      reach={reach}
      crumb={product?.name || "Your product"}
      back={stepPath(shoot?.id, "model")}
      saving={draft.saving}
      saveError={draft.saveError}
      aside={
        <div className="stack" style={{ ["--gap" as string]: "var(--s-4)" }}>
          <div className="card summary-card">
            <SumRow k="Product" v={product?.name} img={front?.url} contain to={stepPath(shoot?.id, "product")} />
            <SumRow
              k="Model"
              v={info ? [info.name, info.age].filter(Boolean).join(" · ") : ""}
              img={info?.img}
              sheet={info?.sheet}
              to={stepPath(shoot?.id, "model")}
            />
            <PickedRow
              label={`Poses · ${n} of ${MAX_POSES}`}
              shots={shots.map((s) => ({ img: data.poseInfo(s.pose).img, name: data.poseInfo(s.pose).name }))}
            />
            <SumRow k="Scene" v="Next step" icon="picture" subtle />
          </div>
          <PriceCard quality={shoot?.quality ?? "standard"} count={n}>
            {n
              ? "Standard quality. You can change this on the last step. Nothing is sent until you press Make."
              : "Pick up to 6 poses. Each one is a photo."}
          </PriceCard>
        </div>
      }
      bar={
        <>
          <BarSummary
            thumbs={shots.map((s) => data.poseInfo(s.pose).img)}
            title={n ? `${n} ${n === 1 ? "pose" : "poses"} picked` : "Pick a pose"}
            sub={n ? `${n} ${n === 1 ? "photo" : "photos"} · ${about(per * n)}` : "up to 6, each one is a photo"}
          />
          <Link className="btn btn-secondary" to={stepPath(shoot?.id, "model")}>
            Back
          </Link>
          {n ? (
            <Link className="btn btn-primary" to={stepPath(shoot?.id, "scene")}>
              Next: scene <Icon name="right" />
            </Link>
          ) : (
            <button className="btn btn-primary" disabled>
              Next: scene <Icon name="right" />
            </button>
          )}
        </>
      }
    >
      <StepHead
        eyebrow={`On a model${info ? ` · ${info.name}` : ""}`}
        title="Choose"
        em="poses"
        lede={`Pick up to 6. Each pose is one photo.${label ? ` Poses made for ${label}${label.endsWith("s") ? "" : "s"} come first.` : ""}`}
      />
      <div className="toolbar">
        <Segmented<"sug" | "all" | "own">
          label="Pose source"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setLimit(PAGE);
          }}
          options={[
            { value: "sug", label: "Suggested" },
            { value: "all", label: "All", count: studio.length || undefined },
            { value: "own", label: "Yours" },
          ]}
        />
        <div className="grow" />
        {tab !== "own" && (
          <>
            <label className="input-wrap search-wrap" style={{ width: "min(220px,100%)" }}>
              <Icon name="search" />
              <input
                className="input search"
                placeholder="Search poses"
                aria-label="Search poses"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className="chips">
              {framings.length > 1 && (
                <ChipMenu label="Framing" options={framings.map((v) => ({ value: v, label: v }))} value={framing} onChange={setFraming} />
              )}
              {styles.length > 1 && (
                <ChipMenu label="Style" options={styles.map((v) => ({ value: v, label: humanize(v) }))} value={style} onChange={setStyle} />
              )}
            </div>
          </>
        )}
      </div>
      {full && (
        <div className="notice warning" style={{ marginBottom: "var(--s-4)" }} role="status">
          <Icon name="info" />
          <span>You can pick up to 6 poses. Take one off to pick another.</span>
        </div>
      )}
      {data.poses.error && !data.poses.data ? (
        <LoadError onRetry={data.poses.reload}>We couldn't load the poses.</LoadError>
      ) : loading ? (
        <TileSkeletons n={8} ratio="2/3" />
      ) : tab === "sug" ? (
        <div data-single>
          <div className="section-head">
            <h2 className="t-title">
              {suggested.fit ? `Made for ${label ? label + (label.endsWith("s") ? "" : "s") : "your product"}` : "Suggested"}
            </h2>
            <span className="t-caption">
              {n} of {MAX_POSES} picked
            </span>
          </div>
          {suggested.list.filter(filterPose).length ? (
            <div className="grid c4">{suggested.list.filter(filterPose).map(poseTile)}</div>
          ) : (
            <PoseEmpty
              studio={studio.length}
              onClear={() => {
                setQ("");
                setFraming([]);
                setStyle([]);
              }}
              filtersOn={filtersOn || !!dq}
            />
          )}
        </div>
      ) : tab === "all" ? (
        <div>
          <div className="section-head">
            <h2 className="t-title">All poses</h2>
            <span className="t-caption num">
              Showing {Math.min(limit, allList.length)} of {allList.length}
            </span>
          </div>
          {allList.length ? (
            <div className="grid c4">{allList.slice(0, limit).map(poseTile)}</div>
          ) : (
            <PoseEmpty
              studio={studio.length}
              onClear={() => {
                setQ("");
                setFraming([]);
                setStyle([]);
              }}
              filtersOn={filtersOn || !!dq}
            />
          )}
          {allList.length > limit && (
            <div className="more-row">
              <button className="btn btn-secondary" onClick={() => setLimit(limit + PAGE)}>
                Show {Math.min(PAGE, allList.length - limit)} more
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="section-head">
            <h2 className="t-title">Your poses</h2>
            <span className="t-caption">Only on this computer</span>
          </div>
          <div className="grid c4">
            {addTile("plus", "Make a pose", "From words or a photo", about(ESTIMATE_USD.pose), () => setDlg("make"))}
            {addTile("edit", "Describe a pose", "Words only", "Free", () => setDlg("describe"))}
            {described.map(wordsTile)}
            {mine.map(ownTile)}
          </div>
        </div>
      )}
      {dlg === "make" && shoot?.model && (
        <MakePoseDialog model={shoot.model} modelName={info?.name} onClose={() => setDlg(null)} onMade={() => data.poses.reload()} />
      )}
      {dlg === "describe" && (
        <DescribePoseDialog
          modelName={info?.name}
          onClose={() => setDlg(null)}
          onUse={(w) => {
            setDescribed((d) => (d.includes(w) ? d : [...d, w]));
            toggle({ source: "words", words: w });
          }}
        />
      )}
    </Flow>
  );
}

function PoseEmpty({ studio, filtersOn, onClear }: { studio: number; filtersOn: boolean; onClear: () => void }) {
  return (
    <div className="empty">
      <span className="art">
        <Icon name="search" />
      </span>
      <h2 className="t-section">{studio === 0 ? "No studio poses for this model yet" : "No poses found"}</h2>
      <p>{studio === 0 ? "Describe a pose in words or make one of your own in Yours." : "Try another search or fewer filters."}</p>
      {filtersOn && (
        <button className="btn btn-secondary" onClick={onClear}>
          Clear search and filters
        </button>
      )}
    </div>
  );
}
