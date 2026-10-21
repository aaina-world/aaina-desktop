import { useState } from "react";
import { api } from "../../../lib/api";
import { CoffeeDialog, GITHUB_URL, Icon, Logo, MoreOnAaina, Topbar, WEBSITE_URL, toast } from "../../components";
import { useLoad } from "../../hooks";

export function AboutScreen() {
  const version = useLoad((a) => a.appVersion(), []);
  const [coffee, setCoffee] = useState(false);
  return (
    <>
      <Topbar crumbs={[{ label: "Settings", to: "/settings" }, "About"]} />
      <div className="page">
        <div className="ab">
          <section className="ab-head">
            <div className="ab-id">
              <Logo />
              <div>
                <div className="nm">Aaina Desktop</div>
                <div className="t-mono t-caption">Version {version.data ?? "…"}</div>
              </div>
            </div>
            <h1 className="t-page">
              Free, open source, and <em className="italic">yours</em>.
            </h1>
            <p className="muted" style={{ maxWidth: "60ch" }}>
              Aaina Desktop is free and open source because good product photos shouldn't need a studio, an account or a subscription. It
              runs on your computer, keeps your work there, and you only pay OpenAI for the photos you make. If it helps your shop, there
              are a few small ways to help it back.
            </p>
          </section>
          <section className="ab-cards">
            <div className="card ab-card main-c">
              <span className="ic">
                <Icon name="coffee" size="lg" />
              </span>
              <h2>Buy me a coffee</h2>
              <p className="t-small muted">A coffee keeps Aaina Desktop free and growing.</p>
              <button className="btn btn-primary" onClick={() => setCoffee(true)}>
                <Icon name="coffee" size="sm" />
                Buy me a coffee
              </button>
            </div>
            <div className="card ab-card">
              <span className="ic">
                <Icon name="github" size="lg" />
              </span>
              <h2>Star on GitHub</h2>
              <p className="t-small muted">A star helps other sellers find it.</p>
              <button className="btn btn-secondary" onClick={async () => (await api()).openUrl(GITHUB_URL)}>
                <Icon name="star" size="sm" />
                Star on GitHub
              </button>
            </div>
            <div className="card ab-card">
              <span className="ic">
                <Icon name="share" size="lg" />
              </span>
              <h2>Tell a friend</h2>
              <p className="t-small muted">Know a seller who needs model photos? Send them the link.</p>
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(WEBSITE_URL);
                    toast("Link copied");
                  } catch {
                    toast(WEBSITE_URL, { icon: "link" });
                  }
                }}
              >
                <Icon name="copy" size="sm" />
                Copy link
              </button>
            </div>
          </section>
          <section style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
            <p className="t-small muted">
              Models, poses and scenes from the Aaina studio. Built with open-source libraries;{" "}
              <button className="btn-link" onClick={async () => (await api()).openUrl(GITHUB_URL)}>
                see the full list
              </button>
              .
            </p>
            <MoreOnAaina />
          </section>
        </div>
      </div>
      {coffee && <CoffeeDialog onClose={() => setCoffee(false)} />}
    </>
  );
}
