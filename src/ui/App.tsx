import { useEffect, useState } from "react";
import { createHashRouter, Outlet, RouterProvider, useLocation, useNavigate } from "react-router";
import { api, inApp } from "../lib/api";
import { AppFrame } from "./components/AppFrame";
import { BareFrame } from "./components/BareFrame";
import { ShortcutsDialog } from "./components/dialogs";
import { ToastHost } from "./components/Toast";
import { applyOs, applyTheme, isMod, useSettings, useStartShoot, useUpdateCheckOnStart } from "./hooks";
import { AboutScreen } from "./screens/about";
import { ConnectScreen } from "./screens/connect";
import { CreateScreen } from "./screens/create";
import { HomeScreen } from "./screens/home";
import { LibraryScreen } from "./screens/library";
import { ModelCreateScreen, ModelScreen } from "./screens/models";
import { SettingsScreen } from "./screens/settings";
import { SetupScreen } from "./screens/setup";
import { ShootScreen } from "./screens/shoot";
import { ShootsScreen } from "./screens/shoots";
import { DropOverlay, NotFoundScreen } from "./screens/states";
import { ViewerScreen } from "./screens/viewer";
import { WelcomeScreen } from "./screens/welcome";
import "./components/components.css";
import "./screens/screens.css";

applyOs();

const FIRST_RUN = ["/welcome", "/connect", "/setup"];

/** Everything that belongs to the window rather than a screen: theme, shortcuts, drag and drop, first run. */
function Root() {
  const navigate = useNavigate();
  const loc = useLocation().pathname;
  const { settings } = useSettings();
  const start = useStartShoot();
  const [dragging, setDragging] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const onboarded = settings?.onboarded;

  useEffect(() => applyTheme(settings?.theme), [settings?.theme]);
  useUpdateCheckOnStart(inApp && !!onboarded && !!settings?.autoUpdate);

  // First run: until onboarding is finished, every address leads to the welcome screen.
  useEffect(() => {
    if (settings && !settings.onboarded && !FIRST_RUN.includes(loc)) void navigate("/welcome", { replace: true });
  }, [settings, loc, navigate]);

  // Keyboard: new shoot, search, settings, shortcuts.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest("input, textarea, select");
      if (!onboarded) return;
      if (isMod(e) && !e.shiftKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "n") {
          e.preventDefault();
          void navigate("/create/new");
        } else if (k === ",") {
          e.preventDefault();
          void navigate("/settings");
        } else if (k === "k") {
          e.preventDefault();
          const ev = new Event("aaina:focus-search", { cancelable: true });
          if (window.dispatchEvent(ev)) {
            void navigate("/shoots");
            setTimeout(() => window.dispatchEvent(new Event("aaina:focus-search", { cancelable: true })), 120);
          }
        }
      } else if (e.key === "?" && !typing && !document.querySelector(".scrim")) setShortcuts(true);
    };
    const open = () => setShortcuts(true);
    window.addEventListener("keydown", key);
    window.addEventListener("aaina:shortcuts", open);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("aaina:shortcuts", open);
    };
  }, [navigate, onboarded]);

  // Drag product photos anywhere onto the window to start a new shoot (the desktop app only).
  useEffect(() => {
    if (!inApp || !onboarded) return;
    let off: (() => void) | undefined;
    let dead = false;
    import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview()
          .onDragDropEvent((ev) => {
            const p = ev.payload;
            if (p.type === "enter" || p.type === "over") setDragging(true);
            else if (p.type === "leave") setDragging(false);
            else if (p.type === "drop") {
              setDragging(false);
              if (p.paths.length) start(p.paths);
            }
          })
          .then((u) => (dead ? u() : (off = u))),
      )
      .catch(() => undefined);
    return () => {
      dead = true;
      off?.();
    };
  }, [onboarded, start]);

  // Learn the photo queue is running before the first screen asks for anything.
  useEffect(() => {
    void api();
  }, []);

  if (!settings) return <div className="app-boot" />;
  return (
    <>
      <Outlet />
      <ToastHost />
      {dragging && <DropOverlay />}
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
    </>
  );
}

const router = createHashRouter([
  {
    element: <Root />,
    children: [
      {
        element: <BareFrame />,
        children: [
          { path: "/welcome", element: <WelcomeScreen /> },
          { path: "/connect", element: <ConnectScreen /> },
          { path: "/setup", element: <SetupScreen /> },
        ],
      },
      { path: "/photo/:id", element: <ViewerScreen /> },
      {
        element: <AppFrame />,
        children: [
          { path: "/", element: <HomeScreen /> },
          { path: "/shoots", element: <ShootsScreen /> },
          { path: "/shoots/:id", element: <ShootScreen /> },
          { path: "/settings", element: <SettingsScreen /> },
          { path: "/about", element: <AboutScreen /> },
          { path: "/create/new", element: <CreateScreen /> },
          { path: "/create/:shootId/:step", element: <CreateScreen /> },
          { path: "/library", element: <LibraryScreen /> },
          { path: "/library/:tab", element: <LibraryScreen /> },
          { path: "/models/new", element: <ModelCreateScreen /> },
          { path: "/models/:id", element: <ModelScreen /> },
          { path: "*", element: <NotFoundScreen /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
