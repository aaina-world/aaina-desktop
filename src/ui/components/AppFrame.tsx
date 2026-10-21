import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";

/** The window layout: sidebar and the main column. Screens render a Topbar and a `.page` inside. */
export function AppFrame() {
  return (
    <div className="app">
      <Sidebar />
      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
