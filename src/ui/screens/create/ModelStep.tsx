import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { CatalogModel, ModelRef } from "../../../lib/contract";
import { Dialog } from "../../components/Dialog";
import { LoadError } from "../../components/Notice";
import { Chip } from "../../components/controls";
import type { CreateData } from "./data";
import { modelInfoOwn, modelInfoStudio } from "./data";
import type { useDraft } from "./draft";
import { BarSummary, Flow, PriceCard, StepHead, SumRow, reachable, stepPath } from "./flow";
import { Icon, Pic, TileSkeletons, humanize, matches, useApi, useDebounced, useLoad, plural } from "./kit";

type Draft = ReturnType<typeof useDraft>;

export const GENDERS = [
  { value: "woman", label: "Women" },
  { value: "man", label: "Men" },
  { value: "girl", label: "Girls" },
  { value: "boy", label: "Boys" },
];
export const AGES = [
  { value: "baby", label: "Babies" },
  { value: "kids", label: "Kids" },
  { value: "teen", label: "Teens" },
  { value: "adult", label: "Adults" },
  { value: "mature", label: "Mature" },
];
export const COLLECTIONS = [
  { value: "modest", label: "Modest wear" },
  { value: "maternity", label: "Maternity" },
  { value: "adaptive", label: "Adaptive" },
  { value: "supermodel", label: "Supermodels" },
];

export type ModelFilters = { gender: string[]; age: string[]; look: string[]; body: string[]; tags: string[] };
export const NO_FILTERS: ModelFilters = { gender: [], age: [], look: [], body: [], tags: [] };

export function ageBand(m: CatalogModel): string {
  const g = (m.ageGroup ?? "").toLowerCase();
  if (g.startsWith("baby") || g.startsWith("infant")) return "baby";
  if (g.startsWith("kid") || g.startsWith("child")) return "kids";
  if (g.startsWith("teen")) return "teen";
  if (g.startsWith("mature") || g.startsWith("senior") || (m.age ?? 0) >= 50) return "mature";
  return "adult";
}

export function applyFilters(models: CatalogModel[], f: ModelFilters): CatalogModel[] {
  return models.filter(
    (m) =>
      (!f.gender.length || (m.gender && f.gender.includes(m.gender))) &&
      (!f.age.length || f.age.includes(ageBand(m))) &&
      (!f.look.length || (m.look && f.look.includes(m.look))) &&
      (!f.body.length || (m.body && f.body.includes(m.body))) &&
      (!f.tags.length || f.tags.every((t) => m.tags.includes(t))),
  );
}

export function filterCount(f: ModelFilters) {
  return f.gender.length + f.age.length + f.look.length + f.body.length + f.tags.length;
}

/** A group of filter chips appears only when it tells models apart. */
export function FiltersDialog({
  models,
  value,
  onChange,
  onClose,
}: {
  models: CatalogModel[];
  value: ModelFilters;
  onChange: (f: ModelFilters) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(value);
  const shown = applyFilters(models, f).length;
  const distinct = (get: (m: CatalogModel) => string | null) => Array.from(new Set(models.map(get).filter(Boolean) as string[])).sort();
  const has = (opts: { value: string }[], get: (m: CatalogModel) => string | null) =>
    opts.filter((o) => models.some((m) => get(m) === o.value));
  const groups = (
    [
      { key: "gender", title: "Gender", options: has(GENDERS, (m) => m.gender) },
      { key: "age", title: "Age", options: AGES.filter((a) => models.some((m) => ageBand(m) === a.value)) },
      { key: "look", title: "Look", options: distinct((m) => m.look).map((v) => ({ value: v, label: humanize(v) })) },
      { key: "body", title: "Body", options: distinct((m) => m.body).map((v) => ({ value: v, label: humanize(v) })) },
      { key: "tags", title: "Collections", options: COLLECTIONS.filter((c) => models.some((m) => m.tags.includes(c.value))) },
    ] as { key: keyof ModelFilters; title: string; options: { value: string; label: string }[] }[]
  ).filter((g) => g.options.length > 1 || (g.key === "tags" && g.options.length > 0));
  const toggle = (key: keyof ModelFilters, v: string) =>
    setF({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });
  return (
    <Dialog
      onClose={onClose}
      title="Filters"
      description={`Show only models that match. ${plural(models.length, "model")}.`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => setF(NO_FILTERS)}>
            Clear all
          </button>
          <span className="grow" />
          <button
            className="btn btn-primary"
            onClick={() => {
              onChange(f);
              onClose();
            }}
          >
            Show {plural(shown, "model")}
          </button>
        </>
      }
    >
      {groups.map((g) => (
        <div className="fgroup" key={g.key}>
          <div className="label">{g.title}</div>
          <div className="chips">
            {g.options.map((o) => (
              <Chip key={o.value} pressed={f[g.key].includes(o.value)} onClick={() => toggle(g.key, o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </Dialog>
  );
}

export function ModelTile({
  m,
  selected,
  pinned,
  onPick,
  onPin,
}: {
  m: CatalogModel;
  selected: boolean;
  pinned: boolean;
  onPick: () => void;
  onPin: () => void;
}) {
  return (
    <div
      className="tile selectable mtile"
      aria-selected={selected}
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
    >
      <div className="media">
        <img src={m.cardUrl} alt={m.name} loading="lazy" style={{ objectPosition: "center 12%" }} />
        <span className="sel-mark">
          <Icon name="check" size="sm" />
        </span>
        <span className="over-tl">
          <button
            className={`icon-btn-glass${pinned ? " on" : " hover-only"}`}
            title={pinned ? "Unpin" : "Pin"}
            aria-label={pinned ? `Unpin ${m.name}` : `Pin ${m.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
          >
            <Icon name="pin" />
          </button>
        </span>
      </div>
      <div className="cap">
        <div className="grow">
          <div className="t">{m.name}</div>
          <div className="m">{modelInfoStudio(m).sub || "Studio model"}</div>
        </div>
      </div>
    </div>
  );
}

const PAGE = 24;

export function ModelStep({ draft, data }: { draft: Draft; data: CreateData }) {
  const api = useApi();
  const { shoot, product } = draft;
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [filters, setFilters] = useState<ModelFilters>(NO_FILTERS);
  const [dlg, setDlg] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const sug = useLoad((a) => a.suggestModels(product?.id ?? null), [product?.id], ["catalog"]);
  const status = useLoad((a) => a.catalogStatus(), [], ["catalog"]);
  const [refreshing, setRefreshing] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the empty fallback only matters while loading; the memo below is cheap
  const all = data.catalog.data ?? [];
  const own = (data.own.data ?? []).filter((m) => m.status === "ready");
  const pins = data.settings?.pins.models ?? [];
  const selected = shoot?.model;
  const isSel = (ref: ModelRef) => !!selected && selected.source === ref.source && selected.id === ref.id;

  const ordered = useMemo(() => {
    const rank = new Map((sug.data ?? []).map((m, i) => [m.id, i]));
    return [...all].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  }, [all, sug.data]);

  const searching = dq.trim().length > 0 || filterCount(filters) > 0;
  const results = useMemo(
    () =>
      applyFilters(ordered, filters).filter((m) =>
        matches(
          dq,
          m.name,
          m.appearance,
          m.look,
          m.body,
          m.gender,
          m.ageGroup,
          ...m.tags.map((t) => COLLECTIONS.find((c) => c.value === t)?.label ?? t),
        ),
      ),
    [ordered, filters, dq],
  );
  const ownShown = own.filter((m) => matches(dq, m.name, m.appearance, m.look, m.body));
  const pinned = ordered.filter((m) => pins.includes(m.id));
  const suggested = ordered.filter((m) => !pins.includes(m.id)).slice(0, 8);
  const rest = ordered.filter((m) => !pins.includes(m.id) && !suggested.includes(m));

  function pick(ref: ModelRef) {
    if (isSel(ref)) return;
    const keep = shoot?.plan.filter((p) => p.kind === "model" && p.pose.source === "words") ?? [];
    draft.patch({ model: ref, plan: keep });
  }

  const loading = data.catalog.loading || sug.loading;
  const empty = !loading && all.length === 0 && own.length === 0;
  const offline =
    !loading && all.length === 0 && (status.data?.state === "offline" || status.data?.state === "never-loaded" || !!data.catalog.error);
  const info = data.modelInfo;
  const reach = reachable(shoot, !!product?.photos.length);
  const front = product?.photos.find((p) => p.role === "front") ?? product?.photos[0];

  const grid = (list: CatalogModel[]) => (
    <div className="grid c4">
      {list.map((m) => (
        <ModelTile
          key={m.id}
          m={m}
          selected={isSel({ source: "studio", id: m.id })}
          pinned={pins.includes(m.id)}
          onPick={() => pick({ source: "studio", id: m.id })}
          onPin={() => data.togglePin("models", m.id)}
        />
      ))}
    </div>
  );
  const ownTile = (m: (typeof own)[number]) => {
    const i = modelInfoOwn(m);
    return (
      <button key={m.id} className="tile selectable mtile" aria-selected={isSel(i.ref)} onClick={() => pick(i.ref)}>
        <div className="media">
          {i.img && <Pic src={i.img} sheet={i.sheet} alt={m.name} style={{ objectPosition: "center 12%" }} />}
          <span className="sel-mark">
            <Icon name="check" size="sm" />
          </span>
        </div>
        <div className="cap">
          <div className="grow">
            <div className="t">{m.name}</div>
            <div className="m">{[m.age, humanize(m.look)].filter(Boolean).join(" · ")}</div>
            <div className="mt-1">
              <span className="badge" style={{ fontSize: 10 }}>
                <Icon name="lock" size="sm" style={{ width: 11, height: 11 }} />
                Only on this computer
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <Flow
      kind="model"
      current="model"
      shootId={shoot?.id}
      reach={reach}
      crumb={product?.name || "Your product"}
      back={stepPath(shoot?.id, "product")}
      saving={draft.saving}
      saveError={draft.saveError}
      aside={
        <>
          <div className="card summary-card">
            <SumRow k="Product" v={product?.name} img={front?.url} contain to={stepPath(shoot?.id, "product")} />
            {info ? (
              <SumRow
                k="Model"
                v={[info.name, info.age].filter(Boolean).join(" · ")}
                img={info.img}
                sheet={info.sheet}
                onEdit={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              />
            ) : (
              <SumRow k="Model" v="Choose one" icon="user" subtle />
            )}
            <SumRow k="Poses" v="Next step" icon="people" subtle />
            <SumRow k="Scene" v="Next step" icon="picture" subtle />
          </div>
          <PriceCard quality={shoot?.quality ?? "standard"} count={0}>
            Pick poses and a scene next. Billed by OpenAI to your key. Nothing is sent until you press Make.
          </PriceCard>
        </>
      }
      bar={
        <>
          {info ? (
            <BarSummary
              sheet={info.sheet}
              thumbs={[info.img]}
              title={[info.name, info.age].filter(Boolean).join(" · ")}
              sub={
                info.own
                  ? "Your model · only on this computer"
                  : [info.sub.split(" · ").slice(1).join(" · "), "studio model"].filter(Boolean).join(" · ")
              }
            />
          ) : (
            <div className="summary">
              <div className="txt">
                <b>Choose a model</b>
                <span className="num">to continue</span>
              </div>
            </div>
          )}
          <Link className="btn btn-secondary" to={stepPath(shoot?.id, "product")}>
            Back
          </Link>
          {info ? (
            <Link className="btn btn-primary" to={stepPath(shoot?.id, "poses")}>
              Next: poses <Icon name="right" />
            </Link>
          ) : (
            <button className="btn btn-primary" disabled>
              Next: poses <Icon name="right" />
            </button>
          )}
        </>
      }
    >
      <StepHead
        eyebrow="On a model"
        title="Choose a"
        em="model"
        lede="One studio model or one of your own. Everything below is kept on this computer."
        extra={
          status.data && status.data.state !== "never-loaded" ? (
            <span className="catline">
              <Icon name={status.data.state === "offline" ? "offline" : "clock"} />
              {status.data.state === "offline"
                ? "Offline · using the saved catalogue"
                : status.data.state === "loading"
                  ? "Updating the catalogue"
                  : "Catalogue up to date · works offline"}
            </span>
          ) : undefined
        }
      />
      {empty && offline ? (
        <div className="empty offline">
          <span className="art">
            <Icon name="offline" />
          </span>
          <h2 className="t-section">Connect to the internet once to load the studio models</h2>
          <p>
            The catalogue of models, poses and scenes is downloaded the first time. After that it is kept on this computer and works
            offline.
          </p>
          <div className="row wrap" style={{ justifyContent: "center" }}>
            <button
              className="btn btn-primary"
              disabled={refreshing}
              onClick={async () => {
                if (!api) return;
                setRefreshing(true);
                try {
                  await api.refreshCatalog();
                } catch {
                  /* shown by the status line */
                }
                setRefreshing(false);
                data.catalog.reload();
                status.reload();
              }}
            >
              <Icon name="refresh" />
              Try again
            </button>
            <Link className="btn btn-secondary" to={stepPath(shoot?.id, "product")}>
              Back to product
            </Link>
          </div>
          <span className="local-note mt-2">
            <Icon name="lock" />
            Your own models are still here, and you can make one now.
          </span>
          {own.length > 0 && (
            <div className="grid c4 mt-6" style={{ width: "100%", textAlign: "left" }}>
              {own.map(ownTile)}
              <Link className="tile add" to="/models/new">
                <div className="media" style={{ ["--ratio" as string]: "3/4" }}>
                  <div>
                    <span className="plus-disc">
                      <Icon name="plus" />
                    </span>
                    <div className="t-small" style={{ fontWeight: 600, color: "var(--fg)" }}>
                      Create a model
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="toolbar">
            <label className="input-wrap search-wrap grow" style={{ minWidth: 150, flex: "1 1 150px" }}>
              <Icon name="search" />
              <input
                className="input search"
                placeholder="Search: woman, South Asian, plus-size…"
                aria-label="Search models"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className="chips">
              {(["Gender", "Age", "Look", "Body", "Collections"] as const).map((l) => {
                const key = (l === "Collections" ? "tags" : l.toLowerCase()) as keyof ModelFilters;
                return (
                  <button key={l} className={`chip dropdown${filters[key].length ? " on" : ""}`} onClick={() => setDlg(true)}>
                    {l}
                    {filters[key].length ? ` · ${filters[key].length}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
          {loading ? (
            <TileSkeletons n={8} />
          ) : data.catalog.error ? (
            <LoadError onRetry={data.catalog.reload}>We couldn't load the models.</LoadError>
          ) : searching ? (
            <>
              {filterCount(filters) > 0 && (
                <div className="filters-active">
                  <span className="t-small muted">Filters</span>
                  {(Object.keys(filters) as (keyof ModelFilters)[]).flatMap((k) =>
                    filters[k].map((v) => (
                      <button
                        key={k + v}
                        className="chip chip-sm on"
                        onClick={() => setFilters({ ...filters, [k]: filters[k].filter((x) => x !== v) })}
                      >
                        {(k === "tags"
                          ? COLLECTIONS.find((c) => c.value === v)?.label
                          : [...GENDERS, ...AGES].find((c) => c.value === v)?.label) ?? humanize(v)}{" "}
                        <Icon name="x" size="sm" className="x" />
                      </button>
                    )),
                  )}
                  <button className="btn btn-link t-small" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </button>
                </div>
              )}
              {results.length + ownShown.length === 0 ? (
                <div className="empty">
                  <span className="art">
                    <Icon name="search" />
                  </span>
                  <h2 className="t-section">No models found</h2>
                  <p>Try another search or fewer filters. New models are added to the catalogue every week.</p>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setQ("");
                      setFilters(NO_FILTERS);
                    }}
                  >
                    Clear search and filters
                  </button>
                </div>
              ) : (
                <div data-single>
                  {ownShown.length > 0 && (
                    <div className="mb-6">
                      <div className="section-head">
                        <h2 className="t-title">Your models</h2>
                        <span className="t-caption">Only on this computer</span>
                      </div>
                      <div className="grid c4">{ownShown.map(ownTile)}</div>
                    </div>
                  )}
                  <div className="section-head">
                    <h2 className="t-title">Models</h2>
                    <span className="t-caption num">{results.length}</span>
                  </div>
                  {grid(results.slice(0, limit))}
                  {results.length > limit && (
                    <div className="more-row">
                      <button className="btn btn-secondary" onClick={() => setLimit(limit + PAGE)}>
                        Show {Math.min(PAGE, results.length - limit)} more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div data-single>
              <div>
                <div className="section-head">
                  <h2 className="t-title">Your models</h2>
                  <span className="t-caption">Only on this computer</span>
                </div>
                <div className="grid c4">
                  {own.map(ownTile)}
                  <Link className="tile add" to="/models/new">
                    <div className="media" style={{ ["--ratio" as string]: "3/4" }}>
                      <div>
                        <span className="plus-disc">
                          <Icon name="plus" />
                        </span>
                        <div className="t-small" style={{ fontWeight: 600, color: "var(--fg)" }}>
                          Create a model
                        </div>
                        <div className="t-caption mt-1">From words or photos</div>
                      </div>
                    </div>
                    <div className="cap">
                      <div className="grow">
                        <div className="t">&nbsp;</div>
                        <div className="m">&nbsp;</div>
                        <div className="mt-1">
                          <span className="badge" style={{ visibility: "hidden", fontSize: 10 }}>
                            &nbsp;
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
              {pinned.length > 0 && (
                <div className="sec-gap">
                  <div className="section-head">
                    <h2 className="t-title">Pinned</h2>
                    <span className="t-caption">{plural(pinned.length, "model")}</span>
                  </div>
                  {grid(pinned)}
                </div>
              )}
              {suggested.length > 0 && (
                <div className="sec-gap">
                  <div className="section-head">
                    <h2 className="t-title">
                      Suggested{product?.reading?.label ? ` for your ${product.reading.label.toLowerCase()}` : ""}
                    </h2>
                    <span className="t-caption">Best fit first</span>
                  </div>
                  {grid(suggested)}
                </div>
              )}
              {rest.length > 0 && (
                <div className="sec-gap">
                  <div className="section-head">
                    <h2 className="t-title">All models</h2>
                    <span className="t-caption num">{all.length}</span>
                  </div>
                  {grid(rest.slice(0, limit))}
                  {rest.length > limit && (
                    <div className="more-row">
                      <button className="btn btn-secondary" onClick={() => setLimit(limit + PAGE)}>
                        Show {Math.min(PAGE, rest.length - limit)} more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {dlg && (
        <FiltersDialog
          models={all}
          value={filters}
          onChange={(f) => {
            setFilters(f);
            setLimit(PAGE);
          }}
          onClose={() => setDlg(false)}
        />
      )}
    </Flow>
  );
}
