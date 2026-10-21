import { useEffect } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { useCreateData } from "./data";
import { useDraft } from "./draft";
import { reachable, stepPath, type StepKey } from "./flow";
import { FlatLayStep, GhostStep } from "./OtherSteps";
import { ModelStep } from "./ModelStep";
import { PosesStep } from "./PosesStep";
import { draftStepFor, nextStepFor, ProductStep, type StartState } from "./ProductStep";
import { ReviewStep } from "./ReviewStep";
import { SceneStep } from "./SceneStep";
import "./create.css";

const STEP_KEYS: StepKey[] = ["product", "model", "poses", "scene", "review", "styles", "angles"];

/** /create/new and /create/:shootId/:step. The draft shoot is saved on every change, so Back and refresh keep it. */
export function CreateScreen() {
  const { shootId, step } = useParams();
  const loc = useLocation();
  const start = (loc.state ?? null) as StartState;
  const draft = useDraft(shootId);
  const data = useCreateData(draft.shoot);
  const { shoot, product } = draft;

  // The step in the address is remembered on the draft, so "Continue" opens where you left off.
  const wanted = (STEP_KEYS as string[]).includes(step ?? "") ? (step as StepKey) : "product";
  useEffect(() => {
    if (!shoot) return;
    const d = draftStepFor(wanted);
    if (shoot.draftStep !== d && shoot.status === "draft") draft.patch({ draftStep: d });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shoot?.id, wanted]);

  if (!shootId) return <ProductStep draft={draft} data={data} start={start} />;

  if (draft.status === "loading") return <Loading />;
  if (draft.status === "missing" || draft.status === "error" || !shoot) {
    return (
      <div className="page">
        <div className="empty">
          <h2 className="t-section">{draft.status === "missing" ? "This draft isn't here any more" : "We couldn't open this draft"}</h2>
          <p>{draft.status === "missing" ? "It may have been deleted. You can start a new shoot." : draft.error}</p>
          <div className="row" style={{ justifyContent: "center" }}>
            {draft.status === "error" && (
              <button className="btn btn-secondary" onClick={draft.reload}>
                Try again
              </button>
            )}
            <Link className="btn btn-primary" to="/create/new">
              New shoot
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (shoot.status !== "draft") return <Navigate to={`/shoots/${shoot.id}`} replace />;

  // A step the draft isn't ready for opens the last step it can show.
  const hasPhotos = !!product?.photos.length;
  const reach = reachable(shoot, hasPhotos);
  const kindSteps: StepKey[] =
    shoot.kind === "model"
      ? ["product", "model", "poses", "scene", "review"]
      : shoot.kind === "flat-lay"
        ? ["product", "styles"]
        : ["product", "angles"];
  let cur: StepKey = wanted;
  if (!kindSteps.includes(cur)) cur = cur === "review" ? kindSteps[kindSteps.length - 1] : nextStepFor(shoot.kind);
  const ri = kindSteps.indexOf(reach === "review" && shoot.kind !== "model" ? kindSteps[kindSteps.length - 1] : reach);
  if (product && kindSteps.indexOf(cur) > Math.max(ri, 0)) {
    return <Navigate to={stepPath(shoot.id, kindSteps[Math.max(ri, 0)])} replace />;
  }
  if (cur !== step) return <Navigate to={stepPath(shoot.id, cur)} replace />;

  if (cur === "product") return <ProductStep draft={draft} data={data} start={null} />;
  if (cur === "model") return <ModelStep draft={draft} data={data} />;
  if (cur === "poses") return <PosesStep draft={draft} data={data} />;
  if (cur === "scene") return <SceneStep draft={draft} data={data} />;
  if (cur === "styles") return <FlatLayStep draft={draft} data={data} />;
  if (cur === "angles") return <GhostStep draft={draft} data={data} />;
  return <ReviewStep draft={draft} data={data} />;
}

function Loading() {
  return (
    <>
      <header className="topbar">
        <div className="flowbar grow">
          <div className="skeleton" style={{ height: 28, width: 280 }} />
        </div>
      </header>
      <div className="page">
        <div className="split">
          <section>
            <div className="skeleton" style={{ height: 40, width: 320, marginBottom: 24 }} />
            <div className="grid c4" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="tile">
                  <div className="media skeleton" />
                </div>
              ))}
            </div>
          </section>
          <aside>
            <div className="skeleton" style={{ height: 240, borderRadius: 16 }} />
          </aside>
        </div>
      </div>
    </>
  );
}
