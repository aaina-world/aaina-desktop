import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "../../../lib/api";
import type { Photo, Shoot } from "../../../lib/contract";
import {
  ConfirmDialog,
  EmptyState,
  Icon,
  KbdOnButton,
  KIND_LABEL,
  LoadError,
  PageHead,
  RenameDialog,
  SaveDialog,
  SearchBox,
  Segmented,
  SkeletonGrid,
  Topbar,
  formatDate,
  plural,
  toast,
  useMenu,
  type MenuEntry,
} from "../../components";
import { isMod, useLoad, useOs } from "../../hooks";

type Kind = "all" | "model" | "flat-lay" | "ghost" | "draft";
const STEPS = ["product", "model", "poses", "scene", "review"] as const;
const STEP_NAME = ["Product", "Model", "Poses", "Scene", "Review"];

/** Photos of the shoots on screen, for "3 of 5 photos" and "1 photo failed". */
export function useShootPhotos(shoots: Shoot[] | null) {
  const key = (shoots ?? []).map((s) => `${s.id}:${s.status}:${s.photoCount}`).join(",");
  return useLoad(
    async (a) => {
      const out: Record<string, Photo[]> = {};
      const list = (shoots ?? []).filter((s) => s.status !== "draft").slice(0, 80);
      await Promise.all(list.map(async (s) => (out[s.id] = await a.photos(s.id))));
      return out;
    },
    [key],
    ["photo"],
  );
}

export function ShootsScreen() {
  const navigate = useNavigate();
  const { mod, showInFolder } = useOs();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const last = useRef<number>(-1);
  const [confirmDelete, setConfirmDelete] = useState<Shoot[] | null>(null);
  const [rename, setRename] = useState<Shoot | null>(null);
  const [saving, setSaving] = useState<{ photos: Photo[]; name: string } | null>(null);
  const menu = useMenu();

  const shoots = useLoad((a) => a.shoots(), [], ["shoot"]);
  const extra = useShootPhotos(shoots.data);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the empty fallback only matters while loading; the memo below is cheap
  const all = shoots.data ?? [];
  const counts = useMemo(
    () => ({
      all: all.length,
      model: all.filter((s) => s.kind === "model" && s.status !== "draft").length,
      "flat-lay": all.filter((s) => s.kind === "flat-lay" && s.status !== "draft").length,
      ghost: all.filter((s) => s.kind === "ghost" && s.status !== "draft").length,
      draft: all.filter((s) => s.status === "draft").length,
    }),
    [all],
  );
  const shown = useMemo(() => {
    let l = all.filter((s) => (kind === "all" ? true : kind === "draft" ? s.status === "draft" : s.kind === kind && s.status !== "draft"));
    if (q.trim()) l = l.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
    return [...l].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [all, kind, q, sort]);

  // Selection mode marks the page so the check marks stay visible.
  useEffect(() => {
    document.body.dataset.st = selecting ? "selecting" : "";
    return () => {
      document.body.dataset.st = "";
    };
  }, [selecting]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role=dialog], [role=alertdialog]")) return;
      if (e.key === "Escape" && selecting) exitSelect();
      if ((e.key === "Backspace" || e.key === "Delete") && sel.size) setConfirmDelete(all.filter((s) => sel.has(s.id)));
      if (isMod(e) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        window.dispatchEvent(new Event("aaina:focus-search"));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

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
        const [a, b] = [Math.min(last.current, i), Math.max(last.current, i)];
        for (let k = a; k <= b; k++) next.add(shown[k].id);
      } else if (next.has(shown[i].id)) next.delete(shown[i].id);
      else next.add(shown[i].id);
      return next;
    });
    last.current = i;
  }
  const hrefOf = (s: Shoot) => (s.status === "draft" ? `/create/${s.id}/${s.draftStep ?? "model"}` : `/shoots/${s.id}`);

  async function duplicate(s: Shoot) {
    try {
      const a = await api();
      const n = await a.createShoot({ kind: s.kind, productId: s.productId });
      await a.updateShoot(n.id, { model: s.model, scene: s.scene, quality: s.quality, plan: s.plan, draftStep: "review" });
      void navigate(`/create/${n.id}/review`);
    } catch {
      toast("We couldn't copy those settings. Try again.", { icon: "alert" });
    }
  }
  async function folderOf(s: Shoot) {
    const a = await api();
    const p = (extra.data?.[s.id] ?? (await a.photos(s.id))).find((x) => x.path)?.path;
    void a.showInFolder(p ?? (await a.settings()).photosFolder);
  }
  async function donePhotos(list: Shoot[]) {
    const a = await api();
    const all = await Promise.all(list.map((s) => a.photos(s.id)));
    return all.flat().filter((p) => p.status === "done");
  }
  async function saveShoots(list: Shoot[]) {
    const ph = await donePhotos(list);
    if (!ph.length) {
      toast("There are no finished photos to save yet.", { icon: "alert" });
      return;
    }
    setSaving({ photos: ph, name: list.length === 1 ? list[0].name : "Aaina photos" });
  }
  function menuFor(s: Shoot): MenuEntry[] {
    return [
      { label: "Open", icon: "eye", right: "↵", onSelect: () => navigate(hrefOf(s)) },
      { label: "Rename", icon: "edit", right: "F2", onSelect: () => setRename(s) },
      { label: "Duplicate settings", icon: "versions", onSelect: () => duplicate(s) },
      "sep",
      {
        label: "Save all photos…",
        icon: "download",
        right: mod + "S",
        disabled: s.status === "draft" || s.photoCount === 0,
        onSelect: () => saveShoots([s]),
      },
      { label: showInFolder, icon: "folder", disabled: s.status === "draft", onSelect: () => folderOf(s) },
      "sep",
      { label: "Delete shoot", icon: "trash", right: "⌫", danger: true, onSelect: () => setConfirmDelete([s]) },
    ];
  }
  async function doDelete(list: Shoot[]) {
    const a = await api();
    await Promise.all(list.map((s) => a.deleteShoot(s.id)));
    setConfirmDelete(null);
    exitSelect();
    toast(`Deleted ${plural(list.length, "shoot")}`, { icon: "trash" });
  }

  const empty = !shoots.loading && !shoots.error && all.length === 0;
  const selected = all.filter((s) => sel.has(s.id));

  return (
    <>
      <Topbar crumbs={["Shoots"]}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            const a = await api();
            void a.showInFolder((await a.settings()).photosFolder);
          }}
        >
          <Icon name="folder" size="sm" />
          {showInFolder}
        </button>
      </Topbar>
      <div className="page">
        <PageHead
          title="Shoots"
          lede={
            <>
              Kept on this computer, in <FolderPath />.
            </>
          }
        >
          {!empty && (
            <button className={"btn btn-secondary"} onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
              {selecting ? "Done" : "Select"}
              {!selecting && (
                <span className="kbd" style={{ marginLeft: 2 }}>
                  {mod}click
                </span>
              )}
            </button>
          )}
          <Link className="btn btn-primary" to="/create/new">
            <Icon name="plus" />
            New shoot<KbdOnButton mod>N</KbdOnButton>
          </Link>
        </PageHead>

        {!empty && (
          <div className="tb">
            <Segmented
              label="Kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "model", label: "On a model", count: counts.model },
                { value: "flat-lay", label: "Flat-lay", count: counts["flat-lay"] },
                { value: "ghost", label: "Ghost mannequin", count: counts.ghost },
                { value: "draft", label: "Drafts", count: counts.draft },
              ]}
            />
            <div className="tb-tools">
              <SearchBox
                className="search-wrap"
                value={q}
                onChange={(v) => setParams(v ? { q: v } : {}, { replace: true })}
                placeholder="Search shoots"
                hint="F"
                label="Search shoots"
              />
              <select className="select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        )}

        {shoots.error && <LoadError onRetry={shoots.reload}>We couldn't read your shoots from this computer.</LoadError>}
        {shoots.loading && !shoots.data && <SkeletonGrid count={10} label="Loading shoots" />}
        {empty && (
          <EmptyState
            icon="images"
            title="No shoots yet"
            action={
              <Link className="btn btn-primary mt-2" to="/create/new">
                <Icon name="plus" />
                New shoot<KbdOnButton mod>N</KbdOnButton>
              </Link>
            }
          >
            Add a product photo and pick a model. Your first photos take about a minute each, and you see the price before anything is made.
            <span className="local-note mt-2" style={{ display: "flex", justifyContent: "center" }}>
              <Icon name="lock" />
              You can also drop product photos anywhere in this window.
            </span>
          </EmptyState>
        )}
        {!shoots.loading && all.length > 0 && shown.length === 0 && (
          <EmptyState icon="search" compact title="Nothing here">
            {q ? `No shoots match “${q}”.` : "No shoots of this kind yet."}
          </EmptyState>
        )}

        {shown.length > 0 && (
          <div className="grid" id="grid">
            {shown.map((s, i) => {
              const ready = s.readyCount ?? s.photoCount;
              const total = s.plan.length;
              const failed = s.failedCount ?? 0;
              const making = s.status === "making";
              const draft = s.status === "draft";
              const stepIdx = draft ? Math.max(0, STEPS.indexOf(s.draftStep ?? "model")) : 0;
              const meta = draft
                ? `Draft · Step ${stepIdx + 1} of 5, ${STEP_NAME[stepIdx]}`
                : making
                  ? `${KIND_LABEL[s.kind]} · ${ready} of ${total} photos`
                  : `${KIND_LABEL[s.kind]} · ${plural(s.photoCount, "photo")}`;
              return (
                <article
                  key={s.id}
                  className={"tile shoot" + (s.kind === "ghost" ? " contain" : "")}
                  {...(sel.has(s.id) ? { "data-sel": "" } : {})}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    menu.open(e, menuFor(s));
                  }}
                >
                  <div className="media">
                    <Link
                      to={hrefOf(s)}
                      aria-label={s.name}
                      onClick={(e) => {
                        if (selecting || e.metaKey || e.ctrlKey || e.shiftKey) {
                          e.preventDefault();
                          toggle(i, e.shiftKey);
                        }
                      }}
                    >
                      {s.coverUrl ? (
                        <img src={s.coverUrl} alt="" loading="lazy" style={making ? { filter: "saturate(.7) blur(2px)" } : undefined} />
                      ) : (
                        <span
                          className="center"
                          style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--fg-subtle)" }}
                        >
                          <Icon name="images" size="lg" />
                        </span>
                      )}
                    </Link>
                    {(making || draft || failed > 0) && (
                      <span className="over-tl" style={{ left: 40 }}>
                        {making ? (
                          <span className="badge info dot">Making</span>
                        ) : draft ? (
                          <span className="badge glass">Draft</span>
                        ) : (
                          <span className="badge danger dot">
                            {failed} {failed === 1 ? "photo" : "photos"} failed
                          </span>
                        )}
                      </span>
                    )}
                    <button
                      className="sel-mark hover-only"
                      aria-label={sel.has(s.id) ? "Deselect" : "Select"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(i, e.shiftKey);
                      }}
                    >
                      <Icon name="check" size="sm" />
                    </button>
                    {making && (
                      <div className="progress" style={{ position: "absolute", left: 10, right: 10, bottom: 10 }}>
                        <i style={{ "--p": `${total ? Math.max(8, Math.round((ready / total) * 100)) : 10}%` } as React.CSSProperties} />
                      </div>
                    )}
                  </div>
                  <div className="cap">
                    <div className="grow">
                      <div className="t">{s.name}</div>
                      <div className="m">{meta}</div>
                      <div className="m num">{formatDate(s.createdAt)}</div>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label="Shoot options"
                      onClick={(e) => menu.open(e.currentTarget, menuFor(s))}
                    >
                      <Icon name="more" size="sm" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selecting && (
        <div className="actionbar selbar">
          <div className="summary">
            <div className="txt">
              <b>{plural(sel.size, "shoot")} selected</b>
              <span>Shift-click for a range, {mod}click to add one</span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={exitSelect}>
            Cancel
            <span className="kbd" style={{ marginLeft: 6 }}>
              Esc
            </span>
          </button>
          <button className="btn btn-secondary" disabled={!sel.size} onClick={() => saveShoots(selected)}>
            <Icon name="download" />
            Save photos
          </button>
          <button className="btn btn-danger" disabled={!sel.size} onClick={() => setConfirmDelete(selected)}>
            <Icon name="trash" />
            Delete {sel.size} {sel.size === 1 ? "shoot" : "shoots"}
          </button>
        </div>
      )}
      {menu.node}
      {confirmDelete && (
        <ConfirmDialog
          danger
          title={confirmDelete.length === 1 ? `Delete ${confirmDelete[0].name}?` : `Delete ${confirmDelete.length} shoots?`}
          description={`${confirmDelete.length === 1 ? "Its" : "Their"} photos are removed from this computer. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => doDelete(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
      {rename && (
        <RenameDialog
          title="Rename shoot"
          value={rename.name}
          onClose={() => setRename(null)}
          onSave={async (name) => {
            await (await api()).updateShoot(rename.id, { name });
          }}
        />
      )}
      {saving && <SaveDialog photos={saving.photos} shootName={saving.name} onClose={() => setSaving(null)} />}
    </>
  );
}

/** The photos folder, as a mono path (set in Settings). */
export function FolderPath() {
  const f = useLoad((a) => a.settings(), []);
  return <span className="t-mono">{f.data?.photosFolder ?? "~/Pictures/Aaina"}</span>;
}
