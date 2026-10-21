import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import type { CatalogScene, OwnScene, SceneRef } from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import { Dialog } from "../../components/Dialog";
import { LoadError } from "../../components/Notice";
import { Chip, Segmented } from "../../components/controls";
import { nearestColourName } from "./colourNames";
import type { CreateData } from "./data";
import type { useDraft } from "./draft";
import { MakeSceneDialog } from "./dialogs";
import { BarSummary, Flow, PickedRow, PriceCard, StepHead, SumRow, reachable, stepPath } from "./flow";
import { Icon, TileSkeletons, about, fmtDate, humanize, matches, useDebounced } from "./kit";
import { modelShots } from "./PosesStep";

type Draft = ReturnType<typeof useDraft>;
const PAGE = 24;

export const WHITE: SceneRef = { source: "colour", hex: "#ffffff", name: "White studio" };
const SWATCHES: [string, string][] = [
  ["White", "#ffffff"],
  ["Ivory", "#f6f1e3"],
  ["Light grey", "#d9d9d6"],
  ["Charcoal", "#3b3b3b"],
  ["Black", "#111111"],
  ["Navy", "#1f2a4d"],
  ["Cobalt", "#1f4fd1"],
  ["Sky blue", "#8fc3ec"],
  ["Sage", "#9caf88"],
  ["Forest green", "#2f5d3a"],
  ["Mint", "#bfe3cf"],
  ["Mustard", "#d8a21c"],
  ["Terracotta", "#c2643f"],
  ["Rust", "#a4472a"],
  ["Blush", "#efb7c0"],
  ["Dusty rose", "#c98a97"],
  ["Burgundy", "#6e1f33"],
  ["Lavender", "#b9a6df"],
  ["Beige", "#d8c4a4"],
];

export function parseHex(v: string): string | null {
  const s = v.trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    let h = m[1].toLowerCase();
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    return "#" + h;
  }
  const rgb = /^(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})$/.exec(s);
  if (rgb && [rgb[1], rgb[2], rgb[3]].every((n) => +n <= 255))
    return "#" + [rgb[1], rgb[2], rgb[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("");
  return null;
}

/** The fashion name of a colour, or its own code when nothing is close. */
export function colourLabel(hex: string): string {
  const n = nearestColourName(hex);
  return n ? n.name : hex.toUpperCase();
}

const same = (a: SceneRef | null, b: SceneRef) => {
  if (!a || a.source !== b.source) return false;
  if (a.source === "colour" && b.source === "colour") return a.hex.toLowerCase() === b.hex.toLowerCase();
  return (a as { id: string }).id === (b as { id: string }).id;
};

export function SceneStep({ draft, data }: { draft: Draft; data: CreateData }) {
  const { shoot, product } = draft;
  const [tab, setTab] = useState<"scenes" | "colour" | "own">("scenes");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [regions, setRegions] = useState<string[]>([]);
  const [regionDlg, setRegionDlg] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [makeDlg, setMakeDlg] = useState(false);

  // The first visit starts on White studio, as in the design.
  useEffect(() => {
    if (shoot && !shoot.scene) draft.patch({ scene: WHITE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shoot?.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the empty fallback only matters while loading; the memo below is cheap
  const scenes = data.scenes.data ?? [];
  const mine = data.ownScenes.data ?? [];
  const pins = data.settings?.pins.scenes ?? [];
  const type = product?.reading?.productType ?? null;
  const allRegions = Array.from(new Set(scenes.map((s) => s.region).filter((r): r is string => !!r && r !== "anywhere"))).sort();
  const pick = (s: SceneRef) => draft.patch({ scene: s });
  const cur = shoot?.scene ?? null;

  const filtered = useMemo(
    () =>
      scenes.filter(
        (s) =>
          (!regions.length || !s.region || s.region === "anywhere" || regions.includes(s.region)) &&
          matches(dq, s.name, ...s.bestFor, ...s.also, ...s.style, s.region),
      ),
    [scenes, regions, dq],
  );
  const rank = (s: CatalogScene) =>
    pins.includes(s.id) ? -1 : type && s.bestFor.includes(type) ? 0 : type && s.also.includes(type) ? 1 : s.plain ? 2 : 3;
  const sorted = useMemo(() => [...filtered].sort((a, b) => rank(a) - rank(b)), [filtered, type, pins]); // eslint-disable-line react-hooks/exhaustive-deps
  const searching = !!dq.trim() || regions.length > 0;
  const suggested = searching ? [] : sorted.filter((s) => rank(s) <= 1).slice(0, 8);
  const rest = searching ? sorted : sorted.filter((s) => !suggested.includes(s));

  const sceneTile = (s: CatalogScene) => {
    const ref: SceneRef = { source: "studio", id: s.id };
    const pinned = pins.includes(s.id);
    return (
      <div
        key={s.id}
        className="tile selectable"
        aria-selected={same(cur, ref)}
        role="button"
        tabIndex={0}
        onClick={() => pick(ref)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(ref);
          }
        }}
      >
        <div className="media" style={{ ["--ratio" as string]: "1/1" }}>
          <img src={s.imageUrl} alt={s.name} loading="lazy" />
          <span className="sel-mark">
            <Icon name="check" size="sm" />
          </span>
          <span className="over-tl">
            <button
              className={`icon-btn-glass${pinned ? " on" : " hover-only"}`}
              title={pinned ? "Unpin" : "Pin"}
              aria-label={pinned ? `Unpin ${s.name}` : `Pin ${s.name}`}
              onClick={(e) => {
                e.stopPropagation();
                data.togglePin("scenes", s.id);
              }}
            >
              <Icon name="pin" />
            </button>
          </span>
        </div>
        <div className="cap">
          <div className="grow">
            <div className="t">{s.name}</div>
            <div className="m">
              {[
                s.style[0] ? humanize(s.style[0]) : s.plain ? "Plain" : "",
                s.region && s.region !== "anywhere" ? humanize(s.region) : "anywhere",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </div>
      </div>
    );
  };
  const whiteTile = (
    <button className="tile selectable stu" aria-selected={same(cur, WHITE)} onClick={() => pick(WHITE)}>
      <div className="media" style={{ ["--ratio" as string]: "1/1" }}>
        <Icon name="sun" size="lg" />
        <span className="sel-mark">
          <Icon name="check" size="sm" />
        </span>
      </div>
      <div className="cap">
        <div className="grow">
          <div className="t">White studio</div>
          <div className="m">Plain white · anywhere</div>
        </div>
      </div>
    </button>
  );
  const ownTile = (s: OwnScene) => {
    const ref: SceneRef = { source: "own", id: s.id };
    const ready = s.status === "ready";
    return (
      <button key={s.id} className="tile selectable" disabled={!ready} aria-selected={same(cur, ref)} onClick={() => ready && pick(ref)}>
        <div className="media" style={{ ["--ratio" as string]: "1/1" }}>
          {s.imageUrl && (
            <img
              src={s.imageUrl}
              alt={s.name}
              loading="lazy"
              style={s.status === "making" ? { filter: "blur(10px) saturate(.6)", transform: "scale(1.1)" } : undefined}
            />
          )}
          {s.status === "making" && (
            <div className="making">
              <span className="spinner" />
              <span style={{ fontWeight: 600, color: "var(--fg)" }}>Making the scene</span>
            </div>
          )}
          {ready && (
            <span className="sel-mark">
              <Icon name="check" size="sm" />
            </span>
          )}
          <span className="over-bl">
            {s.status === "failed" ? (
              <span className="badge danger pill">Didn't work</span>
            ) : (
              <span className="badge glass pill">Made by you</span>
            )}
          </span>
        </div>
        <div className="cap">
          <div className="grow">
            <div className="t">{s.name || s.words || "Your scene"}</div>
            <div className="m">
              {s.status === "failed"
                ? "Not billed if OpenAI refused"
                : s.status === "making"
                  ? "About a minute"
                  : `Made ${fmtDate(s.createdAt)}`}
            </div>
          </div>
        </div>
      </button>
    );
  };

  // Colour tab: the hex field keeps what is typed until it is a real colour.
  const curColour = cur?.source === "colour" ? cur.hex : "#9caf88";
  const [hexText, setHexText] = useState(curColour);
  const curHex = cur?.source === "colour" ? cur.hex : "";
  // The colour the typed text picked: shown as typed ("#1f4" stays "#1f4"), not rewritten to its full code.
  const typedHex = useRef<string | null>(null);
  useEffect(() => {
    if (curHex && curHex !== typedHex.current) setHexText(curHex);
  }, [curHex]);
  const parsed = parseHex(hexText);
  const pickColour = (hex: string, name?: string) => pick({ source: "colour", hex, name: name ?? colourLabel(hex) });

  const reach = reachable(shoot, !!product?.photos.length);
  const front = product?.photos.find((p) => p.role === "front") ?? product?.photos[0];
  const shots = modelShots(shoot?.plan ?? []);
  const n = shots.length;
  const info = data.modelInfo;
  const per = ESTIMATE_USD.photo[shoot?.quality ?? "standard"];
  const sc = data.sceneInfo;
  const loading = data.scenes.loading && !data.scenes.data;
  const top = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <Flow
      kind="model"
      current="scene"
      shootId={shoot?.id}
      reach={reach}
      crumb={product?.name || "Your product"}
      back={stepPath(shoot?.id, "poses")}
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
              label={`Poses · ${n} of 6`}
              shots={shots.map((s) => ({ img: data.poseInfo(s.pose).img, name: data.poseInfo(s.pose).name }))}
            />
            {sc ? (
              <SumRow k="Scene" v={sc.name} img={sc.img} icon="sun" bg={sc.colour ?? undefined} onEdit={top} />
            ) : (
              <SumRow k="Scene" v="Choose one" icon="picture" subtle />
            )}
          </div>
          <PriceCard quality={shoot?.quality ?? "standard"} count={n}>
            Standard quality. You can change this on the last step. Nothing is sent until you press Make.
          </PriceCard>
        </div>
      }
      bar={
        <>
          <BarSummary
            thumbs={[...shots.map((s) => data.poseInfo(s.pose).img)].slice(0, 3)}
            title={sc?.name ?? "Pick a scene"}
            sub={`${n} ${n === 1 ? "photo" : "photos"} · ${about(per * n)}`}
          />
          <Link className="btn btn-secondary" to={stepPath(shoot?.id, "poses")}>
            Back
          </Link>
          {cur ? (
            <Link className="btn btn-primary" to={stepPath(shoot?.id, "review")}>
              Next: review <Icon name="right" />
            </Link>
          ) : (
            <button className="btn btn-primary" disabled>
              Next: review <Icon name="right" />
            </button>
          )}
        </>
      }
    >
      <StepHead
        eyebrow={`On a model${info ? ` · ${info.name}` : ""}`}
        title="Pick a"
        em="scene"
        lede="One scene for every photo. White studio suits most marketplaces."
      />
      <div className="toolbar">
        <Segmented<"scenes" | "colour" | "own">
          label="Scene source"
          value={tab}
          onChange={setTab}
          options={[
            { value: "scenes", label: "Scenes" },
            { value: "colour", label: "Colour" },
            { value: "own", label: "Your own" },
          ]}
        />
      </div>
      {tab === "scenes" && (
        <>
          <div className="toolbar">
            <label className="input-wrap search-wrap grow" style={{ minWidth: 150, flex: "1 1 150px" }}>
              <Icon name="search" />
              <input
                className="input search"
                placeholder="Search: festive, beach, night, saree…"
                aria-label="Search scenes"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            {allRegions.length > 1 && (
              <button className={`chip dropdown${regions.length ? " on" : ""}`} onClick={() => setRegionDlg(true)}>
                <Icon name="globe" size="sm" />
                Region{regions.length ? ` · ${regions.length}` : ""}
              </button>
            )}
          </div>
          {data.scenes.error && !data.scenes.data ? (
            <LoadError onRetry={data.scenes.reload}>We couldn't load the scenes. White studio and colours still work.</LoadError>
          ) : loading ? (
            <TileSkeletons n={8} ratio="1/1" />
          ) : (
            <div data-single>
              {!searching && (
                <>
                  <div className="section-head">
                    <h2 className="t-title">{suggested.length ? "Suggested for your product" : "Suggested"}</h2>
                    <span className="t-caption">White studio first</span>
                  </div>
                  <div className="grid c4">
                    {whiteTile}
                    {suggested.map(sceneTile)}
                  </div>
                </>
              )}
              {rest.length > 0 ? (
                <div className={searching ? "" : "sec-gap"}>
                  <div className="section-head">
                    <h2 className="t-title">{searching ? "Scenes" : "All scenes"}</h2>
                    <span className="t-caption num">{rest.length}</span>
                  </div>
                  <div className="grid c4">{rest.slice(0, limit).map(sceneTile)}</div>
                  {rest.length > limit && (
                    <div className="more-row">
                      <button className="btn btn-secondary" onClick={() => setLimit(limit + PAGE)}>
                        Show {Math.min(PAGE, rest.length - limit)} more
                      </button>
                    </div>
                  )}
                </div>
              ) : searching ? (
                <div className="empty">
                  <span className="art">
                    <Icon name="search" />
                  </span>
                  <h2 className="t-section">No scenes found</h2>
                  <p>Try another search, or clear the region.</p>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setQ("");
                      setRegions([]);
                    }}
                  >
                    Clear search and region
                  </button>
                </div>
              ) : scenes.length === 0 ? (
                <p className="t-caption mt-6">The studio scenes load with the catalogue. White studio and colours work offline.</p>
              ) : null}
            </div>
          )}
        </>
      )}
      {tab === "colour" && (
        <div className="cgrid">
          <div className="card block">
            <div className="block-head">
              <h2 className="t-title">Pick a colour</h2>
              <span className="t-caption">A plain scene, free</span>
            </div>
            <div className="sw-grid" data-single>
              {SWATCHES.map(([name, hex]) => (
                <button
                  key={hex}
                  className="tile selectable sw"
                  aria-label={name}
                  aria-selected={cur?.source === "colour" && cur.hex.toLowerCase() === hex}
                  onClick={() => pickColour(hex, name)}
                >
                  <div className="media" style={{ background: hex }} />
                  <div className="cap">
                    <div className="t">{name}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="divider" />
            <div className="field">
              <label className="label" htmlFor="hex">
                Your own colour <span className="opt">· type a hex code</span>
              </label>
              <div className="hexrow">
                <span className="well-c" style={{ background: parsed ?? curColour }} />
                <input
                  className="input"
                  id="hex"
                  value={hexText}
                  aria-label="Hex colour"
                  style={{ maxWidth: 160, fontFamily: "var(--font-mono)" }}
                  onChange={(e) => {
                    setHexText(e.target.value);
                    const h = parseHex(e.target.value);
                    typedHex.current = h;
                    if (h) pickColour(h);
                  }}
                />
                <span className="t-small muted">{parsed ? `Closest name: ${colourLabel(parsed)}` : "Not a colour yet"}</span>
              </div>
              {!parsed && hexText.trim() ? (
                <div className="field-error" role="alert">
                  <Icon name="alert" size="sm" />
                  Use a code like #1f4d3a or three numbers like 31, 77, 58.
                </div>
              ) : (
                <div className="hint">For example #1f4d3a or 31, 77, 58.</div>
              )}
            </div>
          </div>
          <div>
            <div className="prev" style={{ background: parsed ?? curColour }}>
              <span className="lbl badge glass">Live preview</span>
              <span className="floor" />
              <span className="who">
                <Icon name="mannequin" size="lg" />
              </span>
            </div>
            <div className="row spread mt-3">
              <div>
                <div className="t-small" style={{ fontWeight: 600 }}>
                  {colourLabel(parsed ?? curColour)}
                </div>
                <div className="t-caption num">{(parsed ?? curColour).toLowerCase()}</div>
              </div>
              <span className="badge">Plain colour</span>
            </div>
          </div>
        </div>
      )}
      {tab === "own" && (
        <div>
          <div className="section-head">
            <h2 className="t-title">Your scenes</h2>
            <span className="t-caption">Only on this computer</span>
          </div>
          {data.ownScenes.error && !data.ownScenes.data ? (
            <LoadError onRetry={data.ownScenes.reload}>We couldn't load your scenes.</LoadError>
          ) : (
            <div className="grid c4" data-single>
              <button className="tile add" onClick={() => setMakeDlg(true)}>
                <div className="media" style={{ ["--ratio" as string]: "1/1" }}>
                  <div>
                    <span className="plus-disc">
                      <Icon name="plus" />
                    </span>
                    <div className="t-small" style={{ fontWeight: 600, color: "var(--fg)" }}>
                      Make a scene
                    </div>
                    <div className="t-caption mt-1">Words, a photo, or both</div>
                    <div className="cost mt-2" style={{ display: "block" }}>
                      {about(ESTIMATE_USD.scene)}
                    </div>
                  </div>
                </div>
                <div className="cap">
                  <div className="grow">
                    <div className="t">&nbsp;</div>
                  </div>
                </div>
              </button>
              {mine.map(ownTile)}
            </div>
          )}
          {!data.ownScenes.loading && mine.length === 0 && <p className="t-caption mt-4">Scenes you make are kept here for every shoot.</p>}
        </div>
      )}
      {makeDlg && (
        <MakeSceneDialog
          onClose={() => setMakeDlg(false)}
          onMade={(s) => {
            data.ownScenes.reload();
            pick({ source: "own", id: s.id });
          }}
        />
      )}
      {regionDlg && (
        <Dialog
          size="sm"
          onClose={() => setRegionDlg(false)}
          title="Region"
          description="Plain studios and generic rooms show under every region."
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setRegions([])}>
                Clear
              </button>
              <span className="grow" />
              <button className="btn btn-primary" onClick={() => setRegionDlg(false)}>
                Show scenes
              </button>
            </>
          }
        >
          <div className="chips">
            {allRegions.map((r) => (
              <Chip
                key={r}
                pressed={regions.includes(r)}
                onClick={() => setRegions(regions.includes(r) ? regions.filter((x) => x !== r) : [...regions, r])}
              >
                {humanize(r)}
              </Chip>
            ))}
          </div>
        </Dialog>
      )}
    </Flow>
  );
}
