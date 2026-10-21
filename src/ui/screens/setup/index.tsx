import { useNavigate, Link } from "react-router";
import { api } from "../../../lib/api";
import { Icon, Switch, formatBytes } from "../../components";
import { useLoad, useSettings } from "../../hooks";
import { OnboardingTop } from "../connect";

export function SetupScreen() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const catalog = useLoad((a) => a.catalogStatus(), [], ["catalog"]);
  const size = catalog.data && catalog.data.cacheBytes > 0 ? formatBytes(catalog.data.cacheBytes) : "up to about 1.2 GB";

  async function change() {
    const f = await (await api()).pickFolder();
    if (f) void update({ photosFolder: f });
  }
  return (
    <div className="ob">
      <OnboardingTop step={3} />
      <div className="ob-body">
        <div>
          <h1 className="t-page">
            Where should photos <em className="italic">go</em>?
          </h1>
          <p className="muted" style={{ maxWidth: "52ch", marginTop: 10 }}>
            Your finished photos are saved as normal files in a folder you can open any time.
          </p>
        </div>
        <div className="card">
          <div className="card-row">
            <span className="ic">
              <Icon name="folder" />
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="k">Photos folder</div>
              <div className="path mt-1">{settings?.photosFolder ?? " "}</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={change}>
              Change…
            </button>
          </div>
          <div className="card-row">
            <span className="ic">
              <Icon name="offline" />
            </span>
            <div className="grow">
              <div className="k">Keep the studio catalogue for offline use</div>
              <div className="v">
                Models, poses and scenes are saved here so you can browse without internet. <span className="t-mono">{size}</span>
              </div>
            </div>
            <Switch
              label="Keep the studio catalogue for offline use"
              checked={settings?.offlineCatalogue ?? true}
              onChange={(v) => update({ offlineCatalogue: v })}
            />
          </div>
          <div className="card-row">
            <span className="ic">
              <Icon name="bell" />
            </span>
            <div className="grow">
              <div className="k">Tell me when photos are ready</div>
              <div className="v">A quiet notification from your computer.</div>
            </div>
            <Switch
              label="Tell me when photos are ready"
              checked={settings?.notifyWhenReady ?? true}
              onChange={(v) => update({ notifyWhenReady: v })}
            />
          </div>
        </div>
        <div className="well">
          <div className="priv">
            <div>
              <h3>
                <Icon name="lock" size="sm" />
                Stays on this computer
              </h3>
              <p>Your products, shoots, photos, own models, and your key.</p>
            </div>
            <div>
              <h3>
                <Icon name="upload" size="sm" />
                Sent to OpenAI
              </h3>
              <p>Your product photos, plus the model, pose and scene for each photo you make.</p>
            </div>
            <div>
              <h3>
                <Icon name="shield" size="sm" />
                Sent to Aaina
              </h3>
              <p>Nothing, except downloading the studio catalogue. No tracking.</p>
            </div>
          </div>
        </div>
      </div>
      <footer className="ob-foot">
        <Link className="btn btn-ghost" to="/connect">
          <Icon name="left" size="sm" />
          Back
        </Link>
        <div className="grow" />
        <button
          className="btn btn-primary btn-lg"
          onClick={async () => {
            await update({ onboarded: true });
            void navigate("/");
          }}
        >
          Start using Aaina
        </button>
      </footer>
    </div>
  );
}
