import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../../lib/api";
import { ESTIMATE_USD, type Photo, type Shoot } from "../../../lib/contract";
import {
  Cost,
  EmptyState,
  Icon,
  LoadError,
  MoreOnAaina,
  SearchBox,
  SkeletonGrid,
  Topbar,
  formatAgo,
  KIND_LABEL,
  toast,
} from "../../components";
import { useLoad, useStartShoot } from "../../hooks";
import { CatalogDownloadCard } from "../states";
import modeModel from "../../assets/mode-model.webp";
import modeGhost from "../../assets/mode-ghost.webp";
import modeFlatlay from "../../assets/mode-flatlay.webp";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
const STEP_NAME = { product: "Product", model: "Model", poses: "Poses", scene: "Scene", review: "Review" } as const;

export function HomeScreen() {
  const navigate = useNavigate();
  const start = useStartShoot();
  const [q, setQ] = useState("");
  const shoots = useLoad((a) => a.shoots(), [], ["shoot"]);
  const products = useLoad((a) => a.products(), [], ["shoot"]);
  const recent = useLoad((a) => a.recentPhotos(6), [], ["photo"]);
  const catalog = useLoad((a) => a.catalogStatus(), [], ["catalog"]);
  const photosOf = useLoad(
    async (a) => {
      const list = (shoots.data ?? []).filter((s) => s.status === "making").slice(0, 3);
      const out: Record<string, Photo[]> = {};
      await Promise.all(list.map(async (s) => (out[s.id] = await a.photos(s.id))));
      return out;
    },
    [(shoots.data ?? []).map((s) => s.id + s.status).join(",")],
    ["photo"],
  );

  const list = shoots.data ?? [];
  const first = !shoots.loading && !shoots.error && list.length === 0;
  const cont = [
    ...list.filter((s) => s.status === "making"),
    ...list.filter((s) => s.status === "draft"),
    ...list.filter((s) => s.status === "done"),
  ].slice(0, 3);

  async function choose() {
    const files = await (await api()).pickFiles({ multiple: true });
    if (files.length) start(files);
  }
  async function fromProduct(productId: string) {
    try {
      const s = await (await api()).createShoot({ kind: "model", productId });
      void navigate(`/create/${s.id}/model`);
    } catch {
      toast("We couldn't start that shoot. Try again.", { icon: "alert" });
    }
  }

  return (
    <>
      <Topbar crumbs={["Home"]}>
        <SearchBox
          value={q}
          onChange={setQ}
          onSubmit={() => navigate(`/shoots${q ? `?q=${encodeURIComponent(q)}` : ""}`)}
          placeholder="Search shoots, products, models"
          width="min(360px,40vw)"
        />
      </Topbar>
      <div className="page">
        {catalog.data && (catalog.data.state === "loading" || catalog.data.state === "never-loaded") && (
          <div style={{ marginBottom: "var(--s-5)" }}>
            <CatalogDownloadCard status={catalog.data} />
          </div>
        )}

        <section className="hero">
          <div className="hero-copy">
            <span className="t-eyebrow">{greeting()}</span>
            <h1 className="t-display">
              What are we <em className="italic">shooting</em> today?
            </h1>
            <p className="muted" style={{ maxWidth: "46ch" }}>
              Add a product photo and choose a model, poses and a scene. Everything is made and kept on this computer.
            </p>
            {!first && (products.data?.length ?? 0) > 0 && (
              <div className="recent-products">
                <span className="t-caption" style={{ marginRight: 4 }}>
                  Recent products
                </span>
                {products.data!.slice(0, 2).map((p) => (
                  <button key={p.id} className="prod" onClick={() => fromProduct(p.id)}>
                    {p.photos[0] && <img src={p.photos[0].url} alt="" />}
                    {p.name}
                  </button>
                ))}
                <Link className="btn btn-link t-small nowrap" to="/library/products" style={{ marginLeft: 4 }}>
                  All products
                </Link>
              </div>
            )}
            {first && (
              <span className="local-note">
                <Icon name="lock" />
                Your photos never leave this computer, except to OpenAI while a photo is made.
              </span>
            )}
          </div>
          <button className="drop" onClick={choose}>
            <span className="ico-ring">
              <Icon name="upload" size="lg" />
            </span>
            <span className="t-title">Drop a product photo</span>
            <span className="t-small muted">
              or <u>choose from your files</u>. Front, back and close-ups all help.
            </span>
            <span className="t-caption">JPG, PNG or WebP · up to 6 photos</span>
          </button>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="t-section">Make product photos</h2>
              <p className="t-caption mt-1">For your store and marketplace listings</p>
            </div>
          </div>
          <div className="modes">
            <Link className="mode" to="/create/new">
              <div className="media">
                <img src={modeModel} alt="" />
              </div>
              <div className="body">
                <span className="t">On a model</span>
                <span className="d">Your product on a studio model or your own, in the poses and scenes you pick</span>
                <Cost className="price" usd={ESTIMATE_USD.photo.standard} unit="a photo" />
              </div>
            </Link>
            <Link className="mode" to="/create/new" state={{ kind: "ghost" }}>
              <div className="media">
                <img src={modeGhost} alt="" />
              </div>
              <div className="body">
                <span className="t">Ghost mannequin</span>
                <span className="d">The garment alone, in its worn 3D shape, on white</span>
                <Cost className="price" usd={ESTIMATE_USD.photo.standard} unit="an angle" />
              </div>
            </Link>
            <Link className="mode" to="/create/new" state={{ kind: "flat-lay" }}>
              <div className="media">
                <img src={modeFlatlay} alt="" />
              </div>
              <div className="body">
                <span className="t">Flat-lay</span>
                <span className="d">Laid flat and shot from above: clean, folded or styled</span>
                <Cost className="price" usd={ESTIMATE_USD.photo.standard} unit="a style" />
              </div>
            </Link>
          </div>
        </section>

        {shoots.error && (
          <section className="section">
            <LoadError onRetry={shoots.reload}>We couldn't read your shoots from this computer.</LoadError>
          </section>
        )}

        {shoots.loading && !shoots.data && (
          <section className="section">
            <div className="section-head">
              <h2 className="t-section">Pick up where you left off</h2>
            </div>
            <SkeletonGrid count={3} cols={3} label="Loading shoots" />
          </section>
        )}

        {cont.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2 className="t-section">Pick up where you left off</h2>
              <Link className="link" to="/shoots">
                All shoots
              </Link>
            </div>
            <div className="continue">
              {cont.map((s) => (
                <ContinueCard key={s.id} s={s} photos={photosOf.data?.[s.id]} />
              ))}
            </div>
          </section>
        )}

        {(recent.data?.length ?? 0) > 0 && (
          <section className="section">
            <div className="section-head">
              <h2 className="t-section">Recent photos</h2>
              <Link className="link" to="/shoots">
                All shoots
              </Link>
            </div>
            <div className="grid c6">
              {recent.data!.map((p) => (
                <Link key={p.id} className={"tile" + (p.shot.kind === "ghost" ? " contain" : "")} to={`/photo/${p.id}?shoot=${p.shootId}`}>
                  <div className="media">{p.url && <img src={p.url} alt={p.title} loading="lazy" />}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {recent.loading && !recent.data && (
          <section className="section">
            <div className="section-head">
              <h2 className="t-section">Recent photos</h2>
            </div>
            <SkeletonGrid count={6} cols={6} label="Loading photos" />
          </section>
        )}

        {first && (
          <section className="section">
            <div className="section-head">
              <h2 className="t-section">How it works</h2>
            </div>
            <div className="continue">
              <div className="cont">
                <span className="th" style={{ display: "grid", placeItems: "center" }}>
                  <Icon name="upload" />
                </span>
                <span className="grow">
                  <span className="t-small" style={{ fontWeight: 600, display: "block" }}>
                    1. Add your product
                  </span>
                  <span className="t-caption">A clear photo on any background</span>
                </span>
              </div>
              <div className="cont">
                <span className="th" style={{ display: "grid", placeItems: "center" }}>
                  <Icon name="user" />
                </span>
                <span className="grow">
                  <span className="t-small" style={{ fontWeight: 600, display: "block" }}>
                    2. Pick a model, poses and a scene
                  </span>
                  <span className="t-caption">
                    {catalog.data?.modelCount ? `${catalog.data.modelCount} studio models, ready to use` : "Studio models, ready to use"}
                  </span>
                </span>
              </div>
              <div className="cont">
                <span className="th" style={{ display: "grid", placeItems: "center" }}>
                  <Icon name="images" />
                </span>
                <span className="grow">
                  <span className="t-small" style={{ fontWeight: 600, display: "block" }}>
                    3. Make your photos
                  </span>
                  <span className="t-caption">About a minute each, saved here</span>
                </span>
              </div>
            </div>
          </section>
        )}
        {first && (
          <section className="section">
            <EmptyState icon="images" title="No shoots yet" compact>
              Your first shoot will show up here.
            </EmptyState>
          </section>
        )}

        <section className="section">
          <MoreOnAaina />
        </section>
      </div>
    </>
  );
}

function ContinueCard({ s, photos }: { s: Shoot; photos?: Photo[] }) {
  const making = s.status === "making";
  const draft = s.status === "draft";
  const ready = photos ? new Set(photos.filter((p) => p.status === "done").map((p) => p.shotKey)).size : s.photoCount;
  const total = photos ? new Set(photos.map((p) => p.shotKey)).size : s.plan.length;
  const to = draft ? `/create/${s.id}/${s.draftStep ?? "model"}` : `/shoots/${s.id}`;
  const pct = total ? Math.max(8, Math.round((ready / total) * 100)) : 10;
  return (
    <Link className="cont" to={to}>
      <span className="th">
        {s.coverUrl && <img src={s.coverUrl} alt="" />}
        {making && (
          <span className="making" style={{ padding: 4 }}>
            <span className="progress" style={{ width: "80%" }}>
              <i style={{ "--p": `${pct}%` } as React.CSSProperties} />
            </span>
          </span>
        )}
      </span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="t-small" style={{ fontWeight: 600, display: "block" }}>
          {s.name}
        </span>
        <span className="t-caption">
          {draft
            ? `Draft · ${s.draftStep ? STEP_NAME[s.draftStep] + " next" : "not finished"} · ${formatAgo(s.updatedAt)}`
            : making
              ? `${KIND_LABEL[s.kind]} · ${ready} of ${total} photos ready`
              : `${KIND_LABEL[s.kind]} · ${s.photoCount} ${s.photoCount === 1 ? "photo" : "photos"} · ${formatAgo(s.updatedAt)}`}
        </span>
      </span>
      {making ? <span className="badge info dot">Making</span> : <Icon name="chev" size="sm" className="subtle" />}
    </Link>
  );
}
