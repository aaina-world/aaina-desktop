import { CDN_BASE } from "./raw";

/** Widths the CDN has for every picture. */
export const WIDTHS = [320, 480, 640, 1080] as const;
export const CARD_WIDTH = 640;
export const ENGINE_WIDTH = 1080;

const KNOWN = /(img\/[0-9a-f]{64}-\d+\.webp|sheets\/[0-9a-f]{64}\.webp)(?:\?.*)?$/i;

/**
 * The CDN-relative path (`img/<sha>-<w>.webp` or `sheets/<sha>.webp`) behind any address we have handed out: a relative
 * path from a list, the CDN URL, or the asset: URL of a cached copy. Null for anything else.
 */
export function catalogRelative(address: string): string | null {
  let text = address;
  try {
    text = decodeURIComponent(address);
  } catch {
    /* keep as is */
  }
  return KNOWN.exec(text)?.[1] ?? null;
}

/** The same picture at another width (`img/<sha>-1080.webp` → `img/<sha>-640.webp`); sheets have one size. */
export function atWidth(relative: string, width: number): string {
  return relative.startsWith("img/") ? relative.replace(/-\d+\.webp$/, `-${width}.webp`) : relative;
}

export const cdnUrl = (relative: string) => (/^https?:/.test(relative) ? relative : CDN_BASE + relative.replace(/^\/+/, ""));
