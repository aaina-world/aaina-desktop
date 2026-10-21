import type { Photo } from "../../lib/contract";

/** All versions of one planned shot, and which one to show. */
export type ShotGroup = {
  key: string;
  /** What the tile and viewer show: the newest finished version, else the newest one. */
  shown: Photo;
  /** Oldest first. */
  versions: Photo[];
  /** A newer version that isn't finished (making, queued, failed) while an older one is. */
  pending: Photo | null;
};

export function groupShots(photos: Photo[]): ShotGroup[] {
  const order: string[] = [];
  const map = new Map<string, Photo[]>();
  for (const p of photos) {
    if (!map.has(p.shotKey)) {
      map.set(p.shotKey, []);
      order.push(p.shotKey);
    }
    map.get(p.shotKey)!.push(p);
  }
  return order.map((key) => {
    const versions = map
      .get(key)!
      .slice()
      .sort((a, b) => a.version - b.version);
    const newest = versions[versions.length - 1];
    const lastDone = [...versions].reverse().find((v) => v.status === "done");
    const shown = lastDone ?? newest;
    return { key, shown, versions, pending: lastDone && newest.id !== lastDone.id && newest.status !== "done" ? newest : null };
  });
}

/** Plain words for why a photo wasn't made. Never engine names. */
export function failureText(p: Photo): { head: string; line: string } {
  const charged = p.error?.charged === "maybe" || p.status === "interrupted";
  const line = charged ? "OpenAI may have charged for this one." : "OpenAI wasn't charged.";
  if (p.status === "interrupted") return { head: "This photo was interrupted.", line };
  switch (p.error?.code) {
    case "CONTENT_REFUSED":
      return { head: "OpenAI's safety check declined this photo.", line };
    case "RATE_LIMITED":
      return { head: "OpenAI is busy right now.", line };
    case "NETWORK":
      return { head: "There was no internet connection.", line };
    case "NOT_CONNECTED":
      return { head: "Connect OpenAI to make photos.", line };
    case "KEY_REFUSED":
      return { head: "OpenAI didn't accept the key.", line };
    case "OUT_OF_CREDIT":
      return { head: "The OpenAI account is out of credit.", line };
    case "VERIFY_ORGANIZATION":
      return { head: "OpenAI wants the organisation verified.", line };
    default:
      return { head: "This photo couldn't be made.", line };
  }
}

export const isKeyProblem = (p: Photo) =>
  p.error?.code === "KEY_REFUSED" || p.error?.code === "OUT_OF_CREDIT" || p.error?.code === "VERIFY_ORGANIZATION";

/** 0 to 100, guessed from time since sending (a photo takes about 45 s). */
export function progressOf(p: Photo, now: number): number {
  if (p.status === "queued") return 6;
  if (!p.startedAt) return 10;
  return Math.min(92, 10 + ((now - new Date(p.startedAt).getTime()) / 45_000) * 82);
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "photo";
