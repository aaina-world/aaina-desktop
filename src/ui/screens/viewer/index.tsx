import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { api } from "../../../lib/api";
import type { Expression, Frame, Photo } from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import {
  ConfirmDialog,
  EmptyState,
  Icon,
  LoadError,
  SaveDialog,
  costText,
  formatDateTime,
  groupShots,
  toast,
  plural,
  failureText,
} from "../../components";
import { isMod, useLoad, useOs } from "../../hooks";

type Panel = "tools" | "fix" | "colours" | "frame" | "versions";
const FIXES = ["Smooth the wrinkles", "Fix the hands", "Straighten the hem", "Remove a stray hair"];
const SW = [
  { name: "Black", hex: "#161615" },
  { name: "Navy", hex: "#1d2a4d" },
  { name: "Forest", hex: "#2c4a3a" },
  { name: "Rust", hex: "#a4491f" },
  { name: "Sand", hex: "#d6c3a1" },
  { name: "Rose", hex: "#d98a9b" },
  { name: "White", hex: "#f4f4f1" },
  { name: "Sky", hex: "#8fb7e0" },
];
const FRAMES: { v: Frame; label: string; words: string }[] = [
  { v: "as-posed", label: "As posed", words: "" },
  { v: "full-length", label: "Full length", words: "full length" },
  { v: "head-to-knee", label: "Head to knee", words: "head to knee" },
  { v: "waist-up", label: "Waist up", words: "waist up" },
  { v: "close-up", label: "Close-up", words: "close-up" },
];
const EXPRESSIONS: { v: Expression; label: string; words: string }[] = [
  { v: "as-posed", label: "As posed", words: "" },
  { v: "neutral", label: "Neutral", words: "neutral" },
  { v: "soft-smile", label: "Soft smile", words: "a soft smile" },
  { v: "big-smile", label: "Big smile", words: "a big smile" },
  { v: "serious", label: "Serious", words: "serious" },
  { v: "looking-away", label: "Looking away", words: "looking away" },
];

export function ViewerScreen() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const shootParam = params.get("shoot");
  const navigate = useNavigate();
  const { mod, showInFolder } = useOs();

  const data = useLoad(
    async (a) => {
      const sid = shootParam ?? (await a.photo(id))?.shootId ?? null;
      const photos: Photo[] | null = sid ? await a.photos(sid) : null;
      if (!photos?.some((p) => p.id === id) || !sid) return null;
      const shoot = await a.shoot(sid);
      const product = shoot ? await a.product(shoot.productId) : null;
      return { photos, shoot, product };
    },
    [shootParam ?? id],
    ["photo", "shoot"],
  );
  const lookups = useLoad(async (a) => {
    const [models, scenes, own, ownScenes] = await Promise.all([a.models(), a.scenes(), a.ownModels(), a.ownScenes()]);
    return { models, scenes, own, ownScenes };
  }, []);

  const [panel, setPanel] = useState<Panel>("tools");
  const [compare, setCompare] = useState(false);
  const [zoom, setZoom] = useState(false);
  // Zoom looks at the point under the mouse: the photo is scaled from there and follows the mouse while zoomed.
  const aimZoom = (e: React.MouseEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const at = (n: number) => `${Math.min(100, Math.max(0, n * 100)).toFixed(1)}%`;
    e.currentTarget.style.setProperty("--zx", at((e.clientX - box.left) / box.width));
    e.currentTarget.style.setProperty("--zy", at((e.clientY - box.top) / box.height));
  };
  const [save, setSave] = useState<Photo | null>(null);
  const [del, setDel] = useState<Photo | null>(null);
  const [words, setWords] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [frame, setFrame] = useState<Frame>("as-posed");
  const [expr, setExpr] = useState<Expression>("as-posed");
  const [busy, setBusy] = useState(false);
  const [x, setX] = useState(50);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the empty fallback only matters while loading; the memo below is cheap
  const photos = data.data?.photos ?? [];
  const shoot = data.data?.shoot ?? null;
  const product = data.data?.product ?? null;
  const groups = useMemo(() => groupShots(photos), [photos]);
  const photo = photos.find((p) => p.id === id) ?? null;
  const group = groups.find((g) => g.versions.some((v) => v.id === id)) ?? null;
  const strip = groups.filter((g) => g.shown.status === "done");
  const idx = group ? strip.findIndex((g) => g.key === group.key) : -1;
  const sid = shoot?.id ?? shootParam ?? "";

  // The address always names the shoot, so a refresh finds the photo at once.
  useEffect(() => {
    if (!shootParam && sid) void navigate(`/photo/${id}?shoot=${sid}`, { replace: true });
  }, [shootParam, sid, id, navigate]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    setZoom(false);
    setPanel("tools");
    setCompare(false);
  }, [group?.key]);

  const go = (to: number) => {
    const g = strip[to];
    if (g) void navigate(`/photo/${g.shown.id}?shoot=${sid}`, { replace: true });
  };
  const close = () => navigate(sid ? `/shoots/${sid}` : "/shoots");

  async function again(note?: string, options?: { frame?: Frame; expression?: Expression }) {
    if (!photo) return;
    setBusy(true);
    try {
      await (await api()).makeAgain(photo.id, note, options);
      toast("Making a new version. It shows here when it's ready.", { icon: "refresh" });
      setPanel("tools");
    } catch {
      toast("We couldn't start that. Nothing was sent to OpenAI.", { icon: "alert" });
    } finally {
      setBusy(false);
    }
  }
  async function fix() {
    if (!photo || !words.trim()) return;
    setBusy(true);
    try {
      await (await api()).fixPhoto(photo.id, words.trim());
      toast("Making the fix. It is saved as a new version.", { icon: "wand" });
      setWords("");
      setPanel("tools");
    } catch {
      toast("We couldn't start the fix. Nothing was sent to OpenAI.", { icon: "alert" });
    } finally {
      setBusy(false);
    }
  }
  async function colours() {
    if (!photo || !picked.length) return;
    setBusy(true);
    try {
      await (
        await api()
      ).otherColours(
        photo.id,
        SW.filter((s) => picked.includes(s.hex)),
      );
      toast(`Making ${plural(picked.length, "colour")}. They appear in this shoot.`, { icon: "palette" });
      setPicked([]);
      setPanel("tools");
    } catch {
      toast("We couldn't start the colours. Nothing was sent to OpenAI.", { icon: "alert" });
    } finally {
      setBusy(false);
    }
  }
  async function frameGo() {
    await again(undefined, { ...(frame !== "as-posed" ? { frame } : {}), ...(expr !== "as-posed" ? { expression: expr } : {}) });
  }
  async function copy() {
    if (!photo) return;
    try {
      await (await api()).copyPhoto(photo.id);
      toast("Copied");
    } catch {
      toast("We couldn't copy that photo.", { icon: "alert" });
    }
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (document.querySelector(".scrim")) return;
      const typing = !!t.closest("input, textarea, select");
      if (typing) {
        if (e.key === "Enter" && isMod(e)) {
          e.preventDefault();
          if (panel === "fix") void fix();
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(idx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(idx + 1);
      } else if (e.key === " ") {
        e.preventDefault();
        if (!compare) setZoom((z) => !z);
      } else if (e.key === "Escape") {
        if (panel !== "tools") setPanel("tools");
        else if (compare) setCompare(false);
        else void close();
      } else if (isMod(e) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (photo?.status === "done") setSave(photo);
      } else if (isMod(e) && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
        e.preventDefault();
        void copy();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (photo) setDel(photo);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const lk = lookups.data;
  const modelRef = shoot?.model;
  const model = modelRef
    ? modelRef.source === "studio"
      ? lk?.models.find((m) => m.id === modelRef.id)
      : lk?.own.find((m) => m.id === modelRef.id)
    : null;
  const modelImg = model ? ("cardUrl" in model ? model.cardUrl : model.sheetUrl) : null;
  const sc = shoot?.scene;
  const scene =
    sc?.source === "studio"
      ? lk?.scenes.find((s) => s.id === sc.id)
      : sc?.source === "own"
        ? lk?.ownScenes.find((s) => s.id === sc.id)
        : null;
  const before = product?.photos[0]?.url;

  function moveSlider(e: React.PointerEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    setX(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  }
  const dragging = useRef(false);

  // ---- states before the photo is there ----
  if (data.loading && !data.data) {
    return (
      <div className="viewer">
        <div className="viewer-stage">
          <div className="viewer-top" data-tauri-drag-region>
            <button className="vbtn closebtn" onClick={close}>
              <Icon name="x" />
              Close
            </button>
          </div>
          <span className="spinner" style={{ color: "#8a8a84" }} />
        </div>
        <aside className="viewer-panel">
          <div className="skeleton" style={{ height: 24, width: "70%" }} />
        </aside>
      </div>
    );
  }
  if (data.error || !data.data || !photo) {
    return (
      <div className="viewer" role="dialog" aria-label="Photo viewer">
        <div className="viewer-stage">
          <div className="viewer-top" data-tauri-drag-region>
            <Link className="vbtn closebtn" to={sid ? `/shoots/${sid}` : "/shoots"}>
              <Icon name="x" />
              Close
            </Link>
          </div>
          <div style={{ maxWidth: 420 }}>
            {data.error ? (
              <LoadError onRetry={data.reload}>We couldn't open this photo.</LoadError>
            ) : (
              <EmptyState icon="search" compact title="We can't find that photo">
                It may have been deleted.
              </EmptyState>
            )}
          </div>
        </div>
        <aside className="viewer-panel" />
      </div>
    );
  }

  const ready = photo.status === "done" && photo.url;
  const nVersions = group ? group.versions.length : 1;
  const sub = [shoot?.name, nVersions > 1 ? `Version ${photo.version}` : null, formatDateTime(photo.finishedAt ?? photo.createdAt)]
    .filter(Boolean)
    .join(" · ");
  const pending = group?.pending ?? null;
  const modelKind = photo.shot.kind === "model";

  return (
    <div className="viewer" role="dialog" aria-label="Photo viewer" aria-modal="true">
      <div className={"viewer-stage" + (zoom ? " zoomed" : "")} id="stage">
        <div className="viewer-top" data-tauri-drag-region>
          <button className="vbtn closebtn" onClick={close} aria-label="Close viewer">
            <Icon name="x" />
            Close<span className="kbd">Esc</span>
          </button>
          <span className="count num" data-tauri-drag-region>
            {idx >= 0 ? `${idx + 1} of ${strip.length}` : ""}
          </span>
          <span className="grow" data-tauri-drag-region />
          <button className="vbtn" id="zoom" aria-label="Zoom" aria-pressed={zoom} disabled={compare} onClick={() => setZoom((z) => !z)}>
            <Icon name="zoom" />
            <span className="lbl">Zoom</span>
            <span className="kbd">Space</span>
          </button>
          <button
            className="vbtn"
            aria-pressed={compare}
            aria-label="Compare with my product photo"
            disabled={!before}
            onClick={() => {
              setCompare((c) => !c);
              setZoom(false);
            }}
          >
            <Icon name="compare" />
            Compare
          </button>
          <button className="vbtn primary" disabled={!ready} onClick={() => setSave(photo)}>
            <Icon name="download" />
            Save photo<span className="kbd">{mod}S</span>
          </button>
        </div>
        {idx > 0 && (
          <button className="vnav l" aria-label="Previous photo" onClick={() => go(idx - 1)}>
            <Icon name="left" />
          </button>
        )}
        {idx >= 0 && idx < strip.length - 1 && (
          <button className="vnav r" aria-label="Next photo" onClick={() => go(idx + 1)}>
            <Icon name="right" />
          </button>
        )}

        {!compare && (
          <div
            className="photo"
            id="photo"
            onClick={(e) => {
              if (!ready) return;
              aimZoom(e);
              setZoom((z) => !z);
            }}
            onMouseMove={(e) => zoom && aimZoom(e)}
          >
            {ready ? (
              <img src={photo.url!} alt={`${photo.title}, ${shoot?.name ?? ""}`} />
            ) : (
              <div style={{ textAlign: "center", color: "#b8b8b2", maxWidth: 360 }}>
                <Icon name="alert" size="lg" />
                <p style={{ marginTop: 8 }}>
                  {photo.status === "failed" || photo.status === "interrupted"
                    ? failureText(photo).head
                    : "This photo is still being made."}
                </p>
              </div>
            )}
          </div>
        )}
        {compare && before && ready && (
          <div className="cmpwrap" id="cmpwrap">
            <div
              className="compare"
              id="cmpbox"
              style={{ "--x": `${x}%` } as React.CSSProperties}
              onPointerDown={(e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                moveSlider(e);
              }}
              onPointerMove={(e) => dragging.current && moveSlider(e)}
              onPointerUp={() => (dragging.current = false)}
            >
              <img className="before" src={before} alt="Your product photo" />
              <img className="after" src={photo.url!} alt="Made photo" />
              <span className="lab l">Your product photo</span>
              <span className="lab r">Made photo</span>
              <div className="handle" />
            </div>
          </div>
        )}

        <div className="viewer-filmstrip" role="tablist" aria-label="Photos in this shoot">
          {strip.map((g, i) => (
            <button key={g.key} aria-label={`Photo ${i + 1}`} aria-selected={g.key === group?.key} onClick={() => go(i)}>
              <img className={g.key === group?.key ? "on" : undefined} src={g.shown.url ?? ""} alt="" />
            </button>
          ))}
        </div>
      </div>

      <aside className="viewer-panel" aria-label="Photo tools">
        <div>
          <h1>{photo.title}</h1>
          <div className="sub">{sub}</div>
          {modelKind ? (
            <div className="vchips">
              {model && (
                <span className="vchip">
                  {modelImg && <img src={modelImg} alt="" />}
                  <span>
                    <span className="k">Model</span> {model.name}
                  </span>
                </span>
              )}
              {sc && (
                <span className="vchip">
                  {scene?.imageUrl ? (
                    <img src={scene.imageUrl} alt="" />
                  ) : sc.source === "colour" ? (
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: sc.hex, marginLeft: 3 }} />
                  ) : null}
                  <span>
                    <span className="k">Scene</span> {scene?.name ?? (sc.source === "colour" ? sc.name : "")}
                  </span>
                </span>
              )}
              <span className="vchip noimg">
                <Icon name="user" />
                <span>
                  <span className="k">Pose</span> {photo.title}
                </span>
              </span>
            </div>
          ) : null}
        </div>

        {pending && (
          <div
            className="vnote"
            role="status"
            style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "rgb(255 255 255 / .06)", color: "#d4d4ce" }}
          >
            {pending.status === "failed" || pending.status === "interrupted" ? (
              <>
                The new version wasn't made. {failureText(pending).line}{" "}
                <button className="btn-link" style={{ color: "#f3f3f0" }} onClick={async () => (await api()).tryAgain(pending.id)}>
                  Try again
                </button>
              </>
            ) : (
              "A new version is being made. It will be in the versions list when it's ready."
            )}
          </div>
        )}

        {panel === "tools" && (
          <>
            <div className="vgroup">
              <div className="t-eyebrow">Change this photo</div>
              <button className="tool" disabled={!ready || busy} onClick={() => again()}>
                <span className="ti">
                  <Icon name="refresh" />
                </span>
                <span>
                  <span className="tt">Make again</span>
                  <span className="td">A new version of this photo</span>
                </span>
                <span className="tc">{costText(photo.estimateUsd)}</span>
              </button>
              <button className="tool" disabled={!ready} onClick={() => setPanel("fix")}>
                <span className="ti">
                  <Icon name="wand" />
                </span>
                <span>
                  <span className="tt">Fix something</span>
                  <span className="td">Change one small thing</span>
                </span>
                <span className="tc">{costText(ESTIMATE_USD.edit)}</span>
              </button>
              <button className="tool" disabled={!ready} onClick={() => setPanel("colours")}>
                <span className="ti">
                  <Icon name="palette" />
                </span>
                <span>
                  <span className="tt">Other colours</span>
                  <span className="td">Same photo, new colours</span>
                </span>
                <span className="tc">{costText(ESTIMATE_USD.edit)} each</span>
              </button>
              {modelKind && (
                <button className="tool" disabled={!ready} onClick={() => setPanel("frame")}>
                  <span className="ti">
                    <Icon name="frame" />
                  </span>
                  <span>
                    <span className="tt">Frame and expression</span>
                    <span className="td">Crop closer, change the smile</span>
                  </span>
                  <span className="tc">{costText(photo.estimateUsd)}</span>
                </button>
              )}
            </div>
            <div className="vgroup">
              <div className="t-eyebrow">Keep</div>
              <button className="tool" disabled={!ready} onClick={() => setSave(photo)}>
                <span className="ti">
                  <Icon name="download" />
                </span>
                <span>
                  <span className="tt">Save photo…</span>
                  <span className="td">JPEG or original PNG</span>
                </span>
                <span className="tc">
                  <span className="kbd">{mod}S</span>
                </span>
              </button>
              <button className="tool" disabled={!ready} onClick={copy}>
                <span className="ti">
                  <Icon name="copy" />
                </span>
                <span>
                  <span className="tt">Copy photo</span>
                  <span className="td">Paste it into any app</span>
                </span>
                <span className="tc">
                  <span className="kbd">{mod}C</span>
                </span>
              </button>
              <button className="tool" disabled={!ready} onClick={async () => (await api()).showInFolder(photo.path ?? "")}>
                <span className="ti">
                  <Icon name="folder" />
                </span>
                <span>
                  <span className="tt">{showInFolder}</span>
                  <span className="td">
                    {photo.path ? (photo.path.split("/").slice(-2, -1)[0] ?? "Your photos folder") : "Your photos folder"}
                  </span>
                </span>
              </button>
              {nVersions > 1 && (
                <button className="tool" onClick={() => setPanel("versions")}>
                  <span className="ti">
                    <Icon name="versions" />
                  </span>
                  <span>
                    <span className="tt">Versions</span>
                    <span className="td">{nVersions} versions of this photo</span>
                  </span>
                  <span className="tc">{nVersions}</span>
                </button>
              )}
              <button
                className="tool"
                disabled={!before || !ready}
                onClick={() => {
                  setCompare(true);
                  setZoom(false);
                }}
              >
                <span className="ti">
                  <Icon name="compare" />
                </span>
                <span>
                  <span className="tt">Compare</span>
                  <span className="td">Slide against your product photo</span>
                </span>
              </button>
            </div>
            <div className="vgroup">
              <div className="t-eyebrow">Delete</div>
              <button className="tool danger" onClick={() => setDel(photo)}>
                <span className="ti">
                  <Icon name="trash" />
                </span>
                <span>
                  <span className="tt">Delete photo</span>
                  <span className="td">Removes it from this computer</span>
                </span>
                <span className="tc">
                  <span className="kbd">⌫</span>
                </span>
              </button>
            </div>
          </>
        )}

        {panel === "fix" && (
          <div className="stack" style={{ "--gap": "16px" } as React.CSSProperties}>
            <button className="vback" onClick={() => setPanel("tools")}>
              <Icon name="left" size="sm" />
              All tools
            </button>
            <div>
              <h2>Fix something</h2>
              <p className="vnote" style={{ marginTop: 6, fontSize: "var(--text-sm)" }}>
                Describe one small change. The rest of the photo stays as it is, and the fix is saved as a new version.
              </p>
            </div>
            <div>
              <textarea
                className="vtext"
                aria-label="What to fix"
                maxLength={500}
                autoFocus
                value={words}
                onChange={(e) => setWords(e.target.value)}
                placeholder="Straighten the sleeve hem on the left arm"
              />
              <div className="vcounter">
                <span>Plain words work best</span>
                <span>{words.length} / 500</span>
              </div>
            </div>
            <div className="vchips2">
              {FIXES.map((f) => (
                <button key={f} className="vchip2" onClick={() => setWords(f)}>
                  {f}
                </button>
              ))}
            </div>
            <button className="vgo" disabled={busy || !words.trim()} style={!words.trim() ? { opacity: 0.5 } : undefined} onClick={fix}>
              Make the fix<span className="cost">{costText(ESTIMATE_USD.edit)}</span>
            </button>
            <p className="vnote">
              OpenAI bills the fix to your connection. <span className="kbd">{mod}↵</span> to make it.
            </p>
          </div>
        )}

        {panel === "colours" && (
          <div className="stack" style={{ "--gap": "16px" } as React.CSSProperties}>
            <button className="vback" onClick={() => setPanel("tools")}>
              <Icon name="left" size="sm" />
              All tools
            </button>
            <div>
              <h2>Other colours</h2>
              <p className="vnote" style={{ marginTop: 6, fontSize: "var(--text-sm)" }}>
                Pick up to 6. Each colour is made as its own photo in this shoot.
              </p>
            </div>
            <div className="row spread">
              <span className="t-eyebrow">Colours</span>
              <span className="vcounter" style={{ margin: 0 }}>
                <span>{picked.length} of 6 chosen</span>
              </span>
            </div>
            <div className="vsw-grid">
              {SW.map((s) => {
                const on = picked.includes(s.hex);
                return (
                  <button
                    key={s.hex}
                    className={"vsw" + (picked.length > 0 && !on ? " off" : "")}
                    aria-pressed={on}
                    disabled={!on && picked.length >= 6}
                    onClick={() => setPicked((l) => (on ? l.filter((h) => h !== s.hex) : [...l, s.hex]))}
                  >
                    <span className="dot" style={{ background: s.hex }} />
                    {s.name}
                  </button>
                );
              })}
            </div>
            <button
              className="vgo"
              disabled={busy || !picked.length}
              style={!picked.length ? { opacity: 0.5 } : undefined}
              onClick={colours}
            >
              {picked.length ? `Make ${plural(picked.length, "photo")}` : "Choose colours"}
              <span className="cost">
                {picked.length ? costText(ESTIMATE_USD.edit, { count: picked.length }) : costText(ESTIMATE_USD.edit) + " each"}
              </span>
            </button>
            <p className="vnote">The product keeps its shape and print. Only the colour changes.</p>
          </div>
        )}

        {panel === "frame" && (
          <div className="stack" style={{ "--gap": "16px" } as React.CSSProperties}>
            <button className="vback" onClick={() => setPanel("tools")}>
              <Icon name="left" size="sm" />
              All tools
            </button>
            <div>
              <h2>Frame and expression</h2>
              <p className="vnote" style={{ marginTop: 6, fontSize: "var(--text-sm)" }}>
                Crop closer or change the expression. It is made as a new version of this photo.
              </p>
            </div>
            <div>
              <div className="t-eyebrow" style={{ marginBottom: 8 }}>
                Frame
              </div>
              <div className="vchips2">
                {FRAMES.map((f) => (
                  <button
                    key={f.v}
                    className="vchip2"
                    aria-pressed={frame === f.v}
                    style={frame === f.v ? { background: "#f3f3f0", color: "#0c0c0b", borderColor: "#f3f3f0" } : undefined}
                    onClick={() => setFrame(f.v)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="t-eyebrow" style={{ marginBottom: 8 }}>
                Expression
              </div>
              <div className="vchips2">
                {EXPRESSIONS.map((f) => (
                  <button
                    key={f.v}
                    className="vchip2"
                    aria-pressed={expr === f.v}
                    style={expr === f.v ? { background: "#f3f3f0", color: "#0c0c0b", borderColor: "#f3f3f0" } : undefined}
                    onClick={() => setExpr(f.v)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="vgo"
              disabled={busy || (frame === "as-posed" && expr === "as-posed")}
              style={frame === "as-posed" && expr === "as-posed" ? { opacity: 0.5 } : undefined}
              onClick={frameGo}
            >
              Make a new version<span className="cost">{costText(photo.estimateUsd)}</span>
            </button>
          </div>
        )}

        {panel === "versions" && group && (
          <div className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
            <button className="vback" onClick={() => setPanel("tools")}>
              <Icon name="left" size="sm" />
              All tools
            </button>
            <div>
              <h2>Versions</h2>
              <p className="vnote" style={{ marginTop: 6, fontSize: "var(--text-sm)" }}>
                Every version of this photo is kept. Pick one to look at it.
              </p>
            </div>
            <div className="vgroup">
              {[...group.versions].reverse().map((v) => (
                <button key={v.id} className="tool" onClick={() => navigate(`/photo/${v.id}?shoot=${sid}`, { replace: true })}>
                  <span className="ti" style={{ width: 36, height: 48, overflow: "hidden", padding: 0 }}>
                    {v.url ? (
                      <img src={v.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Icon name={v.status === "failed" ? "alert" : "clock"} />
                    )}
                  </span>
                  <span>
                    <span className="tt">Version {v.version}</span>
                    <span className="td">
                      {versionNote(v)} · {formatDateTime(v.finishedAt ?? v.createdAt)}
                    </span>
                  </span>
                  {v.id === photo.id && (
                    <span className="tc">
                      <Icon name="check" size="sm" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="vhints" aria-label="Keyboard shortcuts">
          <span>
            <span className="kbd">←</span>
            <span className="kbd">→</span>Move
          </span>
          <span>
            <span className="kbd">Space</span>Zoom
          </span>
          <span>
            <span className="kbd">{mod}S</span>Save
          </span>
          <span>
            <span className="kbd">Esc</span>Close
          </span>
        </div>
      </aside>

      {save && shoot && <SaveDialog photos={[save]} shootName={shoot.name} onClose={() => setSave(null)} />}
      {del && (
        <ConfirmDialog
          danger
          title="Delete this photo?"
          description={
            nVersions > 1
              ? "It is removed from this computer, with all its versions. This can't be undone."
              : "It is removed from this computer. This can't be undone."
          }
          confirmLabel="Delete"
          onClose={() => setDel(null)}
          onConfirm={async () => {
            const a = await api();
            const victims = group ? group.versions : [del];
            await Promise.all(victims.map((v) => a.deletePhoto(v.id)));
            setDel(null);
            toast("Photo deleted", { icon: "trash" });
            const next = strip[idx + 1] ?? strip[idx - 1];
            if (next && next.key !== group?.key) void navigate(`/photo/${next.shown.id}?shoot=${sid}`, { replace: true });
            else void close();
          }}
        />
      )}
    </div>
  );
}

function versionNote(v: Photo): string {
  if (v.status === "failed") return "Couldn't be made";
  if (v.status === "interrupted") return "Interrupted";
  if (v.status !== "done") return "Making";
  const c = v.change;
  return c.kind === "new"
    ? "As first made"
    : c.kind === "again"
      ? "Made again"
      : c.kind === "fix"
        ? "Fixed: " + c.words.slice(0, 28)
        : `Colour: ${c.name}`;
}
