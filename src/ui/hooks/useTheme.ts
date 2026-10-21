import { useEffect } from "react";
import type { Settings } from "../../lib/contract";

/** Applies settings.theme to html[data-theme]; "system" removes it so the OS preference decides. */
export function applyTheme(theme: Settings["theme"] | undefined) {
  const r = document.documentElement;
  if (theme === "light" || theme === "dark") r.dataset.theme = theme;
  else delete r.dataset.theme;
}

export function useTheme(theme: Settings["theme"] | undefined) {
  useEffect(() => applyTheme(theme), [theme]);
}
