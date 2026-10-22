# Store packages

Aaina Desktop in three free stores. Everything here is ready to submit; nothing has been submitted yet.

| Store | System | People install with | Files |
|---|---|---|---|
| [Flathub](https://flathub.org) | Linux (every distribution) | Software / Discover, or `flatpak install flathub world.aaina.AainaDesktop` | `flathub/` |
| [winget](https://learn.microsoft.com/windows/package-manager/) | Windows 10 and 11 | `winget install AainaWorld.AainaDesktop` | `winget/manifests/…` |
| Homebrew, our own tap | Mac | `brew install aaina-world/tap/aaina-desktop` | `homebrew/Casks/aaina-desktop.rb` |

The **Store packages** workflow (`.github/workflows/packaging.yml`) installs each package on a fresh machine, runs the store's own checks, opens the app and keeps a screenshot. Run it before every submission.

## After each release

```bash
node packaging/update.mjs 0.1.3
```

This points all three at the new release (download links and checksums from GitHub, a Flathub release note from `CHANGELOG.md`). Commit it, let the workflow pass, then send each store its update as below.

## Submitting

Each store takes a pull request on GitHub, from a GitHub account. The account's name is public on the pull request, so use one that doesn't name you.

### Flathub (Linux)

1. Fork https://github.com/flathub/flathub and make a branch from its `new-pr` branch.
2. Add `world.aaina.AainaDesktop.yml` and `world.aaina.AainaDesktop.metainfo.xml` from `flathub/` at the top level.
3. Open a pull request to `new-pr` titled `Add world.aaina.AainaDesktop`. Flathub's reviewers build it and may ask questions; answers are usually about the permissions (network for OpenAI and the catalogue, the keyring for the key, Pictures and Downloads for photos).
4. Once accepted, Flathub creates `github.com/flathub/world.aaina.AainaDesktop`. Updates are pull requests there with the files from `update.mjs`.
5. To get the "verified" tick: Flathub gives a token to put at `https://aaina.world/.well-known/org.flathub.VerifiedApps.txt`.

### winget (Windows)

1. Fork https://github.com/microsoft/winget-pkgs.
2. Copy the folder `winget/manifests/a/AainaWorld/AainaDesktop/<version>/` to the same path in the fork.
3. Open a pull request titled `New package: AainaWorld.AainaDesktop version <version>`. A bot validates it, installs it in a sandbox and scans it; the first time, sign Microsoft's contributor agreement when the bot asks.
4. Updates: the same, with the new version folder (title `New version: …`).

### Homebrew (Mac)

Homebrew's main list only accepts signed and notarised apps, so the cask lives in our own tap:

1. Create a public repository `aaina-world/homebrew-tap` with the cask at `Casks/aaina-desktop.rb`.
2. People then run `brew install aaina-world/tap/aaina-desktop`.
3. Updates: copy the cask from `update.mjs` into the tap.

The cask keeps macOS's own check: until the app is signed, people approve it once with Open Anyway (the cask's caveats say how), the same as with the download.
