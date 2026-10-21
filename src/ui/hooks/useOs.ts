import { useState } from "react";

export type Os = "mac" | "win" | "linux";

export function detectOs(): Os {
  if (typeof navigator === "undefined") return "mac";
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad/i.test(ua)) return "mac";
  if (/Win/i.test(ua)) return "win";
  return "linux";
}

/** Sets html[data-os] once (call from the root). */
export function applyOs(): Os {
  const os = detectOs();
  document.documentElement.dataset.os = os;
  return os;
}

/** The operating system, plus the words and keys that differ by system. */
export function useOs() {
  const [os] = useState<Os>(() => detectOs());
  const mac = os === "mac";
  return {
    os,
    mac,
    /** "⌘" on a Mac, "Ctrl+" elsewhere. */
    mod: mac ? "⌘" : "Ctrl+",
    /** "Show in Finder" / "Show in Explorer" / "Show in Files". */
    showInFolder: mac ? "Show in Finder" : os === "win" ? "Show in Explorer" : "Show in Files",
  };
}

/** True when the key event carries the system's command key (⌘ on Mac, Ctrl elsewhere). */
export function isMod(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return detectOs() === "mac" ? e.metaKey : e.ctrlKey;
}
