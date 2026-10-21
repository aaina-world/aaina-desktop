# Aaina Desktop

**Model photos of your products, made on your own computer. Free and open source.**

![Aaina Desktop home screen](docs/screenshots/home.png)

Add a photo of what you sell, pick a studio model, choose poses and a scene, and get photos you can use in your shop. There is no account to make. Your shoots, photos and models stay on your computer.

## Download

Get the latest version for your system from the [releases page](https://github.com/aaina-world/aaina-desktop/releases/latest):

- **Mac** (Apple silicon and Intel): the `.dmg` file
- **Windows**: the `.msi` or `-setup.exe` file
- **Linux**: the `.AppImage`, `.deb` or `.rpm` file

Builds are not signed yet, so your system may warn you the first time you open the app. On a Mac, try to open it once, then go to System Settings, Privacy and Security, and choose Open Anyway. On Windows, choose More info, then Run anyway.

## What it does

- Makes model photos of a product with a studio model, poses and a scene.
- Make again, Try again, Fix something and Other colours on any photo.
- Flat-lays and ghost mannequin photos.
- Your own poses, scenes and models (from a description, or from photos of a real adult who agrees).
- Saves JPEG or PNG, square and marketplace crops, with a shoot history you can search.

Videos, try-ons and listings are on paid [Aaina](https://aaina.world).

## What stays on your computer, and what is sent where

Everything you make is kept on your computer: shoots, photos, own models, settings. Your OpenAI key is kept in your system keychain.

- **OpenAI** gets your product photos, plus the model, pose and scene for each photo, so it can make the photo. It is sent with your own key.
- **Aaina** gets nothing from you. The app only downloads the public catalogue of studio models, poses and scenes.
- **No tracking in the app.** No analytics, no accounts, no ads.

More in [PRIVACY.md](PRIVACY.md).

## Cost

Photos are made with your own OpenAI account, and OpenAI bills you directly. Roughly **$0.05 a photo**. The app shows the rough cost before every paid action. Aaina Desktop itself is free.

## Getting a key

1. Make or sign in to an account at [platform.openai.com](https://platform.openai.com).
2. Add a little credit under Billing.
3. Open API keys, make a new key and copy it.
4. Paste it in Aaina Desktop when it asks.

OpenAI may ask you to verify your organisation before it lets you make photos. That is a step on their side and usually quick. Sign in with ChatGPT is planned, but ChatGPT plans cannot make photos in other apps yet.

## Build from source

You need Node 20 or newer and Rust stable.

```
npm install
npm run tauri dev      # run the app
npm run tauri build    # make an installer
```

On Linux, Tauri needs a few system packages (webkit2gtk-4.1, libsecret and others). See the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Contributing

Ideas, bug reports and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Support the project

Aaina Desktop is free. If it saves you time, you can [buy me a coffee](https://buymeacoffee.com/aaina.world), sponsor on [GitHub Sponsors](https://github.com/sponsors/aaina-world), or just star the repository.

## Licence

The code is MIT licensed ([LICENSE](LICENSE)). The studio models, poses and scenes belong to Aaina and are licensed only for use inside Aaina Desktop. See [CATALOGUE-TERMS.md](CATALOGUE-TERMS.md). The photos you make are yours.
