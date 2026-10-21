// "Check for updates": asks GitHub for the newest published release and compares versions. Installing stays a click on
// the release page until signed automatic updates are set up. No release yet (404) simply means "up to date".
export const RELEASES_API = "https://api.github.com/repos/aaina-world/aaina-desktop/releases/latest";

export type UpdateCheck = { kind: "latest" } | { kind: "newer"; version: string; url: string };
type Fetcher = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Compares dotted versions ("1.2.10" > "1.2.9"); a leading "v" and anything after "-" are ignored. */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (v: string) =>
    v
      .replace(/^v/i, "")
      .split("-")[0]
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export async function checkForUpdate(current: string, fetcher: Fetcher): Promise<UpdateCheck> {
  const response = await fetcher(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
  if (response.status === 404) return { kind: "latest" };
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const release = (await response.json()) as { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown };
  if (typeof release.tag_name !== "string" || typeof release.html_url !== "string" || release.draft || release.prerelease)
    return { kind: "latest" };
  // Only ever send people to this project's own release pages.
  if (!/^https:\/\/github\.com\/aaina-world\/aaina-desktop\/releases\/tag\/v?[\w.-]+$/.test(release.html_url)) return { kind: "latest" };
  return isNewer(release.tag_name, current)
    ? { kind: "newer", version: release.tag_name.replace(/^v/i, ""), url: release.html_url }
    : { kind: "latest" };
}
