import { Link } from "react-router";
import { Icon } from "../../components";
import { EmptyState } from "../../components";
import type { CatalogStatus } from "../../../lib/contract";

/** Shown over the whole window while product photos are dragged onto it. */
export function DropOverlay() {
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="box">
        <span
          className="ico-ring"
          style={{
            margin: "0 auto 10px",
            width: 56,
            height: 56,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "var(--bg-sunken)",
          }}
        >
          <Icon name="upload" size="lg" />
        </span>
        <div className="t-title">Drop to start a new shoot</div>
        <div className="t-caption mt-1">JPG, PNG or WebP · up to 6 photos</div>
      </div>
    </div>
  );
}

/** First download of the catalogue (only on the first open, or after a long time). */
export function CatalogDownloadCard({ status }: { status: CatalogStatus }) {
  if (status.state !== "loading" && status.state !== "never-loaded") return null;
  const p = status.progress;
  const pct = p && p.total ? Math.round((p.done / p.total) * 100) : 8;
  return (
    <div
      className="dl"
      style={{
        width: "100%",
        flexDirection: "column",
        gap: 12,
        padding: "var(--s-4) var(--s-5)",
        background: "var(--bg-raised)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span className="t-small" style={{ fontWeight: 600 }}>
          Getting the studio catalogue
        </span>
        {p && (
          <span className="t-mono t-caption">
            {p.done} of {p.total} models
          </span>
        )}
      </div>
      <div className="progress">
        <i style={{ "--p": `${pct}%` } as React.CSSProperties} />
      </div>
      <span className="t-caption">You can start a shoot while this finishes.</span>
    </div>
  );
}

export function NotFoundScreen() {
  return (
    <div className="page">
      <EmptyState
        icon="search"
        title="We can't find that page"
        action={
          <Link className="btn btn-primary mt-2" to="/">
            Go home
          </Link>
        }
      >
        It may have been deleted, or the link is out of date.
      </EmptyState>
    </div>
  );
}
