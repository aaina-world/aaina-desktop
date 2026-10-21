// Every file function the app imports from the fs plugin must be allowed in the window's capability, or it fails at
// run time inside the app only (the catalogue once couldn't be saved because writeTextFile wasn't allowed).
import { describe, expect, it } from "vitest";
import capability from "../../src-tauri/capabilities/default.json";

const sources = import.meta.glob<string>(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe("Tauri capabilities", () => {
  it("allow every fs function the source uses", () => {
    const used = new Set<string>();
    for (const text of Object.values(sources))
      for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*"@tauri-apps\/plugin-fs"/g))
        for (const part of m[1].split(",")) {
          const name = part.trim().split(/\s+as\s+/)[0];
          if (name && !name.startsWith("type ")) used.add(name);
        }
    const allowed = new Set(capability.permissions.filter((p): p is string => typeof p === "string"));
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((fn) => !allowed.has(`fs:allow-${kebab(fn)}`))).toEqual([]);
  });
});
