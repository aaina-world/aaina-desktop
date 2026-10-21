import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

/** Renders routes in a memory router at `at`, with a hidden marker showing the current address. */
export function renderRoutes(routes: Record<string, React.ReactNode>, at: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[state === undefined ? at : { pathname: at, state }]}>
      <Routes>
        {Object.entries(routes).map(([path, element]) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}
