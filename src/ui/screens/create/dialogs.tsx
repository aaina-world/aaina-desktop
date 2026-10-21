// Make a pose, Describe a pose and Make a scene (dialogs.html).
import { useState } from "react";
import type { Api, ModelRef, OwnPose, OwnScene } from "../../../lib/contract";
import { ESTIMATE_USD } from "../../../lib/contract";
import { Dialog } from "../../components/Dialog";
import { FieldError } from "../../components/Notice";
import { Icon, about, messageOf, useApi } from "./kit";

export type ModelChoice = { ref: ModelRef; name: string; group: "Your models" | "Studio models" };

function fileName(p: string) {
  return p.split(/[\\/]/).pop() ?? p;
}

function RefPhoto({
  label,
  hint,
  path,
  onPick,
  onClear,
}: {
  label: React.ReactNode;
  hint: string;
  path: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {path ? (
        <div className="card card-row" style={{ padding: "10px 14px" }}>
          <Icon name="picture" />
          <span className="t-small grow" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName(path)}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onClear}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className="drop minidrop" onClick={onPick}>
          <span className="ico-ring">
            <Icon name="upload" />
          </span>
          <span className="t-small">
            <b>Choose a photo</b> from your files
          </span>
          <span className="t-caption">{hint}</span>
        </button>
      )}
    </div>
  );
}

function ModelSelect({ choices, value, onChange }: { choices: ModelChoice[]; value: string; onChange: (v: string) => void }) {
  const groups = ["Your models", "Studio models"] as const;
  return (
    <div className="field">
      <label className="label" htmlFor="mk-model">
        On which model
      </label>
      <select className="select" id="mk-model" value={value} onChange={(e) => onChange(e.target.value)}>
        {groups.map((g) => {
          const list = choices.filter((c) => c.group === g);
          return list.length ? (
            <optgroup key={g} label={g}>
              {list.map((c) => (
                <option key={c.ref.source + c.ref.id} value={c.ref.source + ":" + c.ref.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
    </div>
  );
}

export function MakePoseDialog({
  model,
  modelName,
  choices,
  onClose,
  onMade,
}: {
  model?: ModelRef | null;
  modelName?: string;
  choices?: ModelChoice[];
  onClose: () => void;
  onMade: (p: OwnPose) => void;
}) {
  const api = useApi();
  const [words, setWords] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [pick, setPick] = useState(choices?.[0] ? choices[0].ref.source + ":" + choices[0].ref.id : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chosen: ModelRef | null =
    model ??
    ((): ModelRef | null => {
      const c = choices?.find((x) => x.ref.source + ":" + x.ref.id === pick);
      return c?.ref ?? null;
    })();
  const can = !!chosen && (words.trim().length > 2 || !!ref) && !busy;

  async function pickFile(a: Api) {
    const r = await a.pickFiles({ multiple: false });
    if (r[0]) setRef(r[0]);
  }
  async function go() {
    if (!api || !chosen) return;
    setBusy(true);
    setErr(null);
    try {
      const p = await api.makePose({ model: chosen, words: words.trim() || undefined, referencePath: ref ?? undefined });
      onMade(p);
      onClose();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <Dialog
      onClose={onClose}
      title="Make a pose"
      icon="frame"
      description={
        modelName
          ? `We make a pose photo of ${modelName}, then it is yours to use. Describe it in words, or show one photo of the pose.`
          : "Describe it in words, or show one photo of the pose."
      }
      footer={
        <>
          <span className="total cost">{about(ESTIMATE_USD.pose)}</span>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!can} onClick={go}>
            <Icon name="sparkle" />
            {busy ? "Starting" : "Make the pose"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ ["--gap" as string]: "16px" }}>
        {choices && choices.length > 0 && <ModelSelect choices={choices} value={pick} onChange={setPick} />}
        <div className="field">
          <label className="label" htmlFor="pw">
            Describe the pose
          </label>
          <div className="taw">
            <textarea
              className="textarea"
              id="pw"
              placeholder="Walking toward the camera, one hand in a pocket, looking away"
              maxLength={500}
              value={words}
              onChange={(e) => setWords(e.target.value)}
            />
            <span className="count">{words.length} / 500</span>
          </div>
        </div>
        <div className="row" style={{ ["--gap" as string]: "12px" }}>
          <span className="grow" style={{ height: 1, background: "var(--line)" }} />
          <span className="t-caption">or</span>
          <span className="grow" style={{ height: 1, background: "var(--line)" }} />
        </div>
        <RefPhoto
          label={
            <>
              Show a pose <span className="opt">one photo</span>
            </>
          }
          hint="A person in the pose you want"
          path={ref}
          onPick={() => api && pickFile(api)}
          onClear={() => setRef(null)}
        />
        <div className="quiet-line">
          <Icon name="lock" />
          <span>The photo is only read for the pose and isn't kept.</span>
        </div>
        {err && <FieldError>{err}</FieldError>}
      </div>
    </Dialog>
  );
}

export function DescribePoseDialog({
  modelName,
  onClose,
  onUse,
}: {
  modelName?: string;
  onClose: () => void;
  onUse: (words: string) => void;
}) {
  const [words, setWords] = useState("");
  const ok = words.trim().length > 2;
  return (
    <Dialog
      onClose={onClose}
      title="Describe a pose"
      icon="edit"
      description="Used in your photo as written. Nothing is made until you press Make on the last step."
      footer={
        <>
          <span className="total cost">Free</span>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!ok}
            onClick={() => {
              onUse(words.trim());
              onClose();
            }}
          >
            Use this pose
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label" htmlFor="ds-pose">
          How should {modelName ?? "the model"} stand?
        </label>
        <div className="taw">
          <textarea
            className="textarea"
            id="ds-pose"
            placeholder="e.g. Walking toward the camera, one hand in a pocket"
            maxLength={300}
            value={words}
            onChange={(e) => setWords(e.target.value)}
          />
          <span className="count">{words.length} / 300</span>
        </div>
      </div>
    </Dialog>
  );
}

export function MakeSceneDialog({ onClose, onMade }: { onClose: () => void; onMade: (s: OwnScene) => void }) {
  const api = useApi();
  const [words, setWords] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const can = (words.trim().length > 2 || !!ref) && !busy;
  async function go() {
    if (!api) return;
    setBusy(true);
    setErr(null);
    try {
      const s = await api.makeScene({ words: words.trim(), referencePath: ref ?? undefined });
      onMade(s);
      onClose();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <Dialog
      onClose={onClose}
      title="Make a scene"
      icon="picture"
      description="Describe the place. A reference photo is optional."
      footer={
        <>
          <span className="total cost">{about(ESTIMATE_USD.scene)}</span>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!can} onClick={go}>
            <Icon name="sparkle" />
            {busy ? "Starting" : "Make the scene"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ ["--gap" as string]: "16px" }}>
        <div className="field">
          <label className="label" htmlFor="sw">
            Describe the scene
          </label>
          <div className="taw">
            <textarea
              className="textarea"
              id="sw"
              placeholder="A sunlit terrace with white walls and terracotta pots, soft morning light"
              maxLength={500}
              value={words}
              onChange={(e) => setWords(e.target.value)}
            />
            <span className="count">{words.length} / 500</span>
          </div>
          <span className="hint">Scenes have no people in them. Models are added when you make photos.</span>
        </div>
        <RefPhoto
          label={
            <>
              Reference photo <span className="opt">optional</span>
            </>
          }
          hint="A place whose look you like"
          path={ref}
          onPick={async () => {
            if (!api) return;
            const r = await api.pickFiles({ multiple: false });
            if (r[0]) setRef(r[0]);
          }}
          onClear={() => setRef(null)}
        />
        {err && <FieldError>{err}</FieldError>}
      </div>
    </Dialog>
  );
}
