# Changelog

## 0.1.3 (22 Oct 2026)

Safety fixes from an independent review.

- The app can only use its own folders, your photos folder (Pictures/Aaina), Downloads, and files or folders you choose or drag onto the window. It no longer has access to your whole home folder. A folder you choose stays allowed after a restart.
- Restoring a backup can't choose where files go: its photos are copied into your current photos folder, nothing already there is overwritten, and a folder that isn't a real Aaina backup is refused.
- The studio catalogue can only save files inside its own cache folder.
- Photos are always drawn again before they are sent to OpenAI, so location, camera and date details in the file are never sent.
- "New version available" only ever opens this project's release page.
- Each release now has a SHA256SUMS.txt checksum list and GitHub's signed proof of where every file was built (check one with `gh attestation verify <file> -R aaina-world/aaina-desktop`). A release is only built after every check passes on that exact version.

## 0.1.2 (22 Oct 2026)

- Windows: no more sideways scrolling when the window is small. Windows' frame and scrollbar left less room than the screens needed.
- Every release now makes a real photo on fresh Windows and Linux machines before it is published.

## 0.1.1 (22 Oct 2026)

- Windows: staying signed in with ChatGPT works. The sign-in is longer than one Windows keychain entry holds, so it is now kept in parts.
- Linux: if the keyring (GNOME Keyring or KWallet) isn't running or is locked, the app says so in plain words instead of showing an error code.
- Every release is now installed and clicked through on fresh Windows and Linux machines before it is published.

## 0.1.0 (22 Oct 2026)

First public version: model photos of your products on your own computer.

- Shoots on a model: a product, a studio model, up to six poses and a scene, with the price shown before anything is sent.
- Ghost mannequin and flat-lay photos.
- Make again, Try again, Fix something, Other colours, and frame and expression per photo.
- Your own models (from a description or from photos of a real adult who agrees), poses and scenes, and plain colour scenes.
- Sign in with ChatGPT for readings, your own OpenAI key for photos; the key stays in the system keychain.
- Save as JPEG or PNG in marketplace shapes, marked as AI-made inside the file; a searchable shoot history, backup and restore.
- The studio catalogue kept for offline use, light and dark, and a check for new versions.
- [Tutorials](docs/tutorials/README.md) and a [demo video](https://desktop.aaina.world/tutorials#video).
