# Aaina Desktop: design brief

Static HTML mockups of every screen of **Aaina Desktop**, a free, open-source desktop app (Mac, Windows, Linux) that makes model photos of a seller's products on their own computer. Nothing here is wired to anything.

## What the product is

- No Aaina account, no login, no credits, no payments. Everything (shoots, photos, own models, own poses and scenes, settings) is kept on the computer: a local database plus a normal photos folder (default `~/Pictures/Aaina`).
- The only things fetched from Aaina are the **studio catalogue**: models (with their 6-photo reference sheets), poses and scenes, from Aaina's public CDN. They are cached so browsing works offline after the first visit.
- AI is paid by the user: **Sign in with ChatGPT** (main path; today it covers product readings, and photos once OpenAI allows it) and **their own OpenAI key** (needed for photos until then). The key is kept in the system keychain and sent only to OpenAI.
- Every paid action shows its rough OpenAI cost before it starts, as a mono muted `.cost` ("about $0.05 a photo"; "High quality · about $0.20 a photo"). When ChatGPT covers it: "Uses your ChatGPT plan". Never "credits", never marigold for money.
- Free and open source. **Buy me a coffee** lives in the sidebar foot (already in the shell), Settings → About, and the About page. It never interrupts a flow, never a pop-up.
- Features: model photos (model → poses → scene → review, with Frame and Expression chips), Make again, Try again, Fix something, Other colours, flat-lays, ghost mannequin, own poses and own scenes (made with GPT Image), solid-colour scenes, own models (from a description: 3 face options then a sheet; or from 1 to 3 photos of a real adult with a consent tick), Save photo (JPEG / PNG, square and marketplace crops), Copy, Show in Finder / Explorer / Files, shoot history with search, delete, rename.
- **Not in the app** (paid Aaina only): videos, Try on me, listing writer, sharper downloads and cut-outs, templates, Explore, Shopify / Canva / ChatGPT. Where it helps, one quiet card or line: "Videos, try-ons and listings are on Aaina" with "Open aaina.world". Never more than one per screen, never on flows.
- Children's models are in the catalogue and work like every other model (typed words and own poses included); OpenAI's own checks apply to every photo.

## Files and how to build a page

- `assets/ds.css` is Aaina's real design system (Atelier). **Read it before writing**; use only its classes and tokens. `assets/desktop.css` adds the window chrome and desktop patterns (`.cost`, `.kbd`, `.local-note`, `.drop-overlay`, `.coffee`, `.conn-chip`).
- `assets/shell.js` draws the window chrome (Mac traffic lights / Windows title bar / Linux header bar, toggled in the mock bar), the sidebar (New shoot, Home, Shoots, Library, Settings, coffee, connection chip), icons (`<i data-i="name">`, names are the keys of `I` in shell.js), and generic toggles (tabs, segmented, chips, selectable tiles, `data-open` / `data-close` dialogs, switches).
- Every page starts:

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Screen name · Aaina Desktop</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="../assets/ds.css">
<link rel="stylesheet" href="../assets/desktop.css">
<script src="../assets/shell.js"></script>
<body data-nav="home|shoots|library|settings" [data-flow] [data-shell="bare"]>
<main class="main" id="main"> … </main>
```

- `data-shell="bare"` for the first-run screens (no sidebar; still gets the window chrome). `data-flow` for Create steps (keep the sidebar; sticky `.actionbar` at the bottom).
- Reference pages for markup and patterns: Aaina's web mockups (same CSS, kept in Aaina's private design repository). Adapt them, do not copy web-only things (credits, phone tab bar, `show-sm` phone variants, templates, explore, notifications bell, account/avatar, workspace switcher). `pages/home.html` in this folder is the finished desktop reference: match it.
- Images: `../assets/img/{models,poses,scenes,results,library,flatlay,ghost,start,templates}/…` (list the folder before using a file; never invent a file name).
- Desktop only: the window is never narrower than 1024 px. Design for 1280 × 800 and check 1024 × 700 and 1600 × 1000. No phone layouts, no `show-sm`.
- Desktop habits: keyboard shortcuts shown quietly (`<span class="kbd"><span data-mod>⌘</span>N</span>`; the shell swaps ⌘ for Ctrl+ on Windows/Linux), right-click menus shown as `.menu` where useful, "Show in Finder" text uses `<span data-folder>Show in Finder</span>` and paths use `<span data-path>~/Pictures/Aaina</span>` (the shell swaps them per system), drag and drop of photos anywhere.
- Mockup state switchers: like the Aaina pages, a `.notice.mockstrip` with a `.segmented` and `data-panels` / `data-panel-of` / `data-panel-id` to show other states (empty, loading, error) on the same page.

## House rules (from Aaina)

- Words: **photo** (never picture/image/output), **scene** (never backdrop), **Make again** (new version), **Try again** (after a failure), **version**, **Fix something**, **Other colours**, **product reading**. Sentence case. **No em dashes** anywhere in visible text. Plain, warm, short.
- Messages: slim `.notice` inline, `.field-error` under fields, toasts only to confirm an action with no visible result. No big warning boxes.
- One Bodoni display title per screen (`t-page` or `t-display`), at most one italic word. Geist for UI, Geist Mono for counts, sizes, costs, paths.
- Consistent heights in a row, no overflow, tiles the same size as their siblings, add-tiles the same size as their row.
- Every list has loading (skeleton), empty (dashed `.empty` with one action) and error states (show them via the mockup state switcher).
- Engine and model names (GPT Image, Seedream…) never appear. "OpenAI" and "ChatGPT" may appear because the user connects them.

## Checking your pages

`node design/tools-shot.mjs pages/x.html <outdir> 1280,1024 [dark] [win|linux]` screenshots a page and reports horizontal overflow. Look at every screenshot yourself (Read the PNG) in light and dark before finishing.
