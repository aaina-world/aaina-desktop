import { useMemo, useState } from "react";
import { CatalogUnavailableText } from "../states";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import type {
  CatalogModel,
  CatalogPose,
  CatalogScene,
  ModelRef,
  OwnModel,
  OwnPose,
  OwnScene,
  PoseRef,
  Product,
  SceneRef,
  Shoot,
} from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import { Dialog } from "../../components/Dialog";
import { LoadError, Notice } from "../../components/Notice";
import { toast } from "../../components/Toast";
import { PageHead, SearchBox } from "../../components/Topbar";
import { Chip } from "../../components/controls";
import { COLLECTIONS, FiltersDialog, NO_FILTERS, ageBand, applyFilters, filterCount, type ModelFilters } from "../create/ModelStep";
import { MakePoseDialog, MakeSceneDialog, type ModelChoice } from "../create/dialogs";
import {
  ChipMenu,
  Icon,
  MoreMenu,
  Pic,
  TileSkeletons,
  about,
  fmtDate,
  humanize,
  matches,
  messageOf,
  plural,
  useApi,
  useDebounced,
  useLoad,
} from "../create/kit";
import { useOnline } from "../../hooks";
import "../create/create.css";
import "./library.css";

const TABS = ["products", "models", "poses", "scenes"] as const;
type Tab = (typeof TABS)[number];
const PAGE = 24;

export function LibraryScreen() {
  const { tab: param } = useParams();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const status = useLoad((a) => a.catalogStatus(), [], ["catalog"]);
  const products = useLoad((a) => a.products(), [], ["shoot", "own"]);
  const ownModels = useLoad((a) => a.ownModels(), [], ["own"]);
  const ownPoses = useLoad((a) => a.ownPoses(), [], ["own"]);
  const ownScenes = useLoad((a) => a.ownScenes(), [], ["own"]);
  const online = useOnline();
  if (!param) return <Navigate to="/library/products" replace />;
  if (!(TABS as readonly string[]).includes(param)) return <Navigate to="/library/products" replace />;
  const tab = param as Tab;
  const offline = !online && (status.data?.state === "offline" || status.data?.state === "never-loaded");
  const unavailable = status.data?.state === "offline" || status.data?.state === "never-loaded";
  const counts: Record<Tab, number | undefined> = {
    products: products.data?.length,
    models: ownModels.data?.length,
    poses: ownPoses.data?.length,
    scenes: ownScenes.data?.length,
  };
  const labels: Record<Tab, string> = { products: "Products", models: "Models", poses: "Poses", scenes: "Scenes" };

  return (
    <>
      <header className="topbar" data-tauri-drag-region>
        <div className="crumbs">
          <span className="here">Library</span>
        </div>
        <div className="grow" data-tauri-drag-region />
        <SearchBox value={q} onChange={setQ} placeholder="Search the library" label="Search the library" width="min(320px,34vw)" />
      </header>
      <div className="page">
        <PageHead title="Library" lede="Your products, models, poses and scenes, ready for any shoot. Yours stay on this computer." />
        {offline && (
          <div className="notice warning" style={{ marginBottom: "var(--s-5)" }}>
            <Icon name="offline" />
            You're offline. Studio models you've opened before still work.
            <span className="action" style={{ textDecoration: "none", fontWeight: 500, color: "var(--fg-muted)" }}>
              Making new things needs internet
            </span>
          </div>
        )}
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <Link key={t} role="tab" aria-selected={t === tab} to={`/library/${t}`}>
              {labels[t]}
              {counts[t] != null && <span className="n">{counts[t]}</span>}
            </Link>
          ))}
        </div>
        {tab === "products" && <ProductsTab q={dq} setQ={setQ} products={products} />}
        {tab === "models" && <ModelsTab q={dq} setQ={setQ} own={ownModels} offline={unavailable} status={status.data} />}
        {tab === "poses" && <PosesTab q={dq} own={ownPoses} ownModels={ownModels.data ?? []} offline={unavailable} />}
        {tab === "scenes" && <ScenesTab q={dq} own={ownScenes} offline={unavailable} />}
      </div>
    </>
  );
}

const Loading = ({ label }: { label: string }) => (
  <div className="mt-6" aria-label={label}>
    <TileSkeletons n={10} cols={5} ratio="1/1" />
  </div>
);

// ---------- Products ----------

function ProductsTab({ q, setQ, products }: { q: string; setQ: (v: string) => void; products: ReturnType<typeof useLoad<Product[]>> }) {
  const api = useApi();
  const nav = useNavigate();
  const shoots = useLoad((a) => a.shoots(), [], ["shoot"]);
  const [sort, setSort] = useState<"new" | "name" | "most">("new");
  const [del, setDel] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (shoots.data ?? []).forEach((s: Shoot) => m.set(s.productId, (m.get(s.productId) ?? 0) + 1));
    return m;
  }, [shoots.data]);
  const list = useMemo(() => {
    const l = (products.data ?? []).filter((p) => matches(q, p.name, p.reading?.label, p.reading?.colour));
    return l.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "most"
          ? (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [products.data, q, sort, counts]);

  async function newShoot(p: Product) {
    if (!api) return;
    try {
      const s = await api.createShoot({ kind: "model", productId: p.id });
      await api.updateShoot(s.id, { draftStep: "model" });
      void nav(`/create/${s.id}/model`);
    } catch (e) {
      toast(messageOf(e), { icon: "alert" });
    }
  }

  if (products.loading && !products.data) return <Loading label="Loading products" />;
  if (products.error && !products.data)
    return (
      <div className="mt-6">
        <LoadError onRetry={products.reload}>We couldn't load your products.</LoadError>
      </div>
    );
  if (!products.data?.length) {
    return (
      <div className="empty mt-6">
        <div className="art">
          <Icon name="shirt" />
        </div>
        <h2 className="t-section">No products yet</h2>
        <p>Products you add are kept here with their photos, so the next shoot starts in one click.</p>
        <Link className="btn btn-primary mt-2" to="/create/new">
          <Icon name="plus" />
          Add a product
        </Link>
        <span className="local-note mt-2">
          <Icon name="lock" />
          Kept on this computer only.
        </span>
      </div>
    );
  }
  return (
    <div>
      <div className="tools">
        <span className="count num">{plural(list.length, "product")}</span>
        <label className="input-wrap search-wrap">
          <Icon name="search" />
          <input
            className="input search"
            placeholder="Search products"
            aria-label="Search products"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select className="select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="new">Newest</option>
          <option value="name">Name</option>
          <option value="most">Most shoots</option>
        </select>
      </div>
      <div className="grid" style={{ ["--cols" as string]: 5 }}>
        <Link className="tile add" to="/create/new">
          <div className="media" style={{ ["--ratio" as string]: 1 }}>
            <div>
              <span className="plus-disc">
                <Icon name="plus" />
              </span>
              <span className="t-small" style={{ fontWeight: 600, display: "block" }}>
                Add a product
              </span>
              <span className="t-caption">Drop photos here or choose files</span>
            </div>
          </div>
          <div className="cap">
            <div className="grow">
              <div className="t">&nbsp;</div>
              <div className="m">&nbsp;</div>
            </div>
          </div>
        </Link>
        {list.map((p) => {
          const img = (p.photos.find((x) => x.role === "front") ?? p.photos[0])?.url;
          return (
            <article className="tile prod contain" key={p.id}>
              <div className="media" style={{ ["--ratio" as string]: 1 }}>
                <button className="imglink" aria-label={`New shoot with ${p.name}`} onClick={() => newShoot(p)}>
                  {img && <img src={img} alt="" loading="lazy" />}
                </button>
                <div className="quick hover-only">
                  <button className="btn" onClick={() => newShoot(p)}>
                    <Icon name="plus" size="sm" />
                    New shoot
                  </button>
                </div>
              </div>
              <div className="cap">
                <div className="grow">
                  <div className="t">{p.name}</div>
                  <div className="m">{[p.reading?.label, plural(p.photos.length, "photo")].filter(Boolean).join(" · ")}</div>
                </div>
                <MoreMenu
                  items={[
                    { label: "New shoot", icon: "plus", onClick: () => newShoot(p) },
                    { label: "Delete product", icon: "trash", danger: true, onClick: () => setDel(p) },
                  ]}
                />
              </div>
            </article>
          );
        })}
      </div>
      {list.length === 0 && (
        <div className="empty mt-6">
          <span className="art">
            <Icon name="search" />
          </span>
          <h2 className="t-section">No products found</h2>
          <p>Try another search.</p>
          <button className="btn btn-secondary" onClick={() => setQ("")}>
            Clear search
          </button>
        </div>
      )}
      {del && (
        <Dialog
          alert
          hideClose
          plainFoot
          size="sm"
          onClose={() => setDel(null)}
          icon="trash"
          iconTone="danger"
          title={`Delete ${del.name}?`}
          description="Its photos are removed from this computer. This can't be undone."
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDel(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  if (!api) return;
                  setBusy(true);
                  try {
                    await api.deleteProduct(del.id);
                    setDel(null);
                    products.reload();
                  } catch (e) {
                    toast(messageOf(e), { icon: "alert" });
                  }
                  setBusy(false);
                }}
              >
                <Icon name="trash" />
                Delete
              </button>
            </>
          }
        />
      )}
    </div>
  );
}

// ---------- Models ----------

function ModelsTab({
  q,
  setQ,
  own,
  offline,
  status,
}: {
  q: string;
  setQ: (v: string) => void;
  own: ReturnType<typeof useLoad<OwnModel[]>>;
  offline: boolean;
  status: { publishedAt: string | null; checkedAt: string | null; state: string } | null;
}) {
  const studio = useLoad((a) => a.models(), [], ["catalog"]);
  const settings = useLoad((a) => a.settings(), []);
  const api = useApi();
  const [gender, setGender] = useState<string[]>([]);
  const [f, setF] = useState<ModelFilters>(NO_FILTERS);
  const [dlg, setDlg] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [pins, setPins] = useState<string[] | null>(null);
  const pinned = pins ?? settings.data?.pins.models ?? [];
  const all = studio.data ?? [];
  const filters: ModelFilters = { ...f, gender };
  const list = useMemo(
    () =>
      applyFilters(all, filters)
        .filter((m) =>
          matches(
            q,
            m.name,
            m.appearance,
            m.look,
            m.body,
            m.gender,
            ...m.tags.map((t) => COLLECTIONS.find((c) => c.value === t)?.label ?? t),
          ),
        )
        .sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are deliberate: run when the identity changes, not on every field
    [all, f, gender, q, pinned],
  );
  const genders = Array.from(new Set(all.map((m) => m.gender).filter(Boolean) as string[]));
  const distinct = (get: (m: CatalogModel) => string | null) => Array.from(new Set(all.map(get).filter(Boolean) as string[])).sort();
  const mine = (own.data ?? []).filter((m) => matches(q, m.name, m.appearance));

  function pin(id: string) {
    if (!api || !settings.data) return;
    const next = pinned.includes(id) ? pinned.filter((x) => x !== id) : [id, ...pinned];
    setPins(next);
    api.updateSettings({ pins: { ...settings.data.pins, models: next } }).catch(() => setPins(null));
  }
  const updated = status?.publishedAt ?? status?.checkedAt;
  const GenderLabel: Record<string, string> = { woman: "Woman", man: "Man", girl: "Girl", boy: "Boy" };

  return (
    <div>
      <section className="sec" style={{ marginTop: "var(--s-6)" }}>
        <div className="section-head">
          <div>
            <h2 className="t-section">Your models</h2>
            <p className="t-caption mt-1 cap-line">
              <Icon name="lock" size="sm" style={{ width: 14, height: 14 }} />
              Only on this computer
            </p>
          </div>
          <Link className="btn btn-primary" to="/models/new">
            <Icon name="plus" />
            Create a model
          </Link>
        </div>
        {own.loading && !own.data ? (
          <TileSkeletons n={5} cols={5} />
        ) : own.error && !own.data ? (
          <LoadError onRetry={own.reload}>We couldn't load your models.</LoadError>
        ) : (own.data?.length ?? 0) === 0 ? (
          <div className="empty" style={{ padding: "var(--s-12) var(--s-6)" }}>
            <div className="art" style={{ width: 88, height: 88 }}>
              <Icon name="user" />
            </div>
            <h2 className="t-section">No models of your own yet</h2>
            <p>
              Make a model from a description or from photos of a real person. The {all.length ? all.length + " " : ""}studio models are
              always there too.
            </p>
            <Link className="btn btn-primary mt-2" to="/models/new">
              <Icon name="plus" />
              Create a model
            </Link>
          </div>
        ) : (
          <div className="grid" style={{ ["--cols" as string]: 5 }}>
            {mine.map((m) => (
              <OwnModelTile key={m.id} m={m} />
            ))}
            <Link className="tile add" to="/models/new">
              <div className="media" style={{ ["--ratio" as string]: "3/4" }}>
                <div>
                  <span className="plus-disc">
                    <Icon name="plus" />
                  </span>
                  <span className="t-small" style={{ fontWeight: 600, display: "block" }}>
                    Create a model
                  </span>
                  <span className="t-caption">From words or photos</span>
                </div>
              </div>
              <div className="cap">
                <div className="grow">
                  <div className="t">&nbsp;</div>
                  <div className="m">&nbsp;</div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </section>
      <section className="sec">
        <div className="section-head">
          <div>
            <h2 className="t-section">
              Studio models{" "}
              {all.length > 0 && (
                <span className="subtle num" style={{ fontWeight: 400 }}>
                  {all.length}
                </span>
              )}
            </h2>
            <p className="t-caption mt-1">From the Aaina studio{updated ? ` · updated ${fmtDate(updated)}` : ""}</p>
          </div>
        </div>
        {studio.loading && !studio.data ? (
          <TileSkeletons n={12} cols={6} />
        ) : (studio.error && !studio.data) || all.length === 0 ? (
          offline || (all.length === 0 && !studio.error) ? (
            <div className="empty offline">
              <CatalogUnavailableText />
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await api?.refreshCatalog();
                  } catch {
                    /* the status line says what happened */
                  }
                  studio.reload();
                }}
              >
                <Icon name="refresh" />
                Try again
              </button>
            </div>
          ) : (
            <LoadError onRetry={studio.reload}>We couldn't load the studio models.</LoadError>
          )
        ) : (
          <>
            <div className="filters">
              <div className="chips" data-single>
                <Chip pressed={gender.length === 0} onClick={() => setGender([])}>
                  All
                </Chip>
                {genders.map((g) => (
                  <Chip
                    key={g}
                    pressed={gender.includes(g)}
                    onClick={() => {
                      setGender(gender.includes(g) ? [] : [g]);
                      setLimit(PAGE);
                    }}
                  >
                    {GenderLabel[g] ?? humanize(g)}
                  </Chip>
                ))}
              </div>
              <span className="sp" />
              <div className="chips">
                {Array.from(new Set(all.map(ageBand))).length > 1 && (
                  <ChipMenu
                    label="Age"
                    value={f.age}
                    onChange={(v) => setF({ ...f, age: v })}
                    options={[
                      ["baby", "Babies"],
                      ["kids", "Kids"],
                      ["teen", "Teens"],
                      ["adult", "Adults"],
                      ["mature", "Mature"],
                    ]
                      .filter(([v]) => all.some((m) => ageBand(m) === v))
                      .map(([value, label]) => ({ value, label }))}
                  />
                )}
                {distinct((m) => m.look).length > 1 && (
                  <ChipMenu
                    label="Look"
                    value={f.look}
                    onChange={(v) => setF({ ...f, look: v })}
                    options={distinct((m) => m.look).map((v) => ({ value: v, label: humanize(v) }))}
                  />
                )}
                {distinct((m) => m.body).length > 1 && (
                  <ChipMenu
                    label="Body"
                    value={f.body}
                    onChange={(v) => setF({ ...f, body: v })}
                    options={distinct((m) => m.body).map((v) => ({ value: v, label: humanize(v) }))}
                  />
                )}
                {COLLECTIONS.filter((c) => all.some((m) => m.tags.includes(c.value)))
                  .slice(0, 2)
                  .map((c) => (
                    <Chip
                      key={c.value}
                      pressed={f.tags.includes(c.value)}
                      onClick={() =>
                        setF({ ...f, tags: f.tags.includes(c.value) ? f.tags.filter((x) => x !== c.value) : [...f.tags, c.value] })
                      }
                    >
                      {c.label.replace(" wear", "")}
                    </Chip>
                  ))}
                {filterCount(f) > 0 && (
                  <button className="btn btn-link t-small" onClick={() => setF(NO_FILTERS)}>
                    Clear
                  </button>
                )}
              </div>
              <label className="input-wrap search-wrap">
                <Icon name="search" />
                <input
                  className="input search"
                  placeholder="Search models"
                  aria-label="Search models"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
            </div>
            {list.length === 0 ? (
              <div className="empty">
                <span className="art">
                  <Icon name="search" />
                </span>
                <h2 className="t-section">No models found</h2>
                <p>Try another search or fewer filters.</p>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setQ("");
                    setF(NO_FILTERS);
                    setGender([]);
                  }}
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid c6">
                  {list.slice(0, limit).map((m) => (
                    <article className="tile studio" key={m.id}>
                      <div className="media">
                        <img src={m.cardUrl} alt={m.name} loading="lazy" style={{ objectPosition: "center 12%" }} />
                        <span className="over-tr">
                          <button
                            className={`icon-btn-glass${pinned.includes(m.id) ? " on" : " hover-only"}`}
                            aria-label={`${pinned.includes(m.id) ? "Unpin" : "Pin"} ${m.name}`}
                            onClick={() => pin(m.id)}
                          >
                            <Icon name="pin" />
                          </button>
                        </span>
                        <div className="quick hover-only">
                          <Link className="btn" to="/create/new" state={{ model: { source: "studio", id: m.id } satisfies ModelRef }}>
                            <Icon name="plus" size="sm" />
                            New shoot
                          </Link>
                        </div>
                      </div>
                      <div className="cap">
                        <div className="grow">
                          <div className="t">{m.name}</div>
                          <div className="m">{[GenderLabel[m.gender ?? ""], m.age].filter(Boolean).join(" · ") || "Studio model"}</div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {list.length > limit && (
                  <div className="more-row">
                    <button className="btn btn-secondary" onClick={() => setLimit(limit + PAGE)}>
                      Show {Math.min(PAGE, list.length - limit)} more
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
      {dlg && <FiltersDialog models={all} value={f} onChange={setF} onClose={() => setDlg(false)} />}
    </div>
  );
}

function OwnModelTile({ m }: { m: OwnModel }) {
  const sub = [
    m.gender === "woman" ? "Woman" : m.gender === "man" ? "Man" : humanize(m.gender),
    m.age,
    m.madeFrom === "photos" ? "From photos" : "From a description",
  ]
    .filter(Boolean)
    .join(" · ");
  const face = m.faceOptions[0]?.url ?? null;
  const img = face ?? m.sheetUrl;
  const sheet = !face;
  if (m.status === "ready") {
    return (
      <article className="tile own">
        <div className="media" style={{ ["--ratio" as string]: "3/4" }}>
          <Link to={`/models/${m.id}`} aria-label={m.name} className="imglink">
            {img && <Pic src={img} sheet={sheet} />}
          </Link>
          <div className="quick hover-only">
            <Link className="btn" to="/create/new" state={{ model: { source: "own", id: m.id } satisfies ModelRef }}>
              <Icon name="plus" size="sm" />
              New shoot
            </Link>
          </div>
        </div>
        <div className="cap">
          <div className="grow">
            <div className="t">{m.name}</div>
            <div className="m">{sub}</div>
          </div>
        </div>
      </article>
    );
  }
  const making = m.status === "making-sheet" || m.status === "draft";
  const target = m.status === "choosing-face" || making || m.status === "failed" ? `/models/new?m=${m.id}` : `/models/${m.id}`;
  return (
    <article className="tile own">
      <div className="media" style={{ ["--ratio" as string]: "3/4" }}>
        <Link to={target} aria-label={m.name} className="imglink">
          {img && (
            <Pic
              src={img}
              sheet={sheet && m.status !== "choosing-face"}
              style={making ? { filter: "blur(10px) saturate(.6)", transform: "scale(1.1)" } : undefined}
            />
          )}
        </Link>
        {making && (
          <div className="making">
            <span className="spinner" />
            <span style={{ fontWeight: 600, color: "var(--fg)" }}>Making the sheet</span>
          </div>
        )}
        <span className="over-tl">
          <span className={`badge ${m.status === "failed" ? "danger" : making ? "info" : "warning"} dot`}>
            {m.status === "failed" ? "Didn't work" : making ? "Making" : "Pick a face"}
          </span>
        </span>
      </div>
      <div className="cap">
        <div className="grow">
          <div className="t">{m.name}</div>
          <div className="m">{m.status === "choosing-face" ? "Pick a face" : sub}</div>
        </div>
      </div>
    </article>
  );
}

// ---------- Poses ----------

function PosesTab({
  q,
  own,
  ownModels,
  offline,
}: {
  q: string;
  own: ReturnType<typeof useLoad<OwnPose[]>>;
  ownModels: OwnModel[];
  offline: boolean;
}) {
  const studio = useLoad((a) => a.models(), [], ["catalog"]);
  const settings = useLoad((a) => a.settings(), []);
  const [make, setMake] = useState(false);
  const pinIds = settings.data?.pins.poses ?? [];
  // Pinned studio poses are looked up on the first studio models (the catalogue has no lookup by pose).
  const first = (studio.data ?? [])
    .slice(0, 3)
    .map((m) => m.id)
    .join(",");
  const pinned = useLoad(
    async (a) => {
      if (!pinIds.length || !first) return [] as CatalogPose[];
      const lists = await Promise.all(first.split(",").map((id) => a.posesFor({ source: "studio", id }).catch(() => [] as CatalogPose[])));
      const seen = new Set<string>();
      return lists.flat().filter((p) => pinIds.includes(p.id) && !seen.has(p.id) && seen.add(p.id));
    },
    [pinIds.join(","), first],
  );
  const choices: ModelChoice[] = [
    ...ownModels
      .filter((m) => m.status === "ready")
      .map((m): ModelChoice => ({ ref: { source: "own", id: m.id }, name: m.name, group: "Your models" })),
    ...(studio.data ?? [])
      .slice(0, 60)
      .map((m): ModelChoice => ({ ref: { source: "studio", id: m.id }, name: m.name, group: "Studio models" })),
  ];
  const modelName = (r: ModelRef) => choices.find((c) => c.ref.source === r.source && c.ref.id === r.id)?.name;
  const mine = (own.data ?? []).filter((p) => matches(q, p.name, p.words));
  const carryToCreate = (p: { modelRef: ModelRef }, pose: PoseRef) => ({ model: p.modelRef, pose });

  return (
    <div>
      <section className="sec" style={{ marginTop: "var(--s-6)" }}>
        <div className="section-head">
          <div>
            <h2 className="t-section">Your poses</h2>
            <p className="t-caption mt-1 cap-line">
              <Icon name="lock" size="sm" style={{ width: 14, height: 14 }} />
              Made here, only on this computer
            </p>
          </div>
        </div>
        {own.loading && !own.data ? (
          <TileSkeletons n={5} cols={5} ratio="2/3" />
        ) : own.error && !own.data ? (
          <LoadError onRetry={own.reload}>We couldn't load your poses.</LoadError>
        ) : (
          <div className="grid" style={{ ["--cols" as string]: 5 }}>
            <button
              className="tile add needs-net"
              disabled={offline || choices.length === 0}
              title={offline ? "Making new things needs internet" : undefined}
              onClick={() => setMake(true)}
            >
              <div className="media">
                <div>
                  <span className="plus-disc">
                    <Icon name="plus" />
                  </span>
                  <span className="t-small" style={{ fontWeight: 600, display: "block" }}>
                    Make a pose
                  </span>
                  <span className="t-caption">Describe it in words</span>
                  <span className="cost" style={{ display: "block", marginTop: 6 }}>
                    {about(ESTIMATE_USD.pose)}
                  </span>
                </div>
              </div>
              <div className="cap">
                <div className="grow">
                  <div className="t">&nbsp;</div>
                  <div className="m">&nbsp;</div>
                </div>
              </div>
            </button>
            {mine.map((p) => (
              <article className="tile" key={p.id}>
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
                  {p.status === "failed" && (
                    <span className="over-tl">
                      <span className="badge danger">Didn't work</span>
                    </span>
                  )}
                  {p.status === "ready" && (
                    <div className="quick hover-only">
                      <Link className="btn" to="/create/new" state={carryToCreate(p, { source: "own", id: p.id })}>
                        Use in a shoot
                      </Link>
                    </div>
                  )}
                </div>
                <div className="cap">
                  <div className="grow">
                    <div className="t">{p.name || p.words || "Your pose"}</div>
                    <div className="m">{[modelName(p.modelRef), fmtDate(p.createdAt)].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!own.loading && (own.data?.length ?? 0) === 0 && <p className="t-caption mt-4">Poses you make are kept here for every shoot.</p>}
      </section>
      {(pinned.data?.length ?? 0) > 0 && (
        <section className="sec">
          <div className="section-head">
            <div>
              <h2 className="t-section">
                Pinned{" "}
                <span className="subtle num" style={{ fontWeight: 400 }}>
                  {pinned.data!.length}
                </span>
              </h2>
              <p className="t-caption mt-1">Studio poses you pinned appear first in every shoot</p>
            </div>
          </div>
          <div className="grid c6">
            {pinned
              .data!.filter((p) => matches(q, p.name))
              .map((p) => (
                <article className="tile" key={p.id}>
                  <div className="media">
                    <img src={p.imageUrl} alt="" loading="lazy" />
                    <span className="over-tl">
                      <span className="badge glass">
                        <Icon name="pin" size="sm" style={{ width: 12, height: 12 }} />
                        Pinned
                      </span>
                    </span>
                  </div>
                  <div className="cap">
                    <div className="grow">
                      <div className="t">{p.name}</div>
                      <div className="m">Studio pose</div>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
      )}
      {make && <MakePoseDialog choices={choices} onClose={() => setMake(false)} onMade={() => own.reload()} />}
    </div>
  );
}

// ---------- Scenes ----------

function ScenesTab({ q, own, offline }: { q: string; own: ReturnType<typeof useLoad<OwnScene[]>>; offline: boolean }) {
  const scenes = useLoad((a) => a.scenes(), [], ["catalog"]);
  const settings = useLoad((a) => a.settings(), []);
  const shoots = useLoad((a) => a.shoots(), [], ["shoot"]);
  const [make, setMake] = useState(false);
  const pins = settings.data?.pins.scenes ?? [];
  const pinned = (scenes.data ?? []).filter((s: CatalogScene) => pins.includes(s.id) && matches(q, s.name));
  const colours = useMemo(() => {
    const m = new Map<string, { hex: string; name: string; n: number }>();
    for (const s of shoots.data ?? []) {
      if (s.scene?.source !== "colour" || s.scene.hex.toLowerCase() === "#ffffff") continue;
      const k = s.scene.hex.toLowerCase();
      const cur = m.get(k);
      m.set(k, { hex: k, name: s.scene.name, n: (cur?.n ?? 0) + 1 });
    }
    return Array.from(m.values()).sort((a, b) => b.n - a.n);
  }, [shoots.data]);
  const mine = (own.data ?? []).filter((s) => matches(q, s.name, s.words));
  const times = (n: number) => (n === 1 ? "used once" : n === 2 ? "used twice" : `used ${n} times`);

  return (
    <div>
      <section className="sec" style={{ marginTop: "var(--s-6)" }}>
        <div className="section-head">
          <div>
            <h2 className="t-section">Your scenes</h2>
            <p className="t-caption mt-1 cap-line">
              <Icon name="lock" size="sm" style={{ width: 14, height: 14 }} />
              Made here, only on this computer
            </p>
          </div>
        </div>
        {own.loading && !own.data ? (
          <TileSkeletons n={5} cols={5} ratio="1/1" />
        ) : own.error && !own.data ? (
          <LoadError onRetry={own.reload}>We couldn't load your scenes.</LoadError>
        ) : (
          <div className="grid" style={{ ["--cols" as string]: 5 }}>
            <button
              className="tile add needs-net"
              disabled={offline}
              title={offline ? "Making new things needs internet" : undefined}
              onClick={() => setMake(true)}
            >
              <div className="media" style={{ ["--ratio" as string]: 1 }}>
                <div>
                  <span className="plus-disc">
                    <Icon name="plus" />
                  </span>
                  <span className="t-small" style={{ fontWeight: 600, display: "block" }}>
                    Make a scene
                  </span>
                  <span className="t-caption">Describe a place</span>
                  <span className="cost" style={{ display: "block", marginTop: 6 }}>
                    {about(ESTIMATE_USD.scene)}
                  </span>
                </div>
              </div>
              <div className="cap">
                <div className="grow">
                  <div className="t">&nbsp;</div>
                  <div className="m">&nbsp;</div>
                </div>
              </div>
            </button>
            {mine.map((s) => (
              <article className="tile" key={s.id}>
                <div className="media" style={{ ["--ratio" as string]: 1 }}>
                  {s.imageUrl && (
                    <img
                      src={s.imageUrl}
                      alt=""
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
                  {s.status === "failed" && (
                    <span className="over-tl">
                      <span className="badge danger">Didn't work</span>
                    </span>
                  )}
                  {s.status === "ready" && (
                    <div className="quick hover-only">
                      <Link className="btn" to="/create/new" state={{ scene: { source: "own", id: s.id } satisfies SceneRef }}>
                        Use in a shoot
                      </Link>
                    </div>
                  )}
                </div>
                <div className="cap">
                  <div className="grow">
                    <div className="t">{s.name || s.words || "Your scene"}</div>
                    <div className="m">Made {fmtDate(s.createdAt)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!own.loading && (own.data?.length ?? 0) === 0 && <p className="t-caption mt-4">Scenes you make are kept here for every shoot.</p>}
      </section>
      {pinned.length > 0 && (
        <section className="sec">
          <div className="section-head">
            <div>
              <h2 className="t-section">
                Pinned{" "}
                <span className="subtle num" style={{ fontWeight: 400 }}>
                  {pinned.length}
                </span>
              </h2>
              <p className="t-caption mt-1">Studio scenes you pinned</p>
            </div>
          </div>
          <div className="grid" style={{ ["--cols" as string]: 5 }}>
            {pinned.map((s) => (
              <article className="tile" key={s.id}>
                <div className="media" style={{ ["--ratio" as string]: 1 }}>
                  <img src={s.imageUrl} alt="" loading="lazy" />
                  <span className="over-tl">
                    <span className="badge glass">
                      <Icon name="pin" size="sm" style={{ width: 12, height: 12 }} />
                      Pinned
                    </span>
                  </span>
                  <div className="quick hover-only">
                    <Link className="btn" to="/create/new" state={{ scene: { source: "studio", id: s.id } satisfies SceneRef }}>
                      Use in a shoot
                    </Link>
                  </div>
                </div>
                <div className="cap">
                  <div className="grow">
                    <div className="t">{s.name}</div>
                    <div className="m">Studio scene</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {colours.length > 0 && (
        <section className="sec">
          <div className="section-head">
            <div>
              <h2 className="t-section">Colours you used</h2>
              <p className="t-caption mt-1">Solid colour scenes from your shoots</p>
            </div>
          </div>
          <div className="grid c6">
            {colours.map((c) => (
              <article className="tile" key={c.hex}>
                <div className="media" style={{ ["--ratio" as string]: 1, background: c.hex }}>
                  <div className="quick hover-only">
                    <Link
                      className="btn"
                      to="/create/new"
                      state={{ scene: { source: "colour", hex: c.hex, name: c.name } satisfies SceneRef }}
                    >
                      Use in a shoot
                    </Link>
                  </div>
                </div>
                <div className="cap">
                  <div className="grow">
                    <div className="t">{c.name}</div>
                    <div className="m">
                      <span className="num">{c.hex.toUpperCase()}</span> · {times(c.n)}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {make && <MakeSceneDialog onClose={() => setMake(false)} onMade={() => own.reload()} />}
      {!scenes.loading && scenes.error && !scenes.data && (
        <div className="mt-6">
          <Notice tone="warning">The studio scenes aren't loaded. Pinned scenes show once they are.</Notice>
        </div>
      )}
    </div>
  );
}
