import { Link } from "react-router";
import { Icon } from "../../components";
import { useOnline } from "../../hooks";
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

/** The studio catalogue saving itself for offline use, in the background. One quiet line; it never blocks a shoot. */
export function CatalogDownloadCard({ status, onRetry }: { status: CatalogStatus; onRetry?: () => void }) {
  if (status.state === "never-loaded" && !status.progress)
    return (
      <div className="catalog-dl" role="status">
        <Icon name="alert" />
        <div className="catalog-dl-body">
          <span className="catalog-dl-title">We couldn't load the studio catalogue</span>
          <span className="t-caption">Check your internet connection. Your own models still work.</span>
        </div>
        {onRetry && (
          <button className="btn btn-secondary btn-sm" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  if (status.state !== "loading") return null;
  const p = status.progress;
  const pct = p && p.total ? Math.min(100, Math.floor((p.done / p.total) * 100)) : null;
  const title = status.progress ? "Saving the studio catalogue for offline use" : "Getting the studio catalogue";
  return (
    <div className="catalog-dl" role="status" aria-live="polite">
      <Icon name="download" />
      <div className="catalog-dl-body">
        <div className="catalog-dl-row">
          <span className="catalog-dl-title">{title}</span>
          <span className="t-mono t-caption">{pct === null ? "Starting…" : `${pct}%`}</span>
        </div>
        <div className="progress" aria-hidden="true">
          <i style={{ "--p": `${pct ?? 0}%` } as React.CSSProperties} />
        </div>
        <span className="t-caption">You can start a shoot while this finishes.</span>
      </div>
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

/** Why the studio models aren't showing: offline (they load once you connect) or a failed download. */
export function CatalogUnavailableText() {
  const online = useOnline();
  return online ? (
    <>
      <span className="art">
        <Icon name="alert" />
      </span>
      <h2 className="t-section">We couldn't load the studio models</h2>
      <p>Check your internet connection and try again. Your own models still work.</p>
    </>
  ) : (
    <>
      <span className="art">
        <Icon name="offline" />
      </span>
      <h2 className="t-section">Connect to the internet once to load the studio models</h2>
      <p>
        The catalogue of models, poses and scenes is downloaded the first time. After that it is kept on this computer and works offline.
      </p>
    </>
  );
}
