import { Link, NavLink, useLocation } from "react-router";
import { api } from "../../lib/api";
import { useLoad } from "../hooks/useApi";
import { useOs } from "../hooks/useOs";
import { Icon, Logo, type IconName } from "./Icon";
import { COFFEE_URL } from "./links";
import type { Connection } from "../../lib/contract";

function chip(c: Connection | null): { i: IconName; t: string; s: string; dot: "ok" | "warn" } {
  if (!c) return { i: "chatgpt", t: "Connecting", s: "Checking your setup", dot: "warn" };
  const key = c.key.present;
  const bad = key && c.key.status !== "works" && c.key.status !== "unknown";
  if (bad) return { i: "alert", t: "Key problem", s: "Open Settings to fix it", dot: "warn" };
  if (c.chatgpt.signedIn && key) return { i: "chatgpt", t: "Connected", s: "ChatGPT · OpenAI key", dot: "ok" };
  if (c.chatgpt.signedIn) return { i: "chatgpt", t: "ChatGPT only", s: "Add a key to make photos", dot: "warn" };
  if (key) return { i: "key", t: "OpenAI key", s: `sk-…${c.key.last4 ?? ""}`, dot: "ok" };
  return { i: "alert", t: "Not connected", s: "Connect to make photos", dot: "warn" };
}

export function Sidebar() {
  const { mod } = useOs();
  const loc = useLocation().pathname;
  const shoots = useLoad((a) => a.shoots(), [], ["shoot"]);
  const conn = useLoad((a) => a.connection(), [], ["connection"]);
  const c = chip(conn.data);
  const count = shoots.data?.length;
  const cur = (on: boolean) => (on ? ({ "aria-current": "page" } as const) : {});
  const shootsOn = loc.startsWith("/shoots") || loc.startsWith("/photo");
  const libraryOn = loc.startsWith("/library") || loc.startsWith("/models");

  return (
    <aside className="sidebar" aria-label="Main">
      <Link className="brand" to="/">
        <Logo />
        <span className="brand-stack">
          <span className="brand-word">AAINA</span>
          <span className="brand-sub">Desktop</span>
        </span>
      </Link>
      <div className="sidebar-cta">
        <Link className="btn btn-primary btn-block" to="/create/new" title="New shoot">
          <Icon name="plus" />
          <span className="nl">New shoot</span>
          <span className="kbd-hint">{mod === "⌘" ? "⌘N" : "Ctrl+N"}</span>
        </Link>
      </div>
      <nav className="nav">
        <NavLink to="/" end title="Home" {...cur(loc === "/")}>
          <Icon name="home" />
          <span className="nl">Home</span>
        </NavLink>
        <NavLink to="/shoots" title="Shoots" {...cur(shootsOn)}>
          <Icon name="images" />
          <span className="nl">Shoots</span>
          {count != null && <span className="count">{count}</span>}
        </NavLink>
        <NavLink to="/library" title="Library" {...cur(libraryOn)}>
          <Icon name="layers" />
          <span className="nl">Library</span>
        </NavLink>
        <div className="nav-label t-eyebrow">App</div>
        <NavLink to="/settings" title="Settings" {...cur(loc.startsWith("/settings") || loc.startsWith("/about"))}>
          <Icon name="settings" />
          <span className="nl">Settings</span>
        </NavLink>
      </nav>
      <div className="sidebar-foot">
        <button
          className="coffee"
          title="Aaina Desktop is free. A coffee keeps it that way."
          onClick={async () => (await api()).openUrl(COFFEE_URL)}
        >
          <Icon name="coffee" />
          <span className="meta">
            <span className="t">Buy me a coffee</span>
            <span className="s">Keeps Aaina Desktop free</span>
          </span>
        </button>
        <Link className="conn-chip" to="/settings#connection" title="Connection">
          <span className="ci">
            <Icon name={c.i} />
            <span className={"cdot " + c.dot} />
          </span>
          <span className="meta">
            <span className="t">{c.t}</span>
            <span className="s">{c.s}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
