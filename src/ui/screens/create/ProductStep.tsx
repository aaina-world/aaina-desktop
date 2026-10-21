import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { ModelRef, PhotoRole, PoseRef, Product, ProductReading, SceneRef, ShootKind } from "../../../lib/contract";
import { Dialog } from "../../components/Dialog";
import { Notice } from "../../components/Notice";
import { SkeletonGrid } from "../../components/controls";
import { COLOUR_NAMES } from "./colourNames";
import type { CreateData } from "./data";
import type { useDraft } from "./draft";
import { BarSummary, Flow, KIND_LABEL, PriceCard, SumRow, reachable, stepPath } from "./flow";
import { Icon, Note, fmtDate, messageOf, plural, useApi, useLoad } from "./kit";

type Draft = ReturnType<typeof useDraft>;
export type StartState = { paths?: string[]; model?: ModelRef; pose?: PoseRef; scene?: SceneRef } | null;

const ROLES: { value: PhotoRole; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "detail", label: "Close-up" },
];
const AUDIENCE: { value: NonNullable<ProductReading["audience"]>; label: string }[] = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "unisex", label: "Everyone" },
  { value: "girls", label: "Girls" },
  { value: "boys", label: "Boys" },
  { value: "babies", label: "Babies" },
];

export function nextStepFor(kind: ShootKind) {
  return kind === "flat-lay" ? "styles" : kind === "ghost" ? "angles" : "model";
}
export function draftStepFor(step: string): "product" | "model" | "poses" | "scene" | "review" {
  return step === "styles" || step === "angles" ? "poses" : (step as "product" | "model" | "poses" | "scene" | "review");
}

function colourHex(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  const exact = COLOUR_NAMES.find(([c]) => c.toLowerCase() === n);
  if (exact) return exact[1];
  const part = COLOUR_NAMES.filter(([c]) => n.includes(c.toLowerCase())).sort((a, b) => b[0].length - a[0].length)[0];
  return part ? part[1] : null;
}

export function ProductStep({ draft, data, start }: { draft: Draft; data: CreateData; start: StartState }) {
  const api = useApi();
  const nav = useNavigate();
  const { shoot, product } = draft;
  const [kind, setKind] = useState<ShootKind>(shoot?.kind ?? "model");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [past, setPast] = useState(false);
  const [over, setOver] = useState(false);
  const startedFrom = useRef<unknown>(null);

  useEffect(() => {
    if (shoot) setKind(shoot.kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are deliberate: run when the identity changes, not on every field
  }, [shoot?.id, shoot?.kind]);

  async function begin(productId: string) {
    if (!api) return;
    const s = await api.createShoot({ kind, productId });
    if (kind === "model" && (start?.model || start?.scene)) {
      await api.updateShoot(s.id, {
        draftStep: "product",
        ...(start.model ? { model: start.model } : {}),
        ...(start.scene ? { scene: start.scene } : {}),
        ...(start.pose && start.model
          ? { plan: [{ kind: "model" as const, pose: start.pose, frame: "as-posed" as const, expression: "as-posed" as const }] }
          : {}),
      });
    }
    void nav(stepPath(s.id, "product"), { replace: true });
  }

  async function addPaths(paths: string[]) {
    if (!api || !paths.length) return;
    setBusy(true);
    setErr(null);
    try {
      if (!product) {
        const files = paths.slice(0, 6).map((path, i): { path: string; role: PhotoRole } => ({ path, role: i === 0 ? "front" : "detail" }));
        const p = await api.createProduct(files);
        await begin(p.id);
      } else {
        const room = 6 - product.photos.length;
        if (room <= 0) return;
        const p = await api.addProductPhotos(
          product.id,
          paths.slice(0, room).map((path) => ({ path, role: "detail" })),
        );
        draft.setProduct(p);
      }
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function choose() {
    if (!api) return;
    const paths = await api.pickFiles({ multiple: true });
    await addPaths(paths);
  }

  // Photos dropped on the window arrive as router state.
  useEffect(() => {
    if (!api || !start?.paths?.length || startedFrom.current === start) return;
    startedFrom.current = start;
    void addPaths(start.paths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, start]);

  async function changeKind(k: ShootKind) {
    setKind(k);
    if (!shoot || !product || !api || shoot.kind === k) return;
    // A draft's kind is fixed when it is made, so the same product starts a new draft of the other kind.
    try {
      const s = await api.createShoot({ kind: k, productId: product.id });
      await api.deleteShoot(shoot.id).catch(() => {});
      void nav(stepPath(s.id, "product"), { replace: true });
    } catch (e) {
      setErr(messageOf(e));
      setKind(shoot.kind);
    }
  }

  async function updatePhotos(photos: { id: string; role: PhotoRole }[]) {
    if (!api || !product) return;
    try {
      draft.setProduct(await api.updateProduct(product.id, { photos }));
    } catch (e) {
      setErr(messageOf(e));
    }
  }

  const photos = product?.photos ?? [];
  const canNext = photos.length > 0 && !busy;
  const reach = reachable(shoot, photos.length > 0);
  const front = photos.find((p) => p.role === "front") ?? photos[0];
  const reading = product?.reading ?? null;
  const label = reading?.label ?? "";
  const name = product?.name || "Your product";

  const frame = (
    <Flow
      kind={kind}
      current="product"
      shootId={shoot?.id}
      reach={reach}
      crumb="Add your product"
      back="/"
      saving={draft.saving}
      saveError={draft.saveError}
      aside={
        <div className="stack" style={{ ["--gap" as string]: "var(--s-4)" }}>
          <div className="card summary-card">
            {front ? (
              <SumRow k="Product" v={name} img={front.url} contain onEdit={() => nav("/create/new")} edit="Replace" />
            ) : (
              <SumRow k="Product" v="Add photos" icon="shirt" subtle />
            )}
            {kind === "model" && (
              <>
                {data.modelInfo ? (
                  // Chosen already (New shoot with this model, or an earlier visit to the Model step).
                  <SumRow
                    k="Model"
                    v={[data.modelInfo.name, data.modelInfo.age].filter(Boolean).join(" · ")}
                    img={data.modelInfo.img}
                    sheet={data.modelInfo.sheet}
                    to={stepPath(shoot?.id, "model")}
                  />
                ) : (
                  <SumRow k="Model" v="Next step" icon="user" subtle />
                )}
                <SumRow k="Poses" v="Next step" icon="people" subtle />
                <SumRow k="Scene" v="Next step" icon="picture" subtle />
              </>
            )}
            {kind === "flat-lay" && <SumRow k="Styles" v="Next step" icon="flatlay" subtle />}
            {kind === "ghost" && <SumRow k="Angles" v="Next step" icon="hanger" subtle />}
          </div>
          <PriceCard quality={shoot?.quality ?? "standard"} count={0}>
            {kind === "model"
              ? "Pick poses and a scene next. Billed by OpenAI to your key. Nothing is sent until you press Make."
              : "Pick what to make next. Billed by OpenAI to your key. Nothing is sent until you press Make."}
          </PriceCard>
        </div>
      }
      bar={
        <>
          {front ? (
            <BarSummary
              thumbs={[front.url]}
              contain
              title={name}
              sub={[plural(photos.length, "photo"), label, reading?.colour].filter(Boolean).join(" · ") || "details to fill in"}
            />
          ) : (
            <div className="summary">
              <div className="txt">
                <b>Add a product photo</b>
                <span className="num">to continue</span>
              </div>
            </div>
          )}
          {canNext && shoot ? (
            <Link className="btn btn-primary" to={stepPath(shoot.id, nextStepFor(shoot.kind))}>
              Next: {nextStepFor(shoot.kind) === "model" ? "model" : nextStepFor(shoot.kind)} <Icon name="right" />
            </Link>
          ) : (
            <button className="btn btn-primary" disabled>
              Next: {nextStepFor(kind) === "model" ? "model" : nextStepFor(kind)} <Icon name="right" />
            </button>
          )}
        </>
      }
    >
      <div className="page-head" style={{ marginBottom: "var(--s-5)" }}>
        <div>
          <span className="t-eyebrow">New shoot</span>
          <h1 className="t-page mt-2">
            Add your <em className="italic">product</em>
          </h1>
          <p className="lede">One clear photo is enough. Add the back or a close-up for a better result.</p>
        </div>
        <div className="modebar">
          <span className="t-eyebrow">What are you making?</span>
          <div className="segmented" role="tablist" aria-label="What are you making?">
            {(["model", "ghost", "flat-lay"] as ShootKind[]).map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} onClick={() => changeKind(k)}>
                <Icon name={k === "model" ? "user" : k === "ghost" ? "hanger" : "flatlay"} size="sm" />
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {err && (
        <Notice tone="danger" style={{ marginBottom: "var(--s-4)" }}>
          {err}
        </Notice>
      )}
      {!product ? (
        <>
          <div
            className={`drop${over ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
            }}
          >
            <span className="ico-ring">
              <Icon name="upload" size="lg" />
            </span>
            <h2 className="t-section">Drop product photos here</h2>
            <p className="t-body muted" style={{ maxWidth: "44ch" }}>
              Drag them in from your files, anywhere in this window, or choose them. JPG, PNG or WebP, up to 6 photos.
            </p>
            <div className="row wrap" style={{ justifyContent: "center", marginTop: 6 }}>
              <button className="btn btn-primary btn-lg" onClick={choose} disabled={busy}>
                <Icon name="upload" />
                {busy ? "Adding" : "Choose photos"}
              </button>
            </div>
            <div className="row" style={{ ["--gap" as string]: "16px", marginTop: 6 }}>
              <button className="btn btn-link t-small" onClick={() => setPast(true)}>
                Use a past product
              </button>
              <span className="vr" style={{ height: 14 }} />
              <span className="local-note">
                <Icon name="lock" />
                Photos stay on this computer
              </span>
            </div>
          </div>
          <div className="tips3">
            <div className="card tip">
              <span className="ico-ring">
                <Icon name="shirt" size="sm" />
              </span>
              <div>
                <div className="t-small" style={{ fontWeight: 600 }}>
                  Whole product in view
                </div>
                <div className="t-caption">Lay it flat or hang it, nothing cut off.</div>
              </div>
            </div>
            <div className="card tip">
              <span className="ico-ring">
                <Icon name="sun" size="sm" />
              </span>
              <div>
                <div className="t-small" style={{ fontWeight: 600 }}>
                  Even light
                </div>
                <div className="t-caption">Plain background, no strong shadows.</div>
              </div>
            </div>
            <div className="card tip">
              <span className="ico-ring">
                <Icon name="copy" size="sm" />
              </span>
              <div>
                <div className="t-small" style={{ fontWeight: 600 }}>
                  Add the back
                </div>
                <div className="t-caption">If there is a print on the back, show it.</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="stack" style={{ ["--gap" as string]: "var(--s-4)" }}>
          <div className="photos">
            {photos.map((p) => (
              <div className="tile" key={p.id}>
                <div className="media">
                  <img src={p.url} alt={`${name}, ${ROLES.find((r) => r.value === p.role)?.label.toLowerCase()}`} />
                  {photos.length > 1 && (
                    <span className="over-tr">
                      <button
                        className="icon-btn-glass hover-only"
                        title="Remove"
                        aria-label="Remove photo"
                        style={{ width: 28, height: 28 }}
                        onClick={() => updatePhotos(photos.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, role: x.role })))}
                      >
                        <Icon name="x" />
                      </button>
                    </span>
                  )}
                </div>
                <div className="roles" data-single>
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      className="chip"
                      aria-pressed={p.role === r.value}
                      onClick={() => updatePhotos(photos.map((x) => ({ id: x.id, role: x.id === p.id ? r.value : x.role })))}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {photos.length < 6 && (
              <button className="tile add" onClick={choose} disabled={busy}>
                <div className="media">
                  <div>
                    <span className="plus-disc">
                      <Icon name="plus" />
                    </span>
                    <div className="t-caption">{busy ? "Adding" : "Add a photo"}</div>
                  </div>
                </div>
              </button>
            )}
          </div>
          <p className="t-caption mt-3">You can also drag photos in from your files, anywhere in this window. Up to 6 photos.</p>
          <NameCard
            product={product}
            onSaved={(p) => {
              draft.setProduct(p);
              // The shoot is named after the product until the person renames it: keep following a renamed product.
              if (draft.shoot && draft.shoot.name === product.name) draft.patch({ name: p.name });
            }}
          />
          <ReadingCard product={product} data={data} onChanged={draft.setProduct} />
        </div>
      )}
      {past && (
        <PastProduct
          onClose={() => setPast(false)}
          onUse={async (id) => {
            setPast(false);
            setBusy(true);
            try {
              await begin(id);
            } catch (e) {
              setErr(messageOf(e));
              setBusy(false);
            }
          }}
        />
      )}
    </Flow>
  );
  return frame;
}

function NameCard({ product, onSaved }: { product: Product; onSaved: (p: Product) => void }) {
  const api = useApi();
  const [v, setV] = useState(product.name);
  useEffect(() => setV(product.name), [product.id, product.name]);
  const save = async () => {
    const t = v.trim();
    if (!api || !t || t === product.name) return;
    try {
      onSaved(await api.updateProduct(product.id, { name: t }));
    } catch {
      /* shown by the draft's Saved caption on the next change */
    }
  };
  return (
    <div className="card block">
      <div className="field">
        <label className="label" htmlFor="pname">
          Product name
        </label>
        <input
          className="input"
          id="pname"
          value={v}
          placeholder="e.g. Cobalt T-shirt"
          onChange={(e) => setV(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </div>
  );
}

function ReadingCard({ product, data, onChanged }: { product: Product; data: CreateData; onChanged: (p: Product) => void }) {
  const api = useApi();
  const canRead = data.conn?.canRead;
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const tried = useRef<string>("");
  const r = product.reading;

  const read = async () => {
    if (!api) return;
    setReading(true);
    setReadErr(null);
    try {
      await api.readProduct(product.id);
      const p = await api.product(product.id);
      if (p) onChanged(p);
    } catch (e) {
      setReadErr(messageOf(e));
    } finally {
      setReading(false);
    }
  };
  useEffect(() => {
    if (!api || r || !canRead || tried.current === product.id) return;
    tried.current = product.id;
    void read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, product.id, !!r, canRead]);

  const [f, setF] = useState({ label: r?.label ?? "", audience: r?.audience ?? "", colour: r?.colour ?? "", material: r?.material ?? "" });
  useEffect(
    () => setF({ label: r?.label ?? "", audience: r?.audience ?? "", colour: r?.colour ?? "", material: r?.material ?? "" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are deliberate: run when the identity changes, not on every field
    [r?.readAt, product.id],
  );
  const save = async (next = f) => {
    if (!api) return;
    const base: ProductReading = r ?? {
      productType: null,
      label: "",
      audience: null,
      colour: null,
      material: null,
      details: null,
      reach: null,
      readBy: "seller",
      readAt: new Date().toISOString(),
    };
    const merged: ProductReading = {
      ...base,
      label: next.label.trim(),
      audience: (next.audience || null) as ProductReading["audience"],
      colour: next.colour.trim() || null,
      material: next.material.trim() || null,
      readBy: r ? r.readBy : "seller",
    };
    if (JSON.stringify(merged) === JSON.stringify(base)) return;
    try {
      onChanged(await api.updateProduct(product.id, { reading: merged }));
    } catch {
      /* the next edit tries again */
    }
  };

  const hex = colourHex(f.colour);
  const readBy =
    r?.readBy === "chatgpt" ? "Read by ChatGPT" : r?.readBy === "key" ? "Read with your OpenAI key" : r ? "Filled in by you" : "";
  const waiting = reading;
  return (
    <div className="card block">
      <div className="block-head">
        <div>
          <h2 className="t-title">What we see</h2>
          <p className="t-caption mt-1">
            {r
              ? "Check it, or change anything that is wrong."
              : waiting
                ? ""
                : "Fill this in yourself. It helps us suggest poses and keep your product exact."}
          </p>
        </div>
        {r && readBy && (
          <span className="readby">
            <Icon name={r.readBy === "chatgpt" ? "chatgpt" : r.readBy === "key" ? "key" : "edit"} />
            {readBy}
          </span>
        )}
      </div>
      {!canRead && !r && data.conn && (
        <Note
          tone="warning"
          action={
            <Link className="btn btn-secondary btn-sm" to="/settings">
              Settings
            </Link>
          }
        >
          Connect OpenAI in Settings to read products and make photos. You can still look around.
        </Note>
      )}
      {readErr && (
        <Notice tone="danger" action={{ label: "Try again", onClick: read }}>
          We couldn't read your product. You can fill it in yourself.
        </Notice>
      )}
      {waiting && (
        <>
          <div className="reading-line">
            <span className="spinner" />
            <span>Reading your product… usually 20 to 40 seconds</span>
          </div>
          <div className="progress">
            <i style={{ ["--p" as string]: "58%" }} />
          </div>
        </>
      )}
      <div className="fgrid">
        <div className="field">
          <label className="label" htmlFor="rd-type">
            Type
          </label>
          {waiting ? (
            <div className="skeleton sk-field" />
          ) : (
            <input
              className="input"
              id="rd-type"
              value={f.label}
              placeholder="e.g. T-shirt"
              onChange={(e) => setF({ ...f, label: e.target.value })}
              onBlur={() => save()}
            />
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="rd-for">
            Who it's for
          </label>
          {waiting ? (
            <div className="skeleton sk-field" />
          ) : (
            <select
              className="select"
              id="rd-for"
              value={f.audience}
              onChange={(e) => {
                const n = { ...f, audience: e.target.value };
                setF(n);
                void save(n);
              }}
            >
              <option value="">Choose…</option>
              {AUDIENCE.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="rd-colour">
            Colour
          </label>
          {waiting ? (
            <div className="skeleton sk-field" />
          ) : (
            <div className={`input-wrap ${hex ? "has-sw" : "no-sw"}`}>
              {hex && <span className="dot-sw" style={{ background: hex }} />}
              <input
                className="input"
                id="rd-colour"
                value={f.colour}
                placeholder="e.g. Cobalt blue"
                onChange={(e) => setF({ ...f, colour: e.target.value })}
                onBlur={() => save()}
              />
            </div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="rd-fabric">
            Fabric
          </label>
          {waiting ? (
            <div className="skeleton sk-field" />
          ) : (
            <input
              className="input"
              id="rd-fabric"
              value={f.material}
              placeholder="e.g. Cotton jersey"
              onChange={(e) => setF({ ...f, material: e.target.value })}
              onBlur={() => save()}
            />
          )}
        </div>
      </div>
      {r && canRead && !waiting && (
        <div>
          <button className="btn btn-link t-small" onClick={read}>
            Read my product again
          </button>
        </div>
      )}
    </div>
  );
}

function PastProduct({ onClose, onUse }: { onClose: () => void; onUse: (id: string) => void }) {
  const list = useLoad((a) => a.products(), []);
  const [pick, setPick] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const items = (list.data ?? []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog
      onClose={onClose}
      size="lg"
      title="Use a past product"
      description="Pick a product you have already added. Its photos and details come with it."
      footer={
        <>
          <span className="total">{pick ? "1 product picked" : "Pick a product"}</span>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!pick} onClick={() => pick && onUse(pick)}>
            Use this product
          </button>
        </>
      }
    >
      <label className="input-wrap search-wrap" style={{ marginBottom: "var(--s-4)" }}>
        <Icon name="search" />
        <input
          className="input search"
          placeholder="Search your products"
          aria-label="Search your products"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {list.loading ? (
        <SkeletonGrid count={6} cols={3} />
      ) : list.error ? (
        <Notice tone="danger" action={{ label: "Try again", onClick: list.reload }}>
          We couldn't load your products.
        </Notice>
      ) : items.length === 0 ? (
        <div className="empty" style={{ padding: "var(--s-10) var(--s-6)" }}>
          <span className="art">
            <Icon name="shirt" />
          </span>
          <h2 className="t-section">{q ? "No products found" : "No products yet"}</h2>
          <p>{q ? "Try another search." : "Products you add are kept here, so the next shoot starts in one click."}</p>
        </div>
      ) : (
        <div className="grid c3" data-single>
          {items.map((p) => (
            <button key={p.id} className="tile selectable contain" aria-selected={pick === p.id} onClick={() => setPick(p.id)}>
              <div className="media" style={{ ["--ratio" as string]: "1/1" }}>
                {p.photos[0] && <img src={p.photos[0].url} alt="" style={{ objectFit: "contain" }} loading="lazy" />}
                <span className="sel-mark">
                  <Icon name="check" size="sm" />
                </span>
              </div>
              <div className="cap">
                <div className="grow">
                  <div className="t">{p.name}</div>
                  <div className="m">{fmtDate(p.createdAt)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
