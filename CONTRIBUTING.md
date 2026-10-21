# Contributing

Thank you for helping. Pull requests are welcome, and so are small fixes and wording improvements.

## Run it

You need Node 22+ and Rust stable (and on Linux the [Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```
npm install
npm run dev            # the screens in a browser with sample data, no network
npm run tauri dev      # the real app
npm run check         # types, lint and the tests (also: npm run format, test:coverage, test:e2e)
```

## Where things live

| Folder | What |
|---|---|
| `src/lib/contract.ts` | Types and the `Api` interface the screens use. Change only by agreement. |
| `src/lib/data/` | Database schema and migrations (numbered, never edited once shipped), files, settings, keychain. |
| `src/lib/catalog/` | Catalogue download, cache, model suggestion order. |
| `src/lib/engine/` | OpenAI client, prompts, the photo queue, image helpers. |
| `src/lib/real/` | Puts data, catalogue and engine together. |
| `src/lib/mock/` | In-memory sample data so every screen runs in a browser. |
| `src/ui/` | Screens and components, in Aaina's design system. |
| `src-tauri/` | Rust: plugins and the keychain. |
| `design/` | The approved static mockups. The app should match them. |

See [ARCHITECTURE.md](ARCHITECTURE.md) for more.

## House rules

- **Words:** photo (not image or picture), scene (not backdrop), Make again, Try again, Fix something, Other colours, version, product reading. Sentence case. No em dashes in anything a person reads. Never show engine names; "OpenAI" and "ChatGPT" are fine.
- **Prompts stay short.** Longer descriptions make photos less accurate. Measure before lengthening one.
- **Money:** save the photo as `sending` before any call that may charge. If something was interrupted, it becomes `interrupted` and is never sent again automatically. Show the rough cost before every paid action.
- **Secrets** live only in the system keychain. Never in the database, files, logs or error messages.
- **Network:** a new host needs the Content-Security-Policy and the http plugin scope changed together.
- Check each changed screen at 1024 and 1600 px wide, light and dark.

## Pull requests

Keep them small, explain why, and make sure `npm run check` passes (and `npm run test:e2e` if you touched a screen). Please be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md).
