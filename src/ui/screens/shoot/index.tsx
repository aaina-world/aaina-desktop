import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../../../lib/api";
import { ESTIMATE_USD, type Shoot } from "../../../lib/contract";
import {
  ColoursDialog,
  ConfirmDialog,
  Cost,
  costText,
  EmptyState,
  FixDialog,
  Icon,
  KbdOnButton,
  KIND_LABEL,
  KeyProblemDialog,
  LoadError,
  MoreOnAaina,
  RenameDialog,
  SaveDialog,
  Skeleton,
  SkeletonGrid,
  Topbar,
  failureText,
  formatDateTime,
  groupShots,
  isKeyProblem,
  plural,
  progressOf,
  toast,
  useMenu,
  type MenuEntry,
  type ShotGroup,
} from "../../components";
import { isMod, useLoad, useNow, useOs } from "../../hooks";

type Dlg =
  | { t: "save"; groups: ShotGroup[] }
  | { t: "fix" | "colours"; g: ShotGroup }
  | { t: "delete"; groups: ShotGroup[] }
  | { t: "deleteShoot" }
  | { t: "rename" }
  | { t: "key"; reason?: "KEY_REFUSED" | "OUT_OF_CREDIT" | "VERIFY_ORGANIZATION" };

export function ShootScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { mod, showInFolder } = useOs();
  const shoot = useLoad((a) => a.shoot(id), [id], ["shoot"]);
  const photos = useLoad((a) => a.photos(id), [id], ["photo", "shoot"]);
  const lookups = useLoad(async (a) => {
    const [models, scenes, own, ownScenes] = await Promise.all([a.models(), a.scenes(), a.ownModels(), a.ownScenes()]);
    return { models, scenes, own, ownScenes };
  }, []);
  const product = useLoad(async (a) => (shoot.data ? a.product(shoot.data.productId) : null), [shoot.data?.productId]);

  const s = shoot.data;
  const groups = groupShots(photos.data ?? []);
  const active = (photos.data ?? []).some((p) => p.status === "queued" || p.status === "sending");
  const now = useNow(active);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const last = useRef(-1);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const menu = useMenu();

  useEffect(() => {
    if (s && s.status === "draft") void navigate(`/create/${s.id}/${s.draftStep ?? "model"}`, { replace: true });
  }, [s, navigate]);
  useEffect(() => {
    document.body.dataset.st = selecting ? "selecting" : "";
    return () => {
      document.body.dataset.st = "";
    };
  }, [selecting]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=dialog], [role=alertdialog]")) return;
      if (e.key === "Escape" && selecting) exitSelect();
      if (isMod(e) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveAll();
      }
      if ((e.key === "Backspace" || e.key === "Delete") && sel.size) setDlg({ t: "delete", groups: groups.filter((g) => sel.has(g.key)) });
      if (e.key === "F2") startRename();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  if (shoot.loading && !s) return <ShootSkeleton />;
  if (shoot.error)
    return (
      <>
        <Topbar crumbs={[{ label: "Shoots", to: "/shoots" }, "Shoot"]} back="/shoots" backLabel="Back to Shoots" />
        <div className="page">
          <LoadError onRetry={shoot.reload}>We couldn't read this shoot from your computer.</LoadError>
        </div>
      </>
    );
  if (!s)
    return (
      <>
        <Topbar crumbs={[{ label: "Shoots", to: "/shoots" }, "Not found"]} back="/shoots" backLabel="Back to Shoots" />
        <div className="page">
          <EmptyState
            icon="search"
            title="We can't find that shoot"
            action={
              <Link className="btn btn-primary mt-2" to="/shoots">
                Back to Shoots
              </Link>
            }
          >
            It may have been deleted.
          </EmptyState>
        </div>
      </>
    );

  const doneGroups = groups.filter((g) => g.shown.status === "done");
  const making = (photos.data ?? []).filter((p) => p.status === "sending" || p.status === "queued").length;
  const bad = groups.filter((g) => g.shown.status === "failed" || g.shown.status === "interrupted").length;
  const modelRef = s.model;
  const model = modelRef
    ? modelRef.source === "studio"
      ? lookups.data?.models.find((m) => m.id === modelRef.id)
      : lookups.data?.own.find((m) => m.id === modelRef.id)
    : null;
  const modelImg = model ? (model.cardUrl ?? ("sheetUrl" in model ? model.sheetUrl : null)) : null;
  const sc = s.scene;
  const scene =
    sc?.source === "studio"
      ? lookups.data?.scenes.find((x) => x.id === sc.id)
      : sc?.source === "own"
        ? lookups.data?.ownScenes.find((x) => x.id === sc.id)
        : null;

  function exitSelect() {
    setSelecting(false);
    setSel(new Set());
    last.current = -1;
  }
  function toggle(i: number, shift: boolean) {
    setSelecting(true);
    setSel((cur) => {
      const next = new Set(cur);
      if (shift && last.current >= 0) {
        for (let k = Math.min(last.current, i); k <= Math.max(last.current, i); k++) next.add(groups[k].key);
      } else if (next.has(groups[i].key)) next.delete(groups[i].key);
      else next.add(groups[i].key);
      return next;
    });
    last.current = i;
  }
  function saveAll() {
    if (!doneGroups.length) {
      toast("There are no finished photos to save yet.", { icon: "alert" });
      return;
    }
    setDlg({ t: "save", groups: doneGroups });
  }
  function startRename() {
    if (!s) return;
    setNameDraft(s.name);
    setRenaming(true);
  }
  async function commitRename() {
    setRenaming(false);
    if (s && nameDraft.trim() && nameDraft.trim() !== s.name) await (await api()).updateShoot(s.id, { name: nameDraft.trim() });
  }
  async function duplicate(from: Shoot) {
    try {
      const a = await api();
      const n = await a.createShoot({ kind: from.kind, productId: from.productId });
      await a.updateShoot(n.id, { model: from.model, scene: from.scene, quality: from.quality, plan: from.plan, draftStep: "review" });
      void navigate(`/create/${n.id}/review`);
    } catch {
      toast("We couldn't copy those settings. Try again.", { icon: "alert" });
    }
  }
  async function morePoses() {
    try {
      const a = await api();
      const n = await a.createShoot({ kind: "model", productId: s!.productId });
      await a.updateShoot(n.id, { model: s!.model, scene: s!.scene, quality: s!.quality, plan: [], draftStep: "poses" });
      void navigate(`/create/${n.id}/poses`);
    } catch {
      toast("We couldn't start that. Try again.", { icon: "alert" });
    }
  }
  async function startKind(kind: "flat-lay" | "ghost") {
    try {
      const n = await (await api()).createShoot({ kind, productId: s!.productId });
      void navigate(`/create/${n.id}/${kind === "flat-lay" ? "styles" : "angles"}`);
    } catch {
      toast("We couldn't start that. Try again.", { icon: "alert" });
    }
  }
  const shootMenu = (): MenuEntry[] => [
    { label: "Rename", icon: "edit", right: "F2", onSelect: startRename },
    { label: "Duplicate settings", icon: "versions", onSelect: () => duplicate(s) },
    "sep",
    { label: "Delete shoot", icon: "trash", danger: true, onSelect: () => setDlg({ t: "deleteShoot" }) },
  ];
  async function again(g: ShotGroup) {
    try {
      await (await api()).makeAgain(g.shown.id);
      toast("Making a new version. It appears here when it's ready.", { icon: "refresh" });
    } catch {
      toast("We couldn't start that. Nothing was sent to OpenAI.", { icon: "alert" });
    }
  }
  async function copy(g: ShotGroup) {
    try {
      await (await api()).copyPhoto(g.shown.id);
      toast("Copied");
    } catch {
      toast("We couldn't copy that photo.", { icon: "alert" });
    }
  }
  const photoMenu = (g: ShotGroup): MenuEntry[] => [
    { label: "Open", icon: "eye", right: "↵", onSelect: () => navigate(`/photo/${g.shown.id}?shoot=${s.id}`) },
    "sep",
    {
      label: "Make again",
      icon: "refresh",
      right: <span className="cost">{costText(ESTIMATE_USD.photo[s.quality])}</span>,
      onSelect: () => again(g),
    },
    {
      label: "Fix something",
      icon: "wand",
      right: <span className="cost">{costText(ESTIMATE_USD.edit)}</span>,
      onSelect: () => setDlg({ t: "fix", g }),
    },
    {
      label: "Other colours",
      icon: "palette",
      right: <span className="cost">{costText(ESTIMATE_USD.edit)} each</span>,
      onSelect: () => setDlg({ t: "colours", g }),
    },
    "sep",
    { label: "Save photo…", icon: "download", right: mod + "S", onSelect: () => setDlg({ t: "save", groups: [g] }) },
    { label: "Copy", icon: "copy", right: mod + "C", onSelect: () => copy(g) },
    { label: showInFolder, icon: "folder", onSelect: async () => (await api()).showInFolder(g.shown.path ?? "") },
    "sep",
    { label: "Delete", icon: "trash", right: "⌫", danger: true, onSelect: () => setDlg({ t: "delete", groups: [g] }) },
  ];

  const summary = [plural(doneGroups.length, "photo"), making ? `${making} making` : "", bad ? `${bad} couldn't be made` : ""]
    .filter(Boolean)
    .join(" · ");
  const cells = [
    { k: "Product", v: product.data?.name ?? s.name, img: product.data?.photos[0]?.url, round: false },
    ...(s.kind === "model"
      ? [
          { k: "Model", v: model?.name ?? "Model", img: modelImg, round: true },
          {
            k: "Scene",
            v: scene?.name ?? (s.scene?.source === "colour" ? s.scene.name : "Scene"),
            img: scene?.imageUrl,
            colour: s.scene?.source === "colour" ? s.scene.hex : undefined,
            round: false,
          },
        ]
      : [{ k: "Kind", v: KIND_LABEL[s.kind], icon: s.kind === "ghost" ? "mannequin" : "flatlay" }]),
    { k: "Made", v: formatDateTime(s.createdAt), icon: "calendar" },
  ] as { k: string; v: string; img?: string | null; round?: boolean; colour?: string; icon?: "mannequin" | "flatlay" | "calendar" }[];

  return (
    <>
      <Topbar
        back="/shoots"
        backLabel="Back to Shoots"
        crumbs={[
          { label: "Shoots", to: "/shoots" },
          {
            node: renaming ? (
              <input
                className="input name-input"
                autoFocus
                value={nameDraft}
                aria-label="Shoot name"
                onChange={(e) => setNameDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
              />
            ) : (
              <button className="name-btn here" onClick={startRename} title="Rename">
                {s.name}
                <Icon name="edit" />
              </button>
            ),
          },
        ]}
      >
        <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={!doneGroups.length}>
          <Icon name="download" size="sm" />
          Save all<KbdOnButton mod>S</KbdOnButton>
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={async () =>
            (await api()).showInFolder(groups.find((g) => g.shown.path)?.shown.path ?? (await (await api()).settings()).photosFolder)
          }
        >
          <Icon name="folder" size="sm" />
          {showInFolder}
        </button>
        <button className="btn btn-secondary btn-sm btn-icon" aria-label="More" onClick={(e) => menu.open(e.currentTarget, shootMenu())}>
          <Icon name="more" size="sm" />
        </button>
      </Topbar>

      <div className="page">
        <div className="titlerow">
          <h1 className="t-page">{s.name}</h1>
          <span className="badge">{KIND_LABEL[s.kind]}</span>
          <span className="t-small muted num">{summary}</span>
        </div>
        <section
          className="card strip"
          aria-label="What this shoot used"
          style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
        >
          {cells.map((c) => (
            <div className="cell" key={c.k}>
              {c.img ? (
                <img className={c.round ? "round" : undefined} src={c.img} alt="" />
              ) : c.colour ? (
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "var(--r-sm)",
                    background: c.colour,
                    border: "1px solid var(--line)",
                    flex: "none",
                  }}
                />
              ) : (
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: "var(--bg-sunken)",
                    flex: "none",
                  }}
                >
                  <Icon name={c.icon ?? "images"} />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <span className="t-eyebrow">{c.k}</span>
                <span className="v num" style={{ display: "block" }}>
                  {c.v}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="section" style={{ marginTop: "var(--s-8)" }}>
          <div className="section-head">
            <h2 className="t-section">
              Photos{" "}
              <span className="subtle num" style={{ fontWeight: 400 }}>
                {groups.length}
              </span>
            </h2>
            <div className="row" style={{ "--gap": "12px" } as React.CSSProperties}>
              <span className="hintline">
                <span className="kbd">Shift</span> or <span className="kbd">{mod.replace("+", "")}</span> click to select several
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
                {selecting ? "Done" : "Select"}
              </button>
            </div>
          </div>
          {photos.error && <LoadError onRetry={photos.reload}>We couldn't read this shoot's photos.</LoadError>}
          {photos.loading && !photos.data && <SkeletonGrid count={4} cols={4} label="Loading photos" />}
          {photos.data && groups.length === 0 && (
            <EmptyState icon="images" compact title="No photos yet">
              Photos appear here as they are made.
            </EmptyState>
          )}
          <div className="grid c4" id="grid">
            {groups.map((g, i) => {
              const p = g.shown;
              const isSel = sel.has(g.key);
              const click = (e: React.MouseEvent) => {
                if (selecting || e.metaKey || e.ctrlKey || e.shiftKey) {
                  e.preventDefault();
                  toggle(i, e.shiftKey);
                }
              };
              const mark = (
                <button
                  className="sel-mark hover-only"
                  aria-label={isSel ? "Deselect" : "Select"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(i, e.shiftKey);
                  }}
                >
                  <Icon name="check" size="sm" />
                </button>
              );
              const common = { ...(isSel ? { "data-sel": "" } : {}) };

              if (p.status === "queued" || p.status === "sending") {
                const pct = Math.round(progressOf(p, now));
                const left = p.startedAt ? Math.max(5, Math.round(45 - (now - new Date(p.startedAt).getTime()) / 1000)) : null;
                return (
                  <article className="tile photo" key={g.key} {...common}>
                    <div className="media">
                      {product.data?.photos[0] && (
                        <img
                          src={product.data.photos[0].url}
                          alt=""
                          style={{ filter: "blur(10px) saturate(.6)", transform: "scale(1.1)" }}
                        />
                      )}
                      <div className="making">
                        <span className="t-small" style={{ color: "var(--fg)", fontWeight: 500 }}>
                          {p.status === "queued" ? "In the queue" : "Making your photo"}
                        </span>
                        <div className="progress">
                          <i style={{ "--p": `${pct}%` } as React.CSSProperties} />
                        </div>
                        <span>{p.status === "queued" ? "Starts in a moment" : left ? `About ${left} s` : "Just a moment"}</span>
                      </div>
                    </div>
                    <div className="cap">
                      <div className="grow">
                        <div className="t">{p.title}</div>
                        <div className="m">{p.status === "queued" ? "Waiting" : "Making…"}</div>
                      </div>
                    </div>
                  </article>
                );
              }
              if (p.status === "failed" || p.status === "interrupted") {
                const f = failureText(p);
                return (
                  <article className="tile photo failed" key={g.key} {...common}>
                    <div className="media">
                      <div className="stack" style={{ "--gap": "10px", alignItems: "center" } as React.CSSProperties}>
                        <span
                          className="center"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: "var(--danger-soft)",
                            color: "var(--danger)",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <Icon name="alert" />
                        </span>
                        <span className="t-small" style={{ fontWeight: 500 }}>
                          {f.head}
                        </span>
                        <span className="t-caption">{f.line}</span>
                        {isKeyProblem(p) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDlg({ t: "key", reason: p.error!.code as "KEY_REFUSED" })}
                          >
                            See why
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            try {
                              await (await api()).tryAgain(p.id);
                            } catch {
                              toast("We couldn't start that. Try again.", { icon: "alert" });
                            }
                          }}
                        >
                          <Icon name="refresh" size="sm" />
                          Try again
                        </button>
                        <Cost usd={p.estimateUsd} />
                      </div>
                    </div>
                    <div className="cap">
                      <div className="grow">
                        <div className="t">{p.title}</div>
                        <div className="m" style={{ color: "var(--danger)" }}>
                          {p.status === "interrupted" ? "Interrupted" : "Couldn't be made"}
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label="Remove"
                        onClick={() => setDlg({ t: "delete", groups: [g] })}
                      >
                        <Icon name="trash" size="sm" />
                      </button>
                    </div>
                  </article>
                );
              }
              const nv = g.versions.filter((v) => v.status === "done").length;
              return (
                <article
                  className={"tile photo" + (s.kind === "ghost" ? " contain" : "")}
                  key={g.key}
                  {...common}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    menu.open(e, photoMenu(g));
                  }}
                >
                  <div className="media">
                    <Link to={`/photo/${p.id}?shoot=${s.id}`} aria-label={p.title} onClick={click}>
                      {p.url && <img src={p.url} alt={p.title} loading="lazy" />}
                    </Link>
                    {g.pending && (
                      <span className="over-tl" style={{ left: 40 }}>
                        {g.pending.status === "failed" || g.pending.status === "interrupted" ? (
                          <span className="badge danger dot">New version failed</span>
                        ) : (
                          <span className="badge info dot">Making a new version</span>
                        )}
                      </span>
                    )}
                    {nv > 1 && (
                      <span className="over-tr">
                        <span className="badge glass">
                          <Icon name="versions" size="sm" style={{ width: 12, height: 12 }} />
                          {nv} versions
                        </span>
                      </span>
                    )}
                    {mark}
                    <div className="quick hover-only">
                      <button className="btn" onClick={() => setDlg({ t: "fix", g })}>
                        <Icon name="wand" size="sm" />
                        Fix something
                      </button>
                      <button className="btn dark" aria-label="Save photo" onClick={() => setDlg({ t: "save", groups: [g] })}>
                        <Icon name="download" size="sm" />
                      </button>
                    </div>
                  </div>
                  <div className="cap">
                    <div className="grow">
                      <div className="t">{p.title}</div>
                      <div className="m">Ready{nv > 1 ? ` · ${nv} versions` : ""}</div>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label="Photo options"
                      onClick={(e) => menu.open(e.currentTarget, photoMenu(g))}
                    >
                      <Icon name="more" size="sm" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="t-section">More from this shoot</h2>
              <p className="t-caption mt-1">Same product, with the price before anything starts</p>
            </div>
          </div>
          <div className="domore">
            {s.kind === "model" && (
              <button className="dm" onClick={morePoses}>
                <span className="ti">
                  <Icon name="plus" />
                </span>
                <span className="t">More poses</span>
                <span className="d">The same model and scene in new poses</span>
                <Cost className="p" usd={ESTIMATE_USD.photo[s.quality]} unit="a photo" />
              </button>
            )}
            {s.kind !== "flat-lay" && (
              <button className="dm" onClick={() => startKind("flat-lay")}>
                <span className="ti">
                  <Icon name="flatlay" />
                </span>
                <span className="t">Flat-lay</span>
                <span className="d">Shot from above: clean, folded or styled</span>
                <Cost className="p" usd={ESTIMATE_USD.photo.standard} unit="a style" />
              </button>
            )}
            {s.kind !== "ghost" && (
              <button className="dm" onClick={() => startKind("ghost")}>
                <span className="ti">
                  <Icon name="mannequin" />
                </span>
                <span className="t">Ghost mannequin</span>
                <span className="d">The {product.data?.reading?.label ?? "garment"} alone, front, side and back</span>
                <Cost className="p" usd={ESTIMATE_USD.photo.standard} unit="an angle" />
              </button>
            )}
            {doneGroups.length > 0 && (
              <button className="dm" onClick={() => setDlg({ t: "colours", g: doneGroups[0] })}>
                <span className="ti">
                  <Icon name="palette" />
                </span>
                <span className="t">Other colours</span>
                <span className="d">The same photo in up to 6 colours</span>
                <Cost className="p" usd={ESTIMATE_USD.edit} unit="a colour" />
              </button>
            )}
          </div>
        </section>
        <div style={{ marginTop: "var(--s-12)" }}>
          <MoreOnAaina />
        </div>
      </div>

      {selecting && (
        <div className="actionbar selbar">
          <div className="summary">
            <div className="txt">
              <b>{plural(sel.size, "photo")} selected</b>
              <span>Shift-click for a range, {mod}click to add one</span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={exitSelect}>
            Cancel
            <span className="kbd" style={{ marginLeft: 6 }}>
              Esc
            </span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={async () => (await api()).showInFolder(groups.find((g) => g.shown.path)?.shown.path ?? "")}
          >
            <Icon name="folder" />
            {showInFolder}
          </button>
          <button
            className="btn btn-secondary"
            disabled={!sel.size}
            onClick={() => setDlg({ t: "save", groups: groups.filter((g) => sel.has(g.key) && g.shown.status === "done") })}
          >
            <Icon name="download" />
            Save photos…
          </button>
          <button
            className="btn btn-danger"
            disabled={!sel.size}
            onClick={() => setDlg({ t: "delete", groups: groups.filter((g) => sel.has(g.key)) })}
          >
            <Icon name="trash" />
            Delete {sel.size} {sel.size === 1 ? "photo" : "photos"}
          </button>
        </div>
      )}
      {menu.node}

      {dlg?.t === "save" && <SaveDialog photos={dlg.groups.map((g) => g.shown)} shootName={s.name} onClose={() => setDlg(null)} />}
      {dlg?.t === "fix" && <FixDialog photo={dlg.g.shown} shootName={s.name} onClose={() => setDlg(null)} />}
      {dlg?.t === "colours" && <ColoursDialog photo={dlg.g.shown} onClose={() => setDlg(null)} />}
      {dlg?.t === "key" && <KeyProblemDialog reason={dlg.reason} onClose={() => setDlg(null)} />}
      {dlg?.t === "rename" && (
        <RenameDialog
          title="Rename shoot"
          value={s.name}
          onClose={() => setDlg(null)}
          onSave={async (name) => {
            await (await api()).updateShoot(s.id, { name });
          }}
        />
      )}
      {dlg?.t === "deleteShoot" && (
        <ConfirmDialog
          danger
          title="Delete this shoot?"
          description={`${s.name} and its ${plural(photos.data?.length ?? 0, "photo")} are deleted from this computer. This can't be undone.`}
          confirmLabel="Delete shoot"
          cancelLabel="Keep it"
          onClose={() => setDlg(null)}
          onConfirm={async () => {
            await (await api()).deleteShoot(s.id);
            toast("Shoot deleted", { icon: "trash" });
            void navigate("/shoots", { replace: true });
          }}
        />
      )}
      {dlg?.t === "delete" && (
        <ConfirmDialog
          danger
          title={dlg.groups.length === 1 ? "Delete this photo?" : `Delete ${dlg.groups.length} photos?`}
          description="They are removed from this computer, with all their versions. This can't be undone."
          confirmLabel="Delete"
          onClose={() => setDlg(null)}
          onConfirm={async () => {
            const a = await api();
            await Promise.all(dlg.groups.flatMap((g) => g.versions.map((v) => a.deletePhoto(v.id))));
            setDlg(null);
            exitSelect();
            toast(`Deleted ${plural(dlg.groups.length, "photo")}`, { icon: "trash" });
          }}
        />
      )}
    </>
  );
}

function ShootSkeleton() {
  return (
    <>
      <Topbar back="/shoots" crumbs={[{ label: "Shoots", to: "/shoots" }, "…"]} />
      <div className="page">
        <Skeleton height={40} width={320} />
        <div className="card strip" style={{ minHeight: 76 }} />
        <div style={{ marginTop: "var(--s-8)" }}>
          <SkeletonGrid count={4} cols={4} label="Loading photos" />
        </div>
      </div>
    </>
  );
}
