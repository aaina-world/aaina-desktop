import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../lib/api";
import { ESTIMATE_USD, type Photo, type SaveShape } from "../../lib/contract";
import { useLoad } from "../hooks/useApi";
import { useOs } from "../hooks/useOs";
import { costText } from "./Cost";
import { Dialog } from "./Dialog";
import { Chip, Segmented } from "./controls";
import { FieldError } from "./Notice";
import { Icon } from "./Icon";
import { toast } from "./Toast";
import { SWATCHES, isHex, nameColour, normHex } from "./colours";
import { AAINA_URL, COFFEE_URL, GITHUB_URL, OPENAI_BILLING_URL } from "./links";
import { slug } from "./shots";

// ---------- Confirm ----------
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  icon,
  onConfirm,
  onClose,
  busy,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: "trash" | "clock";
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog
      size="sm"
      alert
      plainFoot
      hideClose
      title={title}
      description={description}
      icon={icon ?? (danger ? "trash" : undefined)}
      iconTone={danger ? "danger" : "accent"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={"btn " + (danger ? "btn-danger" : "btn-primary") + (busy ? " loading" : "")}
            onClick={onConfirm}
            disabled={busy}
            data-autofocus
          >
            {danger && <Icon name="trash" />}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

// ---------- Save photo / Save all ----------
// What renderForSave really does: sizes follow the photo, a plain wall is never cut into, a scene photo is never stretched.
const SHAPES: { id: SaveShape; name: string; sub: string; ratio: string; top?: string }[] = [
  { id: "square", name: "Square", sub: "1:1", ratio: "1/1" },
  { id: "portrait-4x5", name: "Portrait", sub: "4:5", ratio: "4/5" },
  { id: "tall-3x4", name: "Tall", sub: "3:4", ratio: "3/4" },
  { id: "white-square", name: "Amazon", sub: "1:1 · plain walls made pure white", ratio: "1/1" },
  { id: "landscape-4x3", name: "Etsy", sub: "4:3 · scenes stay square", ratio: "4/3", top: "center 30%" },
];

export function SaveDialog({ photos, shootName, onClose }: { photos: Photo[]; shootName: string; onClose: () => void }) {
  const { showInFolder } = useOs();
  const settings = useLoad((a) => a.settings(), []);
  const one = photos.length === 1;
  const [format, setFormat] = useState<"jpeg" | "png" | null>(null);
  const [shape, setShape] = useState<SaveShape>("square");
  const [folder, setFolder] = useState<string | null>(null);
  const [name, setName] = useState(one ? slug(`${shootName}-${photos[0].title}`) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fmt = format ?? settings.data?.saveFormat ?? "jpeg";
  const base = folder ?? settings.data?.saveFolder ?? "~/Downloads";
  const target = one ? base : `${base}/${shootName}`;
  const sample = photos[0]?.url ?? undefined;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const a = await api();
      const r = await a.savePhotos({
        photoIds: photos.map((p) => p.id),
        format: fmt,
        shape,
        folder: target,
        fileName: one ? name || undefined : undefined,
      });
      onClose();
      toast(
        <>
          Saved to <span className="t-mono">{target}</span>
        </>,
        { action: { label: showInFolder, onClick: () => a.showInFolder(r.paths[0] ?? target) } },
      );
    } catch {
      setBusy(false);
      setError("We couldn't save the photos. Check the folder is one you can write to, then try again.");
    }
  }

  return (
    <Dialog
      size="lg"
      title={one ? "Save photo" : `Save all ${photos.length} photos`}
      description={one ? `${shootName} · ${photos[0].title}` : `${shootName} · saved together in one new folder`}
      thumb={one ? sample : undefined}
      icon={one ? undefined : "folder"}
      onClose={onClose}
      footer={
        <>
          <span className="total">
            {one ? "About 1.8 MB" : `${photos.length} photos · about ${(photos.length * 1.8).toFixed(1)} MB`} · every photo is marked as
            AI-made
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className={"btn btn-primary" + (busy ? " loading" : "")} onClick={save} disabled={busy || photos.length === 0}>
            <Icon name="download" />
            {one ? "Save photo" : `Save ${photos.length} photos`}
          </button>
        </>
      }
    >
      <div className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
        <div className="field">
          <span className="label">File type</span>
          <Segmented
            label="File type"
            style={{ alignSelf: "flex-start" }}
            value={fmt}
            onChange={setFormat}
            options={[
              { value: "jpeg", label: "High-quality JPEG" },
              { value: "png", label: "Original PNG" },
            ]}
          />
          {one && <span className="hint">JPEG is smaller and fine for every marketplace. PNG keeps every pixel.</span>}
        </div>
        <div className="field">
          <span className="label">Shape</span>
          <div className="shapes">
            {SHAPES.map((s) => (
              <button key={s.id} className="chip shp" aria-pressed={shape === s.id} onClick={() => setShape(s.id)}>
                <span className="pv">
                  <span className="im" style={{ aspectRatio: s.ratio }}>
                    {sample && <img src={sample} alt="" style={{ objectPosition: s.top }} />}
                  </span>
                </span>
                <span className="nm">{s.name}</span>
                <span className="s">{s.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="two">
          {one && (
            <div className="field">
              <label className="label" htmlFor="sv-name">
                File name
              </label>
              <div className="fname">
                <input className="input" id="sv-name" value={name} onChange={(e) => setName(e.target.value)} />
                <span className="ext">{fmt === "jpeg" ? ".jpg" : ".png"}</span>
              </div>
            </div>
          )}
          <div className="field" style={one ? undefined : { gridColumn: "1 / -1" }}>
            <span className="label">Where</span>
            <div className="whereto">
              <Icon name="folder" />
              <span className="grow truncate">
                Save to <span className="pth">{target}</span>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  const a = await api();
                  const f = await a.pickFolder();
                  if (!f) return;
                  setFolder(f);
                  // Next time Save opens here.
                  void a.updateSettings({ saveFolder: f });
                }}
              >
                Change
              </button>
            </div>
          </div>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </div>
    </Dialog>
  );
}

// ---------- Fix something ----------
const FIX_EXAMPLES = ["Remove the necklace", "Smooth the wrinkles", "Fix the hands", "Straighten the hem", "Brighter light"];

export function FixDialog({ photo, shootName, onClose }: { photo: Photo; shootName?: string; onClose: () => void }) {
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    if (!words.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await (await api()).fixPhoto(photo.id, words.trim());
      onClose();
      toast(`Making the fix${shootName ? ` in ${shootName}` : ""}. It is saved as a new version.`, { icon: "wand" });
    } catch {
      setBusy(false);
      setError("We couldn't start the fix. Nothing was sent to OpenAI. Try again.");
    }
  }
  return (
    <Dialog
      title="Fix something"
      description="Keeps the same photo, face and pose. Only this change is made."
      thumb={photo.url}
      onClose={onClose}
      footer={
        <>
          <span className="total cost">{costText(ESTIMATE_USD.edit)}</span>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className={"btn btn-primary" + (busy ? " loading" : "")} onClick={go} disabled={busy || !words.trim()}>
            <Icon name="wand" />
            Make the fix
          </button>
        </>
      }
    >
      <div className="stack" style={{ "--gap": "18px" } as React.CSSProperties}>
        <div className="field">
          <label className="label" htmlFor="fx">
            What should change?
          </label>
          <div className="taw">
            <textarea
              className="textarea"
              id="fx"
              data-autofocus
              placeholder="Tuck the left side of the T-shirt in"
              maxLength={500}
              value={words}
              onChange={(e) => setWords(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void go();
              }}
            />
            <span className="count">{words.length} / 500</span>
          </div>
        </div>
        <div className="field">
          <span className="label">Or try an example</span>
          <div className="chips">
            {FIX_EXAMPLES.map((x) => (
              <Chip key={x} pressed={words === x} onClick={() => setWords(x)}>
                {x}
              </Chip>
            ))}
          </div>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </div>
    </Dialog>
  );
}

// ---------- Other colours ----------
export function ColoursDialog({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const [picked, setPicked] = useState<{ hex: string; name: string }[]>([]);
  const [hex, setHex] = useState("#c9552b");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = isHex(hex) ? normHex(hex) : null;
  const has = (h: string) => picked.some((p) => p.hex === h);
  const toggle = (h: string, name: string) =>
    setPicked((l) => (has(h) ? l.filter((p) => p.hex !== h) : l.length >= 6 ? l : [...l, { hex: h, name }]));
  const typedName = useMemo(() => (typed ? nameColour(typed) : null), [typed]);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      await (await api()).otherColours(photo.id, picked);
      onClose();
      toast(`Making ${picked.length} ${picked.length === 1 ? "colour" : "colours"}. They appear in this shoot.`, { icon: "palette" });
    } catch {
      setBusy(false);
      setError("We couldn't start the colours. Nothing was sent to OpenAI. Try again.");
    }
  }
  return (
    <Dialog
      size="lg"
      title="Other colours"
      description="The same photo in new colours. Pick up to 6."
      thumb={photo.url}
      onClose={onClose}
      footer={
        <>
          <span className="total cost">
            {picked.length ? costText(ESTIMATE_USD.edit, { count: picked.length }) : costText(ESTIMATE_USD.edit) + " each"}
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className={"btn btn-primary" + (busy ? " loading" : "")} onClick={go} disabled={busy || !picked.length}>
            <Icon name="palette" />
            {picked.length ? `Make ${picked.length} ${picked.length === 1 ? "colour" : "colours"}` : "Make colours"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ "--gap": "16px" } as React.CSSProperties}>
        <div className="swgrid">
          {SWATCHES.map((s) => (
            <button
              key={s.hex}
              className="chip swt"
              aria-pressed={has(s.hex)}
              data-light={s.light ? "" : undefined}
              onClick={() => toggle(s.hex, s.name)}
              disabled={!has(s.hex) && picked.length >= 6}
            >
              <span className="sd" style={{ background: s.hex }}>
                <Icon name="check" size="sm" />
              </span>
              {s.name}
            </button>
          ))}
        </div>
        <div className="field">
          <label className="label" htmlFor="hx">
            Or type a colour
          </label>
          <div className="hexrow">
            <span className="dot" style={{ background: typed ?? "var(--bg-sunken)" }} />
            <input className="input" id="hx" value={hex} onChange={(e) => setHex(e.target.value)} aria-label="Hex colour" />
            <button
              className="btn btn-secondary btn-sm"
              disabled={!typed || picked.length >= 6}
              onClick={() => typed && toggle(typed, typedName!)}
            >
              {typed && has(typed) ? "Added" : "Add"}
            </button>
            <span className="t-caption">{typed ? `Named for you: ${typedName}` : "Use a hex like #c9552b"}</span>
          </div>
        </div>
        <div className="row spread">
          <span className="t-caption num">{picked.length} of 6 chosen</span>
          <span className="t-caption">Each colour is a new photo in this shoot.</span>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </div>
    </Dialog>
  );
}

// ---------- Key problem ----------
export function KeyProblemDialog({
  onClose,
  reason,
}: {
  onClose: () => void;
  reason?: "KEY_REFUSED" | "OUT_OF_CREDIT" | "VERIFY_ORGANIZATION";
}) {
  const navigate = useNavigate();
  const head =
    reason === "OUT_OF_CREDIT"
      ? "Your OpenAI account is out of credit"
      : reason === "VERIFY_ORGANIZATION"
        ? "OpenAI wants your organisation verified"
        : "OpenAI stopped accepting your key";
  return (
    <Dialog
      alert
      plainFoot
      title={head}
      description="No photo was started, and nothing was charged. This is usually one of these."
      icon="key"
      iconTone="danger"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={async () => (await api()).openUrl(OPENAI_BILLING_URL)}>
            Open OpenAI billing <Icon name="expand" size="sm" />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onClose();
              void navigate("/settings#connection");
            }}
          >
            Change key
          </button>
        </>
      }
    >
      <ul className="reasons">
        <li>
          <Icon name="key" />
          <div>
            <b>The key was removed or changed</b>
            <span>Make a new one in your OpenAI account and paste it in Settings.</span>
          </div>
        </li>
        <li>
          <Icon name="coin" />
          <div>
            <b>You are out of credit at OpenAI</b>
            <span>Add credit at platform.openai.com, then try again.</span>
          </div>
        </li>
        <li>
          <Icon name="shield" />
          <div>
            <b>OpenAI wants the organisation verified</b>
            <span>New accounts verify once before making photos. It is in your OpenAI settings.</span>
          </div>
        </li>
      </ul>
    </Dialog>
  );
}

// ---------- Keyboard shortcuts ----------
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { mod } = useOs();
  const rows: [string, string][] = [
    ["New shoot", mod + "N"],
    ["Next or previous photo", "← →"],
    ["Search", mod + "K"],
    ["Zoom", "Space"],
    ["Save photo", mod + "S"],
    ["Delete", "⌫"],
    ["Copy", mod + "C"],
    ["Settings", mod + ","],
  ];
  return (
    <Dialog title="Keyboard shortcuts" description="Photos, shoots and the app." onClose={onClose}>
      <div className="keys">
        {rows.map(([k, v]) => (
          <div className="k" key={k}>
            {k}
            <span className="kbd">{v}</span>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

// ---------- Buy me a coffee ----------
export function CoffeeDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      bare
      title="Buy me a coffee"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Not now
          </button>
          <span className="grow" />
          <button className="btn btn-secondary" onClick={async () => (await api()).openUrl(GITHUB_URL)}>
            <Icon name="github" />
            Star on GitHub
          </button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              void (await api()).openUrl(COFFEE_URL);
              onClose();
            }}
          >
            <Icon name="coffee" />
            Open Buy Me a Coffee
          </button>
        </>
      }
    >
      <div style={{ paddingTop: "var(--s-1)" }}>
        <div className="coffee-art">
          <Icon name="coffee" />
        </div>
        <div className="stack" style={{ "--gap": "8px", marginTop: 12 } as React.CSSProperties}>
          <div style={{ font: "600 var(--text-lg)/1.3 var(--font-sans)" }}>Aaina Desktop is free, and made by one person</div>
          <p className="muted t-small" style={{ lineHeight: 1.55 }}>
            There are no accounts and no subscriptions, and your photos stay on your computer. If it saves you time, a coffee helps me keep
            fixing things and adding more. It's completely optional.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

/** One quiet line: videos, try-ons and listings are on Aaina. Never more than one per screen. */
export function MoreOnAaina() {
  return (
    <div className="more-on-aaina">
      <span className="ics">
        <Icon name="video" />
        <Icon name="tryon" />
        <Icon name="doc" />
      </span>
      <div className="grow">
        <div className="t-small" style={{ fontWeight: 600 }}>
          Videos, try-ons and listings are on Aaina
        </div>
        <div className="t-caption mt-1">Same models and scenes, made on Aaina's servers.</div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={async () => (await api()).openUrl(AAINA_URL)}>
        Open aaina.world <Icon name="expand" size="sm" />
      </button>
    </div>
  );
}

// ---------- Rename ----------
export function RenameDialog({
  title,
  value,
  onSave,
  onClose,
}: {
  title: string;
  value: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(value);
  const ok = name.trim().length > 0;
  return (
    <Dialog
      size="sm"
      title={title}
      onClose={onClose}
      footer={
        <>
          <span className="grow" />
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!ok}
            onClick={() => {
              onSave(name.trim());
              onClose();
            }}
          >
            Rename
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label" htmlFor="rn">
          Name
        </label>
        <input
          className="input"
          id="rn"
          data-autofocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ok) {
              onSave(name.trim());
              onClose();
            }
          }}
        />
      </div>
    </Dialog>
  );
}
