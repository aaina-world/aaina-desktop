const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "21 Oct 2026" */
export function formatDate(iso: string | number | Date): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "21 Oct 2026, 9:58 pm" (never seconds) */
export function formatDateTime(iso: string | number | Date): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
}

/** "5 min ago", "2 h ago", "yesterday", else the date. */
export function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < 2 * 86_400_000) return "yesterday";
  return formatDate(iso);
}

export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
export const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const KIND_LABEL = { model: "On a model", "flat-lay": "Flat-lay", ghost: "Ghost mannequin" } as const;
