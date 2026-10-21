import { useEffect, useRef, useState } from "react";
import { logWarning } from "../../../lib/log";
import { useLocation } from "react-router";
import { api } from "../../../lib/api";
import { ESTIMATE_USD } from "../../../lib/contract";
import {
  ConfirmDialog,
  CoffeeDialog,
  Icon,
  Segmented,
  Switch,
  Topbar,
  formatBytes,
  formatDateTime,
  toast,
  GITHUB_URL,
  formatUsd,
  type IconName,
} from "../../components";
import { announceUpdate, latestRelease, useLoad, useOs, useSettings } from "../../hooks";
import { ConnectCards } from "../connect";

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: "connection", label: "Connection", icon: "key" },
  { id: "photos", label: "Photos", icon: "images" },
  { id: "catalogue", label: "Catalogue", icon: "layers" },
  { id: "appearance", label: "Appearance", icon: "sun" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "updates", label: "Updates", icon: "refresh" },
  { id: "privacy", label: "Privacy", icon: "shield" },
  { id: "data", label: "Your data", icon: "download" },
  { id: "about", label: "About", icon: "info" },
];

export function SettingsScreen() {
  const { showInFolder } = useOs();
  const { settings, update } = useSettings();
  const loc = useLocation();
  const conn = useLoad((a) => a.connection(), [], ["connection"]);
  const catalog = useLoad((a) => a.catalogStatus(), [], ["catalog"]);
  const version = useLoad((a) => a.appVersion(), []);
  const [active, setActive] = useState("connection");
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dlg, setDlg] = useState<"delete" | "coffee" | "removeKey" | null>(null);
  const [editKey, setEditKey] = useState(false);

  useEffect(() => {
    const id = loc.hash.replace("#", "");
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [loc.hash]);
  // The menu follows the scroll. A section picked from the menu stays lit while the page glides to it, and at the bottom
  // of the page (where the last short sections can't reach the top) until the person scrolls themselves.
  const picked = useRef<string | null>(null);
  useEffect(() => {
    const on = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (picked.current) {
        setActive(picked.current);
        return;
      }
      let cur = SECTIONS[0].id;
      for (const s of SECTIONS) if ((document.getElementById(s.id)?.getBoundingClientRect().top ?? 1e9) < 140) cur = s.id;
      setActive(atBottom ? SECTIONS[SECTIONS.length - 1].id : cur);
    };
    const own = () => {
      picked.current = null;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("wheel", own, { passive: true });
    window.addEventListener("keydown", own);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("wheel", own);
      window.removeEventListener("keydown", own);
    };
  }, []);

  const c = conn.data;
  const s = settings;
  const jump = (id: string) => {
    picked.current = id;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  async function refresh() {
    setRefreshing(true);
    try {
      await (await api()).refreshCatalog();
      catalog.reload();
      toast("Catalogue is up to date");
    } catch {
      toast("We couldn't reach the studio catalogue. Your saved copy still works.", { icon: "alert" });
    } finally {
      setRefreshing(false);
    }
  }
  async function clearCache() {
    setClearing(true);
    try {
      await (await api()).clearCatalogCache();
      catalog.reload();
      toast("Cache cleared. Pictures download again when you need them.");
    } catch {
      toast("We couldn't clear the cache.", { icon: "alert" });
    } finally {
      setClearing(false);
    }
  }
  async function checkUpdates() {
    setChecking(true);
    try {
      const a = await api();
      const result = await latestRelease(a);
      if (result.kind === "newer") announceUpdate(a, result);
      else toast("You're on the latest version");
    } catch (error) {
      void logWarning("Update check failed", error);
      toast("We couldn't check for updates. Try again later.", { icon: "alert" });
    } finally {
      setChecking(false);
    }
  }
  async function backup() {
    const a = await api();
    const folder = await a.pickFolder();
    if (!folder) return;
    try {
      const path = await a.backup(folder);
      toast("Backup saved", { action: { label: showInFolder, onClick: () => a.showInFolder(path) } });
    } catch (error) {
      void logWarning("Backup failed", error);
      toast("We couldn't make the backup. Check the folder and try again.", { icon: "alert" });
    }
  }
  // A backup is a folder ("Aaina backup <date>"); restoring replaces what is on this computer and restarts the app.
  const [restoring, setRestoring] = useState<string | null>(null);
  async function pickBackup() {
    const folder = await (await api()).pickFolder();
    if (folder) setRestoring(folder);
  }
  async function restore(folder: string) {
    try {
      await (await api()).restore(folder);
    } catch (error) {
      void logWarning("Restore failed", error);
      setRestoring(null);
      toast("We couldn't read that backup. Pick a folder made by Back up everything.", { icon: "alert" });
    }
  }

  return (
    <>
      <Topbar crumbs={["Settings"]} />
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="t-page">Settings</h1>
            <p className="lede">How Aaina Desktop connects, where it keeps things, and how it looks.</p>
          </div>
        </div>
        <div className="sgrid">
          <nav className="snav" aria-label="Settings sections">
            {SECTIONS.map((x) => (
              <a
                key={x.id}
                href={`#${x.id}`}
                aria-current={active === x.id}
                onClick={(e) => {
                  e.preventDefault();
                  jump(x.id);
                }}
              >
                <Icon name={x.icon} size="sm" />
                {x.label}
              </a>
            ))}
          </nav>
          <div className="sstack">
            <section id="connection">
              <div className="sec-h">
                <h2 className="t-section">Connection</h2>
                <p className="t-caption">What Aaina Desktop uses to read products and make photos.</p>
              </div>
              {editKey || !c?.key.present || c.key.status !== "works" || !c.chatgpt.signedIn ? (
                <div className="stack" style={{ "--gap": "var(--s-4)" } as React.CSSProperties}>
                  <ConnectCards />
                </div>
              ) : null}
              {!editKey && c?.key.present && c.key.status === "works" && c.chatgpt.signedIn && (
                <div className="card">
                  <div className="card-row">
                    <span className="ic">
                      <Icon name="chatgpt" />
                    </span>
                    <div className="grow">
                      <div className="k">ChatGPT</div>
                      <div className="v">
                        Signed in as {c.chatgpt.email}
                        {c.chatgpt.plan ? ` · ${c.chatgpt.plan} plan` : ""}
                      </div>
                    </div>
                    <span className="badge success dot">Connected</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        await (await api()).signOutChatGPT();
                        conn.reload();
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                  <div className="card-row">
                    <span className="ic">
                      <Icon name="key" />
                    </span>
                    <div className="grow">
                      <div className="k">OpenAI key</div>
                      <div className="v t-mono">sk-…{c.key.last4}</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditKey(true)}>
                      Change
                    </button>
                    <button className="btn btn-danger-ghost btn-sm" onClick={() => setDlg("removeKey")}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
              <p className="t-caption" style={{ marginTop: "var(--s-3)" }}>
                Signed in to ChatGPT, your plan reads products and photos; your OpenAI key makes the photos, billed by OpenAI. Without
                ChatGPT, the key does both. Both stay in your system keychain.
              </p>
            </section>

            <section id="photos">
              <div className="sec-h">
                <h2 className="t-section">Photos</h2>
              </div>
              <div className="card">
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Quality</div>
                    <div className="v">Costs are what OpenAI charges per photo.</div>
                  </div>
                  <div className="seg-cost">
                    <Segmented
                      label="Quality"
                      value={s?.quality ?? "standard"}
                      onChange={(v) => update({ quality: v })}
                      options={[
                        { value: "standard", label: "Standard" },
                        { value: "high", label: "High" },
                      ]}
                    />
                    <span className="cost">
                      about {formatUsd(ESTIMATE_USD.photo.standard)} / {formatUsd(ESTIMATE_USD.photo.high)} a photo
                    </span>
                  </div>
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Photos at once</div>
                    <div className="v">More at once is faster, and may hit OpenAI's rate limits.</div>
                  </div>
                  <Segmented
                    label="Photos at once"
                    value={s?.parallel ?? 3}
                    onChange={(v) => update({ parallel: v })}
                    options={[1, 2, 3, 4].map((n) => ({ value: n as 1 | 2 | 3 | 4, label: String(n) }))}
                  />
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Default save format</div>
                    <div className="v">Used by Save photo.</div>
                  </div>
                  <Segmented
                    label="Save format"
                    value={s?.saveFormat ?? "jpeg"}
                    onChange={(v) => update({ saveFormat: v })}
                    options={[
                      { value: "jpeg", label: "JPEG" },
                      { value: "png", label: "PNG" },
                    ]}
                  />
                </div>
                <div className="card-row">
                  <span className="ic">
                    <Icon name="folder" />
                  </span>
                  <div className="grow">
                    <div className="k">Photos folder</div>
                    <div className="path mt-1">{s?.photosFolder ?? " "}</div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      const f = await (await api()).pickFolder();
                      if (f) void update({ photosFolder: f });
                    }}
                  >
                    Change…
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={async () => (await api()).showInFolder(s?.photosFolder ?? "")}>
                    {showInFolder}
                  </button>
                </div>
              </div>
            </section>

            <section id="catalogue">
              <div className="sec-h">
                <h2 className="t-section">Catalogue</h2>
                <p className="t-caption">Studio models, poses and scenes from Aaina.</p>
              </div>
              <div className="card">
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Last updated</div>
                    <div className="v">
                      {catalog.data?.checkedAt
                        ? formatDateTime(catalog.data.checkedAt)
                        : catalog.data?.state === "never-loaded"
                          ? "Not downloaded yet"
                          : "…"}
                      {catalog.data?.state === "offline" ? " · offline" : ""}
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={refreshing}>
                    {refreshing ? <span className="spinner" /> : <Icon name="refresh" size="sm" />}Refresh
                  </button>
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Keep the catalogue for offline use</div>
                    <div className="v">Browse models, poses and scenes without internet.</div>
                  </div>
                  <Switch
                    label="Offline catalogue"
                    checked={s?.offlineCatalogue ?? true}
                    onChange={(v) => update({ offlineCatalogue: v })}
                  />
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Saved on this computer</div>
                    <div className="v t-mono">{catalog.data ? formatBytes(catalog.data.cacheBytes) : "…"}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={clearCache} disabled={clearing || !catalog.data?.cacheBytes}>
                    {clearing && <span className="spinner" />}Clear cache
                  </button>
                </div>
              </div>
            </section>

            <section id="appearance">
              <div className="sec-h">
                <h2 className="t-section">Appearance</h2>
              </div>
              <div className="card">
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Theme</div>
                    <div className="v">System follows your computer.</div>
                  </div>
                  <Segmented
                    label="Theme"
                    value={s?.theme ?? "system"}
                    onChange={(v) => update({ theme: v })}
                    options={[
                      { value: "system", label: "System" },
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                    ]}
                  />
                </div>
              </div>
            </section>

            <section id="notifications">
              <div className="sec-h">
                <h2 className="t-section">Notifications</h2>
              </div>
              <div className="card">
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Tell me when photos are ready</div>
                    <div className="v">A quiet notification from your computer.</div>
                  </div>
                  <Switch
                    label="Notify when photos are ready"
                    checked={s?.notifyWhenReady ?? true}
                    onChange={(v) => update({ notifyWhenReady: v })}
                  />
                </div>
              </div>
            </section>

            <section id="updates">
              <div className="sec-h">
                <h2 className="t-section">Updates</h2>
              </div>
              <div className="card">
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Version</div>
                    <div className="v t-mono">{version.data ?? "…"}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={checkUpdates} disabled={checking}>
                    {checking && <span className="spinner" />}Check for updates
                  </button>
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Check for updates when the app opens</div>
                    <div className="v">Tells you when a new version is out. Nothing is installed without you.</div>
                  </div>
                  <Switch
                    label="Check for updates when the app opens"
                    checked={s?.autoUpdate ?? true}
                    onChange={(v) => update({ autoUpdate: v })}
                  />
                </div>
              </div>
            </section>

            <section id="privacy">
              <div className="sec-h">
                <h2 className="t-section">Privacy</h2>
              </div>
              <div className="card">
                <div className="card-row">
                  <span className="ic">
                    <Icon name="shield" />
                  </span>
                  <div className="grow">
                    <div className="k">No tracking, no account</div>
                    <div className="v">
                      Your products, shoots and photos stay on this computer. Only product photos and each photo's model, pose and scene go
                      to OpenAI while a photo is made. Aaina receives nothing.
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={async () => (await api()).showInFolder(s?.photosFolder ?? "")}>
                    Open photos folder
                  </button>
                </div>
              </div>
            </section>

            <section id="data">
              <div className="sec-h">
                <h2 className="t-section">Your data</h2>
              </div>
              <div className="card">
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Back up everything</div>
                    <div className="v">Saves your shoots, products, own models and photos as one .zip file.</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={backup}>
                    <Icon name="download" size="sm" />
                    Back up
                  </button>
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Restore from backup</div>
                    <div className="v">Choose a folder made by Back up everything.</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => void pickBackup()}>
                    <Icon name="upload" size="sm" />
                    Restore
                  </button>
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Delete all shoots and photos</div>
                    <div className="v">Clears shoots, products and your own models from the app. Saved photo files and settings stay.</div>
                  </div>
                  <button className="btn btn-danger-ghost btn-sm" onClick={() => setDlg("delete")}>
                    Delete all
                  </button>
                </div>
              </div>
            </section>

            <section id="about">
              <div className="sec-h">
                <h2 className="t-section">About</h2>
              </div>
              <div className="card">
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Aaina Desktop</div>
                    <div className="v t-mono">Version {version.data ?? "…"}</div>
                  </div>
                  <a className="btn btn-ghost btn-sm" href="#/about">
                    More
                  </a>
                </div>
                <div className="card-row">
                  <span className="ic">
                    <Icon name="github" />
                  </span>
                  <div className="grow">
                    <div className="k">Source code</div>
                    <div className="v">github.com/aaina-world/aaina-desktop</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={async () => (await api()).openUrl(GITHUB_URL)}>
                    Open GitHub <Icon name="expand" size="sm" />
                  </button>
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Licence</div>
                    <div className="v">MIT. Free to use, change and share.</div>
                  </div>
                </div>
                <div className="card-row">
                  <div className="grow">
                    <div className="k">Keyboard shortcuts</div>
                    <div className="v">Everything you can do without the mouse.</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => window.dispatchEvent(new Event("aaina:shortcuts"))}>
                    Show
                  </button>
                </div>
              </div>
              <div className="card coffee-card" style={{ marginTop: "var(--s-4)" }}>
                <span className="ico-c">
                  <Icon name="coffee" size="lg" />
                </span>
                <div className="grow">
                  <div className="k" style={{ fontWeight: 600 }}>
                    Aaina Desktop is free.
                  </div>
                  <div className="t-small muted">If it saves you a photoshoot, a coffee keeps it going.</div>
                </div>
                <button className="btn btn-primary" onClick={() => setDlg("coffee")}>
                  <Icon name="coffee" size="sm" />
                  Buy me a coffee
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {dlg === "coffee" && <CoffeeDialog onClose={() => setDlg(null)} />}
      {restoring && (
        <ConfirmDialog
          title="Restore this backup?"
          description={`Your shoots, products and models are replaced with the ones in “${restoring.split(/[\\/]/).pop()}”, and the app restarts. Its photos are copied into your photos folder${settings?.photosFolder ? ` (${settings.photosFolder})` : ""}, and files already there are never overwritten. Back up first if you might want what is here now.`}
          confirmLabel="Restore and restart"
          onClose={() => setRestoring(null)}
          onConfirm={() => restore(restoring)}
        />
      )}
      {dlg === "delete" && (
        <ConfirmDialog
          danger
          title="Delete all shoots and photos?"
          description="Every shoot, product and model of your own is removed from Aaina Desktop. This cannot be undone, so back up first if you might want them. Photo files already in your photos folder, your settings and your connection stay."
          confirmLabel="Delete all"
          onClose={() => setDlg(null)}
          onConfirm={async () => {
            await (await api()).deleteEverything();
            setDlg(null);
            toast("All shoots and photos are deleted", { icon: "trash" });
          }}
        />
      )}
      {dlg === "removeKey" && (
        <ConfirmDialog
          danger
          title="Remove your OpenAI key?"
          description="Photos can't be made until you add a key again. Your shoots and photos stay."
          confirmLabel="Remove key"
          onClose={() => setDlg(null)}
          onConfirm={async () => {
            await (await api()).removeKey();
            setDlg(null);
            conn.reload();
          }}
        />
      )}
    </>
  );
}
