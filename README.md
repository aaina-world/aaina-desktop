# Aaina Desktop

**Model photos of your products, made on your own computer. Free and open source.**

![A finished shoot in Aaina Desktop](docs/screenshots/shoot.webp)

Add a photo of what you sell, pick a studio model, choose poses and a scene, and get photos you can use in your shop. There is no account to make. Your shoots, photos and models stay on your computer.

**New here?** The [tutorials](docs/tutorials/README.md) walk through everything in a few minutes each, and there is a short [demo video](https://desktop.aaina.world/tutorials#video).

## Why this exists

Good product photos sell, but a photoshoot with a model, a studio and a photographer is out of reach for most people starting out. [Aaina](https://aaina.world) makes those photos with AI. We used AI to build Aaina Desktop: a part of Aaina, rebuilt as a free, open-source app, so that anyone starting a business, or anyone without the money for photoshoots or subscriptions, can have studio-quality photos of what they sell from day one.

There is no subscription and nothing to buy from us. You bring your own OpenAI account and pay OpenAI only for the photos you make, a few cents each. The studio models, poses and scenes come with the app, and everything you make stays on your computer.

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

## ChatGPT and your OpenAI key

- **Sign in with ChatGPT** (optional): every reading (your product, a pose in a photo, the checks on a model you make) uses your ChatGPT plan, at no cost to your key.
- **Your OpenAI key**: makes the photos, poses, scenes and models, billed by OpenAI. Without ChatGPT it also does the readings (a fraction of a cent each). If ChatGPT can't answer, the key reads instead.

ChatGPT plans can't make pictures in other apps yet; photos switch over when OpenAI allows it.

## Getting a key

1. Make or sign in to an account at [platform.openai.com](https://platform.openai.com). It is OpenAI's developer site, separate from a ChatGPT subscription.
2. Add a little credit under Billing. $5 is about 100 standard photos.
3. Open [API keys](https://platform.openai.com/api-keys), make a new key and copy it.
4. Paste it in Aaina Desktop when it asks, and press Check key.

More in [Getting started](docs/tutorials/01-getting-started.md).

OpenAI may ask you to verify your organisation before it lets you make photos. That is a step on their side and usually quick.

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
