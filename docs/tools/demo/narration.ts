// The demo video's script: what is said (`say`) and what the caption shows (`text`), one entry per scene.
export const NARRATION = [
  {
    id: "intro",
    text: "Aaina Desktop: model photos of what you sell, made on your own computer. Free and open source.",
    say: "This is Aaina Desktop. A free, open source app that makes model photos of the things you sell, right on your own computer.",
  },
  {
    id: "why",
    text: "We used AI to build a part of Aaina's studio as a free app, for everyone starting a business without a photoshoot budget.",
    say: "We used A.I. to rebuild a part of the Aaina studio as a free app, so anyone starting a business, even without money for photoshoots, can have studio photos from day one.",
  },
  {
    id: "connect",
    text: "Photos are made by OpenAI with your own account. You pay OpenAI a few cents a photo, and nothing to us.",
    say: "Photos are made by OpenAI, with your own account. You pay OpenAI a few cents a photo, and nothing to us. That's how the app stays free.",
  },
  {
    id: "chatgpt",
    text: "Sign in with ChatGPT: every reading, like what your product is, uses your ChatGPT plan, at no cost to your key.",
    say: "If you have ChatGPT, sign in. Then every reading, like working out what your product is, uses your ChatGPT plan, at no cost to your key.",
  },
  {
    id: "keyhow",
    text: "Get a key: platform.openai.com, add a little credit, then API keys, Create new secret key, and copy it.",
    say: "To make photos, you need an OpenAI key. Go to platform dot open A.I. dot com. Add a little credit: five dollars is about a hundred photos. Then open A.P.I. keys, create a new secret key, and copy it.",
  },
  {
    id: "key",
    text: "Paste the key and press Check key. It stays in your keychain and is only sent to OpenAI.",
    say: "Paste it here, and press Check key. It stays in your computer's keychain, and is only ever sent to OpenAI.",
  },
  {
    id: "folder",
    text: "Choose where photos are kept, and keep the studio catalogue for offline use.",
    say: "Choose where your photos are kept, and keep the studio catalogue on your computer, to browse it offline.",
  },
  {
    id: "product",
    text: "Add a photo of your product. The app reads it and shows what it sees.",
    say: "Now, a shoot. Add a photo of your product. One clear photo is enough. The app reads it, and shows what it sees, so you can correct anything.",
  },
  {
    id: "model",
    text: "Pick a model. The best fits for your product come first.",
    say: "Pick a model. The best fits for your product come first, and you can search and filter hundreds more.",
  },
  {
    id: "poses",
    text: "Choose up to six poses. Each pose is one photo.",
    say: "Choose up to six poses. Each pose becomes one photo.",
  },
  {
    id: "scene",
    text: "Pick a scene: a studio, a place, a plain colour, or one you made.",
    say: "Pick a scene. A studio, a place in the world, a plain colour, or one you made yourself.",
  },
  {
    id: "review",
    text: "The price is shown before anything is sent: about $0.05 a photo, $0.20 at high quality.",
    say: "Review shows the price before anything is sent. About five cents a photo, or twenty cents at high quality.",
  },
  {
    id: "make",
    text: "Press Make. Photos arrive in about a minute each.",
    say: "Press Make, and your photos arrive in about a minute.",
  },
  {
    id: "viewer",
    text: "Compare with your product, Make again, Fix something in plain words, or try Other colours.",
    say: "Open a photo to check it against your product. Make it again, fix one small thing in plain words, or try it in other colours.",
  },
  {
    id: "save",
    text: "Save as JPEG or PNG, in each marketplace's shape. Every photo is marked as AI-made inside the file.",
    say: "Save it as a high quality JPEG or PNG, in the shape each marketplace wants. Every photo is marked as A.I. made, inside the file.",
  },
  {
    id: "ghost",
    text: "No model needed? Ghost mannequin and flat-lay photos from the same product photo.",
    say: "No model needed? Make ghost mannequin photos, or flat lays, from the same product photo.",
  },
  {
    id: "ownmodel",
    text: "Create your own model from a description, or from photos of a real adult who agrees.",
    say: "You can also create your own model. Describe a person and pick a face, or use photos of a real adult who agrees. A reference sheet keeps them the same in every photo.",
  },
  {
    id: "ownpose",
    text: "Make your own poses and scenes, in words or from a photo.",
    say: "Make your own poses and scenes, in words, or from a photo.",
  },
  {
    id: "settings",
    text: "Everything stays on your computer. Back up and restore in Settings. No account, no tracking.",
    say: "Everything stays on your computer. Back it up, and restore it, in Settings. There's no account, and no tracking.",
  },
  {
    id: "end",
    text: "Free and open source. desktop.aaina.world",
    say: "Aaina Desktop is free and open source. Get it at desktop dot aaina dot world.",
  },
] as const;
export type SceneId = (typeof NARRATION)[number]["id"];
