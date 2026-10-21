# Aaina Desktop: architecture

Aaina Desktop makes model photos of a seller's products on their own computer. It is a Tauri 2 app: a React web view
does almost everything; a small Rust side gives it the system keychain and native plugins. There is no Aaina account
and no Aaina server call except reading the public studio catalogue.

## What talks to what

```
React screens (src/ui)
   │  only through the Api interface (src/lib/contract.ts)
   ▼
src/lib/api.ts ── in the app: src/lib/real/ (data + engine)   in a plain browser: src/lib/mock/ (sample data, no network)
   │
   ├─ src/lib/data/      SQLite (tauri-plugin-sql), files on disk (tauri-plugin-fs), settings, keychain (Rust commands)
   ├─ src/lib/catalog/   Aaina's public catalogue: https://static.aaina.world/catalog/current.json (models, poses, scenes)
   │                     and catalog/sheets/current.json (full reference sheets); cached in the app data folder
   └─ src/lib/engine/    OpenAI: product reading, photos, edits, own poses / scenes / models; the photo queue
```

Network goes only to `static.aaina.world` (catalogue), `api.openai.com` (key), the ChatGPT sign-in hosts, and
`api.github.com` (update check). The Content-Security-Policy in `src-tauri/tauri.conf.json` and the http plugin scope in
`src-tauri/capabilities/default.json` enforce this; a new host needs both changed.

## Folders and who owns them

| Folder | What |
|---|---|
| `src/lib/contract.ts` | Types and the `Api` interface. Shared; changed only by agreement. |
| `src/lib/data/` | Database schema and migrations (`migrations.ts`, numbered, never edited once shipped), repositories, files, settings, secrets. |
| `src/lib/catalog/` | Catalogue download, cache and lookup; model suggestion order. |
| `src/lib/engine/` | OpenAI client, prompts (ported from Aaina, kept short), the photo queue, image helpers (canvas). |
| `src/lib/real/` | Puts data + catalogue + engine together into an `Api`. |
| `src/lib/mock/` | A full in-memory `Api` with sample data, so every screen runs in a plain browser (`npm run dev`). |
| `src/ui/` | Screens and components. Styles are Aaina's design system `src/ui/styles/ds.css` + `desktop.css` (copied from `design/assets`), with the same class names as the mockups in `design/pages`. |
| `src-tauri/` | Rust: plugins and `secrets.rs` (keychain). |
| `design/` | The approved static mockups. The app must match them. |

## Rules

- **Money:** before any OpenAI call that may charge, the photo row is saved as `sending`. If the app closes or the network
  drops, it becomes `interrupted` ("OpenAI may have charged for this one") and is never sent again automatically. A refusal is
  `failed` with `charged: "no"`. Every paid action shows `ESTIMATE_USD` before it starts.
- **Secrets:** the OpenAI key and sign-in tokens live only in the system keychain (`secret_get/secret_set/secret_delete`),
  never in SQLite, files, logs or error messages.
- **Files:** finished photos are PNG files in `<photosFolder>/<shoot name>/`; product photos, own models, poses and scenes
  and cached catalogue pictures live in the app data folder. Paths stored relative to their root.
- **Words on screen:** Aaina's glossary (photo, scene, Make again, Try again, Fix something, Other colours, version,
  product reading), sentence case, no em dashes, engine names never shown.
- **Prompts:** ported from Aaina's code and kept short. Longer descriptions make photos less accurate.
