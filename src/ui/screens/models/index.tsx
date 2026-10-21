import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import type { Gender, OwnModel } from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import { Dialog } from "../../components/Dialog";
import { ConfirmDialog } from "../../components/dialogs";
import { FieldError, LoadError, Notice } from "../../components/Notice";
import { toast } from "../../components/Toast";
import { Chip, Segmented, Skeleton } from "../../components/controls";
import { useOs } from "../../hooks/useOs";
import { Icon, Note, about, fmtDate, humanize, messageOf, useApi, useLoad } from "../create/kit";
import "../create/create.css";
import faceA from "../create/img/model-tara-p.webp";
import faceB from "../create/img/model-camille-p.webp";
import faceC from "../create/img/model-nia-p.webp";
import "./models.css";

const LOOKS = ["South Asian", "East Asian", "Southeast Asian", "Black", "Middle Eastern", "Latina", "White", "Mixed", "Any"];
const BODIES = ["Slim", "Average", "Athletic", "Curvy", "Plus size", "Any"];
const HAIR = ["Long and loose", "Shoulder length", "Short", "Curly", "Tied back", "Covered"];
const STEPS = ["Describe or add photos", "Pick a face", "Reference sheet", "Ready"];

function Chrome({ step, crumb, children }: { step: number; crumb: string; children?: React.ReactNode }) {
  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="mflow grow">
        <Link className="btn btn-ghost btn-icon" to="/library/models" aria-label="Back to Library">
          <Icon name="left" />
        </Link>
        <div className="crumbs">
          <Link to="/library">Library</Link>
          <span className="sep">/</span>
          <Link to="/library/models">Models</Link>
          <span className="sep">/</span>
          <span className="here">{crumb}</span>
        </div>
        <nav className="stepper" aria-label="Steps">
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              {i > 0 && <span className="step-sep" />}
              <span className={`step${step > i + 1 ? " done" : ""}`} aria-current={step === i + 1 ? "step" : undefined}>
                <span className="n">{step > i + 1 ? <Icon name="check" size="sm" style={{ width: 12, height: 12 }} /> : i + 1}</span>
                {s}
              </span>
            </span>
          ))}
        </nav>
        {children}
      </div>
    </header>
  );
}

function SheetBox({ url, name }: { url: string | null; name?: string }) {
  return (
    <div className="sheet one" role="img" aria-label={`Reference sheet, six photos${name ? " of " + name : " of one person"}`}>
      {url ? <img src={url} alt="" /> : <div className="skeleton" style={{ width: "100%", height: "100%" }} />}
    </div>
  );
}

/** Fills slowly towards 90% so a minute of waiting feels like progress, never claims to be done. */
function useFakeProgress(active: boolean, stage: string) {
  const [p, setP] = useState(12);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const tick = () => setP(Math.round(12 + 78 * (1 - Math.exp(-(Date.now() - start) / 40000))));
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [active, stage]);
  return p;
}

// ---------------------------------------------------------------------------------------------

export function ModelCreateScreen() {
  const api = useApi();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = sp.get("m");
  const model = useLoad(async (a) => (id ? a.ownModel(id) : null), [id], ["own"]);
  const m = model.data;

  const [mode, setMode] = useState<"words" | "photos">("words");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("woman");
  const [age, setAge] = useState(30);
  const [look, setLook] = useState("South Asian");
  const [body, setBody] = useState("Average");
  const [hair, setHair] = useState("Long and loose");
  const [words, setWords] = useState("");
  const [paths, setPaths] = useState<(string | null)[]>([null, null, null]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [big, setBig] = useState<string | null>(null);

  const view: "start" | "photos" | "making-faces" | "faces" | "making" | "ready" | "failed" | "loading" = id
    ? model.loading && !m
      ? "loading"
      : !m
        ? "failed"
        : m.status === "draft"
          ? "making-faces"
          : m.status === "choosing-face"
            ? "faces"
            : m.status === "ready"
              ? "ready"
              : m.status === "failed"
                ? "failed"
                : "making"
    : mode === "photos"
      ? "photos"
      : "start";
  const step =
    view === "start" || view === "photos" || view === "loading"
      ? 1
      : view === "faces" || view === "making-faces"
        ? 2
        : view === "making" || view === "failed"
          ? 3
          : 4;
  // Each stage starts its own bar (the faces and the sheet are separate calls), counted from when this page saw it start.
  const progress = useFakeProgress(view === "making" || view === "making-faces", view);

  // Escape leaves the form, like Cancel.
  useEffect(() => {
    if (view !== "start" && view !== "photos") return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".scrim")) void nav("/library/models");
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [view, nav]);

  const nPhotos = paths.filter(Boolean).length;
  const photosCost = 0.01 * nPhotos + ESTIMATE_USD.sheet;
  const wordsCost = ESTIMATE_USD.faces;

  async function createWords() {
    if (!api || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const created = await api.createOwnModelFromWords({
        name: name.trim() || "My model",
        gender,
        age: Math.min(90, Math.max(18, Math.round(age) || 30)),
        look: look === "Any" ? undefined : look,
        body: body === "Any" ? undefined : body,
        hair,
        words: words.trim() || undefined,
      });
      void nav(`/models/new?m=${created.id}`, { replace: true });
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function createPhotos() {
    if (!api || busy || !paths[0] || !consent) return;
    setBusy(true);
    setErr(null);
    setRefused(null);
    try {
      const created = await api.createOwnModelFromPhotos({
        name: name.trim() || "My model",
        paths: paths.filter(Boolean) as string[],
        consent: true,
      });
      void nav(`/models/new?m=${created.id}`, { replace: true });
    } catch (e) {
      setRefused(messageOf(e));
      setPaths([null, paths[1], paths[2]]);
    } finally {
      setBusy(false);
    }
  }
  async function choosePhoto(i: number) {
    if (!api) return;
    const r = await api.pickFiles({ multiple: false });
    if (!r[0]) return;
    setPaths((p) => p.map((x, j) => (j === i ? r[0] : x)));
    if (i === 0) setRefused(null);
  }

  const canWords = !busy;
  const canPhotos = !!paths[0] && consent && !busy;

  if (view === "loading") {
    return (
      <>
        <Chrome step={1} crumb="Create a model" />
        <div className="page">
          <Skeleton height={40} width={320} />
          <div className="mt-6">
            <Skeleton height={360} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Chrome step={step} crumb={m?.name || "Create a model"} />
      <div className="page">
        {(view === "start" || view === "photos") && (
          <>
            <div className="page-head" style={{ marginBottom: "var(--s-6)" }}>
              <div>
                <h1 className="t-page">Create a model</h1>
                <p className="lede">A model made only for you. It stays on this computer, and nobody else can see it.</p>
              </div>
            </div>
            <div className="starts">
              <button className="card start" aria-selected={mode === "words"} onClick={() => setMode("words")}>
                <span className="faces" aria-hidden="true">
                  <img src={faceA} alt="" />
                  <img src={faceB} alt="" />
                  <img src={faceC} alt="" />
                </span>
                <span className="stack" style={{ ["--gap" as string]: "6px" }}>
                  <span className="t-title">From a description</span>
                  <span className="t-small muted">Answer a few questions. You get 3 face options of a made-up person, then pick one.</span>
                </span>
                <span className="badge info">
                  <Icon name="sparkle" size="sm" style={{ width: 12, height: 12 }} />A made-up person
                </span>
              </button>
              <button className="card start" aria-selected={mode === "photos"} onClick={() => setMode("photos")}>
                <span className="faces" aria-hidden="true">
                  <span className="ph">
                    <Icon name="camera" />
                  </span>
                  <span className="ph">
                    <Icon name="images" />
                  </span>
                  <span className="ph">
                    <Icon name="user" />
                  </span>
                </span>
                <span className="stack" style={{ ["--gap" as string]: "6px" }}>
                  <span className="t-title">From photos of a real person</span>
                  <span className="t-small muted">
                    1 to 3 photos of one adult who agreed to be your model. We make the reference sheet straight from them.
                  </span>
                </span>
                <span className="badge success">
                  <Icon name="shield" size="sm" style={{ width: 12, height: 12 }} />
                  With their permission
                </span>
              </button>
            </div>
            <div className="split" style={{ marginTop: "var(--s-6)" }}>
              {view === "start" ? (
                <div className="stack" style={{ ["--gap" as string]: "12px" }}>
                  <div>
                    <h2 className="t-section">Describe the person</h2>
                    <p className="t-small muted mt-1">Pick what you like. Anything you skip, we choose.</p>
                  </div>
                  <div className="card pad stack" style={{ ["--gap" as string]: "20px" }}>
                    <div className="field">
                      <label className="label" htmlFor="nm">
                        Name <span className="opt">(only you see it)</span>
                      </label>
                      <input
                        className="input"
                        id="nm"
                        placeholder="For example, Riya"
                        autoComplete="off"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                    <div className="row" style={{ ["--gap" as string]: "20px", alignItems: "flex-start" }}>
                      <div className="field grow">
                        <span className="label">Gender</span>
                        <Segmented<Gender>
                          label="Gender"
                          value={gender}
                          onChange={setGender}
                          style={{ alignSelf: "flex-start" }}
                          options={[
                            { value: "woman", label: "Woman" },
                            { value: "man", label: "Man" },
                          ]}
                        />
                      </div>
                      <div className="field" style={{ width: 140 }}>
                        <label className="label" htmlFor="age">
                          Age
                        </label>
                        <input
                          className="input"
                          id="age"
                          type="number"
                          min={18}
                          max={90}
                          value={age}
                          onChange={(e) => setAge(+e.target.value)}
                        />
                        <span className="hint">18 to 90</span>
                      </div>
                    </div>
                    <div className="field">
                      <span className="label">Look</span>
                      <div className="chips">
                        {LOOKS.map((l) => (
                          <Chip key={l} pressed={look === l} onClick={() => setLook(l)}>
                            {l}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <span className="label">Body</span>
                      <div className="chips">
                        {BODIES.map((l) => (
                          <Chip key={l} pressed={body === l} onClick={() => setBody(l)}>
                            {l}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <span className="label">Hair</span>
                      <div className="chips">
                        {HAIR.map((l) => (
                          <Chip key={l} pressed={hair === l} onClick={() => setHair(l)}>
                            {l}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="free">
                        Anything else <span className="opt">(optional)</span>
                      </label>
                      <textarea
                        className="textarea"
                        id="free"
                        style={{ minHeight: 84 }}
                        placeholder="For example, a warm smile, freckles, round glasses"
                        maxLength={200}
                        value={words}
                        onChange={(e) => setWords(e.target.value)}
                      />
                      <div className="counter">{words.length} / 200</div>
                    </div>
                    <p className="t-caption row" style={{ ["--gap" as string]: "8px", alignItems: "flex-start" }}>
                      <Icon name="info" size="sm" style={{ flex: "none" }} />
                      <span>Models are adults, 18 to 90. Your words are checked before anything is made.</span>
                    </p>
                    {err && <FieldError>{err}</FieldError>}
                  </div>
                </div>
              ) : (
                <div className="stack" style={{ ["--gap" as string]: "12px" }}>
                  <div>
                    <h2 className="t-section">Add photos of the person</h2>
                    <p className="t-small muted mt-1">One real adult, 18 or older, who agreed to be your model. Not a well-known person.</p>
                  </div>
                  <div className="stack" style={{ ["--gap" as string]: "20px" }}>
                    <div className="pgrid">
                      {[
                        ["Front face", "Clear, well lit, looking at the camera.", true, "camera"],
                        ["Full length", "Head to toe, standing.", false, "images"],
                        ["From the side", "A profile or three-quarter view.", false, "images"],
                      ].map(([title, hint, req, ico], i) => {
                        const path = paths[i];
                        const bad = i === 0 && refused;
                        return (
                          <div className="pbox" key={title as string}>
                            <div className="phead">
                              <b>{title as string}</b>
                              <span className={`badge${req ? " solid" : ""}`}>{req ? "Required" : "Optional"}</span>
                            </div>
                            <p className="t-caption">{hint as string}</p>
                            {bad ? (
                              <div className="pframe refused">
                                <Icon name="alert" />
                                <span className="t-caption" style={{ color: "var(--fg)" }}>
                                  This photo wasn't used
                                </span>
                                <button className="btn btn-secondary btn-sm" onClick={() => choosePhoto(i)}>
                                  Choose another photo
                                </button>
                              </div>
                            ) : path ? (
                              <div className="pframe has">
                                <span className="ico-ring">
                                  <Icon name="check" />
                                </span>
                                <span className="t-caption fn">{path.split(/[\\/]/).pop()}</span>
                                <button className="btn btn-secondary btn-sm" onClick={() => choosePhoto(i)}>
                                  Choose another
                                </button>
                                <button
                                  className="btn btn-link t-caption"
                                  onClick={() => setPaths((p) => p.map((x, j) => (j === i ? null : x)))}
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="pframe empty">
                                <span className="ico-ring">
                                  <Icon name={ico as "camera"} />
                                </span>
                                <button className="btn btn-secondary btn-sm" onClick={() => choosePhoto(i)}>
                                  Choose photo
                                </button>
                                <span className="t-caption">from your files</span>
                              </div>
                            )}
                            {bad && <FieldError>{refused || "We couldn't see one clear adult face in this photo."}</FieldError>}
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="consent"
                      role="checkbox"
                      aria-checked={consent}
                      tabIndex={0}
                      onClick={() => setConsent(!consent)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          setConsent(!consent);
                        }
                      }}
                    >
                      <span className="check" aria-checked={consent} />
                      <b>I have this person's permission. They are 18 or older.</b>
                    </div>
                    <div className="card pad stack" style={{ ["--gap" as string]: "12px" }}>
                      <div className="field">
                        <label className="label" htmlFor="nm2">
                          Name <span className="opt">(only you see it)</span>
                        </label>
                        <input
                          className="input"
                          id="nm2"
                          placeholder="For example, Riya"
                          autoComplete="off"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          maxLength={40}
                        />
                      </div>
                      <p className="t-caption row" style={{ ["--gap" as string]: "8px", alignItems: "flex-start" }}>
                        <Icon name="shield" size="sm" style={{ flex: "none" }} />
                        <span>
                          A check looks for one clear adult face in each photo and refuses famous people. Photos stay on this computer, and
                          go to OpenAI only to make the sheet.
                        </span>
                      </p>
                    </div>
                    {err && <FieldError>{err}</FieldError>}
                  </div>
                </div>
              )}
              <aside>
                <div className="card price-card">
                  <div className="t-title">What it costs</div>
                  {view === "start" ? (
                    <>
                      <div className="price-line">
                        <span>3 face options</span>
                        <b>{about(ESTIMATE_USD.faces)}</b>
                      </div>
                      <div className="price-line">
                        <span>Reference sheet</span>
                        <b>{about(ESTIMATE_USD.sheet)}</b>
                      </div>
                      <div className="price-total">
                        <span className="t-small muted">Together</span>
                        <span className="v" style={{ fontSize: 24 }}>
                          {about(ESTIMATE_USD.faces + ESTIMATE_USD.sheet)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="price-line">
                        <span>Photo check</span>
                        <b>about $0.01 a photo</b>
                      </div>
                      <div className="price-line">
                        <span>Reference sheet</span>
                        <b>{about(ESTIMATE_USD.sheet)}</b>
                      </div>
                      <div className="price-total">
                        <span className="t-small muted">Together</span>
                        <span className="v" style={{ fontSize: 24 }}>
                          {about(photosCost)}
                        </span>
                      </div>
                    </>
                  )}
                  <p className="t-caption">Billed by OpenAI to your connection. Make it again any time; each try is billed by OpenAI.</p>
                </div>
                <p className="local-note">
                  <Icon name="lock" />
                  The model and its photos stay on this computer.
                </p>
              </aside>
            </div>
          </>
        )}

        {view === "making-faces" && (
          <div className="mcol">
            <section className="card mcard" aria-live="polite">
              <div className="row head">
                <span className="spinner" />
                <div>
                  <h2 className="t-title">Making 3 faces</h2>
                  <p className="t-small muted mt-1">About a minute. You can leave this page; it keeps going.</p>
                </div>
              </div>
              <div className="progress">
                <i style={{ ["--p" as string]: `${progress}%` }} />
              </div>
              <div className="billing">
                <Icon name="info" size="sm" />
                <span>
                  OpenAI bills about {usd0(ESTIMATE_USD.faces)} for the faces. Next you pick one, and the reference sheet is made from it.
                </span>
              </div>
            </section>
            <div className="faces3">
              {[1, 2, 3].map((n) => (
                <div className="fcard" key={n}>
                  <div className="fm">
                    <div className="cellb" style={{ height: "100%", display: "grid", placeItems: "center" }}>
                      <span className="spinner" />
                    </div>
                  </div>
                  <div className="lab">
                    <b>Face {n}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "faces" && m && (
          <div className="mcol">
            <div>
              <span className="t-eyebrow">Step 2 of 4</span>
              <h1 className="t-page mt-2" style={{ fontSize: "var(--text-3xl)" }}>
                Pick a face
              </h1>
              <p className="t-small muted mt-1">
                Choose the face you like. The reference sheet is made from it, and the other two are deleted.
              </p>
            </div>
            {err && <Notice tone="danger">{err}</Notice>}
            <div className="faces3">
              {m.faceOptions.map((f, i) => (
                <div className="fcard" key={f.id}>
                  <div className="fm">
                    <img src={f.url} alt={`Face ${i + 1}`} />
                    <span className="over-tr">
                      <button className="icon-btn-glass" aria-label={`Enlarge face ${i + 1}`} onClick={() => setBig(f.url)}>
                        <Icon name="expand" />
                      </button>
                    </span>
                  </div>
                  <div className="lab">
                    <b>Face {i + 1}</b>
                  </div>
                  <button
                    className="btn btn-primary btn-block"
                    disabled={busy}
                    onClick={async () => {
                      if (!api) return;
                      setBusy(true);
                      setErr(null);
                      try {
                        await api.chooseFace(m.id, f.id);
                        model.reload();
                      } catch (e) {
                        setErr(messageOf(e));
                      }
                      setBusy(false);
                    }}
                  >
                    Use this face<span className="cost">sheet {about(ESTIMATE_USD.sheet)}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "making" && (
          <div className="mcol">
            <section className="card mcard" aria-live="polite">
              <div className="row head">
                <span className="spinner" />
                <div>
                  <h2 className="t-title">Making the reference sheet</h2>
                  <p className="t-small muted mt-1">About a minute. You can leave this page; it keeps going.</p>
                </div>
              </div>
              <div className="progress">
                <i style={{ ["--p" as string]: `${progress}%` }} />
              </div>
              <div className="billing">
                <Icon name="info" size="sm" />
                <span>OpenAI bills about {usd0(ESTIMATE_USD.sheet)} for the sheet. If it can't be made, you aren't billed.</span>
              </div>
            </section>
            <div className="ready-page">
              <div className="sheet busy">
                {Array.from({ length: 6 }, (_, i) => (
                  <div className="cellb" key={i}>
                    <span className="spinner" />
                  </div>
                ))}
              </div>
              <div className="info">
                <div className="t-eyebrow">Step 3 of 4</div>
                <h2 className="t-section">Six photos of the same person</h2>
                <p className="t-small muted">
                  A front portrait, both three-quarter views, a profile, and two full-length photos. Every shoot uses this sheet to keep the
                  same face and body.
                </p>
                {m?.faceOptions[0] && (
                  <div className="row" style={{ ["--gap" as string]: "10px" }}>
                    <img
                      src={m.faceOptions[0].url}
                      alt="Chosen face"
                      style={{
                        width: 56,
                        aspectRatio: "3/4",
                        objectFit: "cover",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--line)",
                      }}
                    />
                    <span className="t-small">Made from the face you picked</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === "ready" && m && (
          <div className="mcol" style={{ maxWidth: 1000 }}>
            <div className="ready-page">
              <SheetBox url={m.sheetUrl} />
              <div className="info">
                <div>
                  <span className="badge success dot">Checked, ready to use</span>
                  <h1 className="t-page mt-3" style={{ fontSize: "var(--text-3xl)" }}>
                    Meet your model
                  </h1>
                  <p className="t-small muted mt-2">
                    Six photos of one person. Check the face and body look the way you want before you use it.
                  </p>
                </div>
                <ReadyName m={m} />
                {err && <Notice tone="danger">{err}</Notice>}
                <div className="stack" style={{ ["--gap" as string]: "8px" }}>
                  <Link className="btn btn-primary btn-lg btn-block" to={`/models/${m.id}`}>
                    <Icon name="check" />
                    Use this model
                  </Link>
                  <button
                    className="btn btn-secondary btn-lg btn-block"
                    disabled={busy}
                    onClick={async () => {
                      if (!api) return;
                      setBusy(true);
                      setErr(null);
                      try {
                        await api.remakeSheet(m.id);
                        model.reload();
                      } catch (e) {
                        setErr(messageOf(e));
                      }
                      setBusy(false);
                    }}
                  >
                    <Icon name="refresh" />
                    Make it again<span className="cost">{about(ESTIMATE_USD.sheet)}</span>
                  </button>
                </div>
                <p className="t-caption">
                  Make it again any time; each try is billed by OpenAI. Your earlier sheet is kept until you choose.
                </p>
                <div className="divider" />
                <span className="local-note">
                  <Icon name="lock" />
                  Saved on this computer. Only you can use it.
                </span>
              </div>
            </div>
          </div>
        )}

        {view === "failed" && (
          <div className="mcol" style={{ maxWidth: 640 }}>
            {!m ? (
              <LoadError onRetry={model.reload}>We couldn't open this model.</LoadError>
            ) : (
              <>
                <Notice tone="danger" icon="alert">
                  The reference sheet couldn't be made. If OpenAI refused it, nothing was billed.
                </Notice>
                {err && <FieldError>{err}</FieldError>}
                <div className="row wrap">
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={async () => {
                      if (!api) return;
                      setBusy(true);
                      setErr(null);
                      try {
                        await api.remakeSheet(m.id);
                        model.reload();
                      } catch (e) {
                        setErr(messageOf(e));
                      }
                      setBusy(false);
                    }}
                  >
                    <Icon name="refresh" />
                    Try again<span className="cost">{about(ESTIMATE_USD.sheet)}</span>
                  </button>
                  <Link className="btn btn-secondary" to="/library/models">
                    Back to Library
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {(view === "start" || view === "photos") && (
        <div className="actionbar">
          <div className="summary">
            <div className="txt">
              {view === "start" && (
                <>
                  <b>3 face options, then a reference sheet</b>
                  <span>Nothing is made until you press the button</span>
                </>
              )}
              {view === "photos" && !refused && (
                <>
                  <b>Add a clear face photo and tick the box to go on</b>
                  <span>Nothing is made until you press the button</span>
                </>
              )}
              {view === "photos" && refused && (
                <>
                  <b>Choose another face photo to go on</b>
                  <span>The first one wasn't used and wasn't billed</span>
                </>
              )}
            </div>
          </div>
          <Link className="btn btn-ghost" to="/library/models">
            Cancel
            <span className="kbd" style={{ marginLeft: 6 }}>
              Esc
            </span>
          </Link>
          {view === "start" ? (
            <button className="btn btn-primary btn-lg" disabled={!canWords} onClick={createWords}>
              <Icon name="sparkle" />
              {busy ? "Starting" : "Show me 3 faces"}
              <span className="cost">{about(wordsCost)}</span>
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" disabled={!canPhotos} onClick={createPhotos}>
              <Icon name="sparkle" />
              {busy ? "Checking the photos" : "Make my model"}
              <span className="cost">{about(photosCost)}</span>
            </button>
          )}
        </div>
      )}
      {big && (
        <Dialog
          onClose={() => setBig(null)}
          size="lg"
          title="Face"
          footer={
            <button className="btn btn-secondary" onClick={() => setBig(null)}>
              Close
            </button>
          }
        >
          <img src={big} alt="" style={{ width: "100%", maxHeight: "64vh", objectFit: "contain", borderRadius: "var(--r-md)" }} />
        </Dialog>
      )}
    </>
  );
}

const usd0 = (n: number) => `$${n.toFixed(2)}`;

function ReadyName({ m }: { m: OwnModel }) {
  const api = useApi();
  const [v, setV] = useState(m.name);
  useEffect(() => setV(m.name), [m.name]);
  return (
    <div className="field">
      <label className="label" htmlFor="nm3">
        Name <span className="opt">(only you see it)</span>
      </label>
      <input
        className="input"
        id="nm3"
        value={v}
        maxLength={40}
        onChange={(e) => setV(e.target.value)}
        onBlur={async () => {
          const t = v.trim();
          if (api && t && t !== m.name) {
            try {
              await api.renameOwnModel(m.id, t);
            } catch {
              setV(m.name);
            }
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export function ModelScreen() {
  const { id } = useParams();
  const api = useApi();
  const nav = useNavigate();
  const model = useLoad((a) => a.ownModel(id!), [id], ["own"]);
  const m = model.data;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [del, setDel] = useState(false);
  // A new sheet is billed and can change the model's look: it asks first.
  const [remake, setRemake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const os = useOs();

  useEffect(() => {
    if (renaming) {
      input.current?.focus();
      input.current?.select();
    }
  }, [renaming]);

  async function saveName() {
    setRenaming(false);
    const t = draft.trim();
    if (!api || !m || !t || t === m.name) return;
    try {
      await api.renameOwnModel(m.id, t);
      model.reload();
    } catch (e) {
      setErr(messageOf(e));
    }
  }
  async function remove() {
    if (!api || !m) return;
    setBusy(true);
    try {
      await api.deleteOwnModel(m.id);
      toast("Model deleted.");
      void nav("/library/models", { replace: true });
    } catch (e) {
      setErr(messageOf(e));
      setDel(false);
      setBusy(false);
    }
  }

  if (model.loading && !m) {
    return (
      <>
        <header className="topbar">
          <Skeleton height={20} width={240} />
        </header>
        <div className="page">
          <Skeleton height={44} width={260} />
          <div className="own-page">
            <Skeleton height={480} />
            <Skeleton height={320} />
          </div>
        </div>
      </>
    );
  }
  if (model.error && !m)
    return (
      <>
        <header className="topbar">
          <Link className="btn btn-ghost btn-icon" to="/library/models" aria-label="Back to Library">
            <Icon name="left" />
          </Link>
        </header>
        <div className="page">
          <LoadError onRetry={model.reload}>We couldn't open this model.</LoadError>
        </div>
      </>
    );
  if (!m) {
    return (
      <>
        <header className="topbar">
          <Link className="btn btn-ghost btn-icon" to="/library/models" aria-label="Back to Library">
            <Icon name="left" />
          </Link>
        </header>
        <div className="page">
          <div className="empty">
            <span className="art">
              <Icon name="user" />
            </span>
            <h2 className="t-section">This model isn't here any more</h2>
            <p>It may have been deleted.</p>
            <Link className="btn btn-primary" to="/library/models">
              Back to Library
            </Link>
          </div>
        </div>
      </>
    );
  }

  const ready = m.status === "ready";
  const badge = ready ? (
    <span className="badge success dot">Ready to use</span>
  ) : m.status === "failed" ? (
    <span className="badge danger dot">Didn't work</span>
  ) : m.status === "choosing-face" ? (
    <span className="badge warning dot">Pick a face</span>
  ) : (
    <span className="badge info dot">Making</span>
  );
  const gender = m.gender === "woman" ? "Woman" : m.gender === "man" ? "Man" : humanize(m.gender);
  const lede = [gender, m.age, humanize(m.look), `made on ${fmtDate(m.createdAt)}`].filter(Boolean).join(" · ");

  return (
    <>
      <header className="topbar" data-tauri-drag-region>
        <Link className="btn btn-ghost btn-icon" to="/library/models" aria-label="Back to Library">
          <Icon name="left" />
        </Link>
        <div className="crumbs">
          <Link to="/library">Library</Link>
          <span className="sep">/</span>
          <Link to="/library/models">Models</Link>
          <span className="sep">/</span>
          <span className="here">{m.name}</span>
        </div>
      </header>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="titlerow">
              {renaming ? (
                <input
                  ref={input}
                  className="input name-input"
                  value={draft}
                  aria-label="Model name"
                  maxLength={40}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                />
              ) : (
                <h1 className="t-page">{m.name}</h1>
              )}
              {badge}
            </div>
            <p className="lede">{lede}</p>
          </div>
          <div className="page-tools">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setDraft(m.name);
                setRenaming(true);
              }}
            >
              <Icon name="edit" />
              Rename
            </button>
            <button className="btn btn-danger-ghost" onClick={() => setDel(true)}>
              <Icon name="trash" />
              Delete model
            </button>
          </div>
        </div>
        {err && (
          <Notice tone="danger" style={{ marginBottom: "var(--s-4)" }}>
            {err}
          </Notice>
        )}
        {!ready && m.status !== "failed" && (
          <Note
            tone="info"
            style={{ marginBottom: "var(--s-4)" }}
            action={
              <Link className="btn btn-secondary btn-sm" to={`/models/new?m=${m.id}`}>
                {m.status === "choosing-face" ? "Pick a face" : "See progress"}
              </Link>
            }
          >
            {m.status === "choosing-face" ? "Pick a face to finish this model." : "The reference sheet is being made."}
          </Note>
        )}
        {m.status === "failed" && (
          <Note
            tone="danger"
            style={{ marginBottom: "var(--s-4)" }}
            action={
              <Link className="btn btn-secondary btn-sm" to={`/models/new?m=${m.id}`}>
                Try again
              </Link>
            }
          >
            The reference sheet couldn't be made. If OpenAI refused it, nothing was billed.
          </Note>
        )}

        <div className="own-page">
          <SheetBox url={m.sheetUrl} name={m.name} />
          <div className="side">
            <div className="stack" style={{ ["--gap" as string]: "8px" }}>
              <h2 className="t-section">Reference sheet</h2>
              <p className="t-small muted">Six photos of one person. Every shoot uses this sheet to keep the same face and body.</p>
            </div>
            <div className="card pad" style={{ paddingTop: "var(--s-2)", paddingBottom: "var(--s-2)" }}>
              <div className="list kv">
                <div className="list-item">
                  <span className="k">Made from</span>
                  <span className="v">{m.madeFrom === "photos" ? "Photos of a real person" : "A description"}</span>
                </div>
                {m.look && (
                  <div className="list-item">
                    <span className="k">Look</span>
                    <span className="v">{humanize(m.look)}</span>
                  </div>
                )}
                {m.body && (
                  <div className="list-item">
                    <span className="k">Body</span>
                    <span className="v">{humanize(m.body)}</span>
                  </div>
                )}
                {m.appearance && (
                  <div className="list-item">
                    <span className="k">Appearance</span>
                    <span className="v">{m.appearance}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="actions">
              <Link
                className={`btn btn-primary btn-lg${ready ? "" : " is-disabled"}`}
                to="/create/new"
                state={{ model: { source: "own", id: m.id } }}
              >
                <Icon name="plus" />
                New shoot with this model
              </Link>
              <div className="row" style={{ ["--gap" as string]: "8px" }}>
                <button
                  className="btn btn-secondary grow"
                  disabled={!m.sheetPath}
                  onClick={() => m.sheetPath && api?.showInFolder(m.sheetPath)}
                >
                  <Icon name="folder" />
                  {os.showInFolder}
                </button>
                <button className="btn btn-secondary grow" disabled={!ready || busy} onClick={() => setRemake(true)}>
                  <Icon name="refresh" />
                  New sheet<span className="cost">{about(ESTIMATE_USD.sheet)}</span>
                </button>
              </div>
            </div>
            <span className="local-note">
              <Icon name="lock" />
              Only on this computer. Poses made with this model stay private.
            </span>
          </div>
        </div>
      </div>
      {remake && (
        <ConfirmDialog
          title="Make a new reference sheet?"
          description={`${m.name}'s six photos are made again from the same face or photos, so the look may change a little. OpenAI bills about ${usd0(ESTIMATE_USD.sheet)}.`}
          confirmLabel="Make a new sheet"
          onClose={() => setRemake(false)}
          onConfirm={async () => {
            setRemake(false);
            if (!api) return;
            setBusy(true);
            setErr(null);
            try {
              await api.remakeSheet(m.id);
              model.reload();
            } catch (e) {
              setErr(messageOf(e));
            }
            setBusy(false);
          }}
        />
      )}
      {del && (
        <Dialog
          alert
          hideClose
          plainFoot
          size="sm"
          onClose={() => setDel(false)}
          icon="trash"
          iconTone="danger"
          title={`Delete ${m.name}?`}
          description="Its sheet and photos are deleted from this computer. Photos you already made stay."
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDel(false)}>
                Keep it
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={remove}>
                <Icon name="trash" />
                Delete model
              </button>
            </>
          }
        />
      )}
    </>
  );
}
