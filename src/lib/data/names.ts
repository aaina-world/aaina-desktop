// Pure helpers for file and folder names.

/** A name safe on Mac, Windows and Linux: no slashes or reserved characters, no leading dots, never empty. */
export function safeName(name: string, fallback = "Untitled"): string {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 80)
    .trim();
  if (!cleaned) return fallback;
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cleaned) ? `${cleaned}_` : cleaned;
}

/** `Title-v2.png`, or `Title-v2 (2).png` when that name is taken. */
export function uniqueName(base: string, extension: string, taken: (name: string) => boolean): string {
  let name = `${base}.${extension}`;
  for (let n = 2; taken(name); n++) name = `${base} (${n}).${extension}`;
  return name;
}

export const photoFileBase = (title: string, version: number) => `${safeName(title, "Photo")}-v${version}`;

export function extensionOf(path: string, fallback = "jpg"): string {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(path);
  return match ? match[1].toLowerCase() : fallback;
}

export const baseNameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;
