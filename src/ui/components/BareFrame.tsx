import { Outlet } from "react-router";

/** First-run screens: no sidebar. A strip at the very top lets a Mac user drag the window. */
export function BareFrame() {
  return (
    <>
      <div className="drag-strip" data-tauri-drag-region />
      <main className="main" id="main">
        <Outlet />
      </main>
    </>
  );
}
