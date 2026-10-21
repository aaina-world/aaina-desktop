// The demo video: the real screens in demo mode, a visible cursor, captions, and the spoken narration (docs/tools/demo/out/voice,
// made by tts.ts). Frames come from Chromium's screencast, so text stays sharp. Run from the repo root:
//   npx playwright test -c docs/tools/demo video
// It writes docs/tools/demo/out/aaina-desktop-demo.mp4.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { at, relayCatalog } from "./helpers";
import { NARRATION, type SceneId } from "./narration";

const OUT = join(import.meta.dirname, "out");
const FRAMES = join(OUT, "frames");
const VOICE = join(OUT, "voice");
const GAP = 0.6; // seconds of quiet after each line

const seconds = (file: string) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
const photo = (name: string) => readFileSync(join(OUT, `${name}.png`));

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 / 3 });
test.setTimeout(900_000);

/** Captions, a title card and a cursor drawn into the page; they stay across the app's hash navigation. */
async function installOverlay(page: Page) {
  await page.addInitScript(() => {
    const css = `
      #demo-cap{position:fixed;left:50%;bottom:112px;transform:translateX(-50%);max-width:880px;padding:14px 22px;border-radius:14px;
        background:rgba(22,22,21,.88);color:#fff;font:500 19px/1.45 "Geist Variable",system-ui,sans-serif;text-align:center;z-index:2147483646;
        box-shadow:0 12px 40px rgba(0,0,0,.25);transition:opacity .35s;pointer-events:none}
      #demo-cap:empty{opacity:0}
      #demo-card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:80px;
        background:#f7f7f5;color:#161615;z-index:2147483645;text-align:center;transition:opacity .5s;pointer-events:none}
      #demo-card.off{opacity:0}
      #demo-card h1{font:400 64px/1.05 "Bodoni Moda Variable",Georgia,serif;margin:0;max-width:1000px}
      #demo-card h1 em{font-style:italic}
      #demo-card p{font:400 22px/1.5 "Geist Variable",system-ui,sans-serif;color:#585853;margin:0;max-width:820px}
      #demo-card ol{font:400 22px/1.5 "Geist Variable",system-ui,sans-serif;color:#161615;text-align:left;margin:0;padding-left:1.4em;max-width:760px}
      #demo-card li{margin:8px 0}
      #demo-card code{font:500 20px "Geist Mono Variable",monospace;background:#efefec;padding:2px 8px;border-radius:6px}
      #demo-card .dot{width:10px;height:10px;border-radius:50%;background:#e09a1a}
      #demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(224,154,26,.35);
        border:2px solid #e09a1a;z-index:2147483647;pointer-events:none;transition:transform .12s}
      #demo-cursor.down{transform:scale(.7)}`;
    const ready = () => {
      if (document.getElementById("demo-cap")) return;
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
      const cap = document.createElement("div");
      cap.id = "demo-cap";
      const card = document.createElement("div");
      card.id = "demo-card";
      card.className = "off";
      const cursor = document.createElement("div");
      cursor.id = "demo-cursor";
      for (const el of [card, cap, cursor]) el.setAttribute("aria-hidden", "true");
      document.body.append(card, cap, cursor);
      addEventListener("mousemove", (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      });
      addEventListener("mousedown", () => cursor.classList.add("down"));
      addEventListener("mouseup", () => cursor.classList.remove("down"));
    };
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", ready);
    else ready();
  });
}

const caption = (page: Page, text: string) =>
  page.evaluate((t) => {
    document.getElementById("demo-cap")!.textContent = t;
  }, text);
const card = (page: Page, html: string | null) =>
  page.evaluate((h) => {
    const el = document.getElementById("demo-card")!;
    if (h) el.innerHTML = h;
    el.classList.toggle("off", !h);
  }, html);

/** Moves the cursor to an element, smoothly, and clicks it. */
async function click(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("Nothing to click");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await page.waitForTimeout(220);
  await target.click();
  await page.waitForTimeout(250);
}
async function type(page: Page, target: Locator, text: string) {
  await click(page, target);
  await target.pressSequentially(text, { delay: 28 });
}

test("demo video", async ({ page }) => {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  const length = Object.fromEntries(NARRATION.map((n) => [n.id, seconds(join(VOICE, `${n.id}.mp3`))])) as Record<SceneId, number>;
  const text = Object.fromEntries(NARRATION.map((n) => [n.id, n.text])) as Record<SceneId, string>;

  await relayCatalog(page);
  await installOverlay(page);
  await page.goto(at("/welcome", true));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Model photos of your products");
  await page.waitForLoadState("networkidle");
  await page.mouse.move(720, 450);

  // Chromium's screencast sends a frame whenever the page changes; each frame is shown until the next one.
  const frames: { t: number; file: string }[] = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on("Page.screencastFrame", (f: { data: string; sessionId: number; metadata: { timestamp: number } }) => {
    const file = join(FRAMES, `${String(frames.length).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ t: f.metadata.timestamp, file });
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1200, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const starts: { id: SceneId; at: number }[] = [];

  /** One line of narration: caption on, the actions, then wait until the line has been spoken. */
  async function scene(id: SceneId, actions: () => Promise<void> = async () => undefined) {
    const start = Date.now() / 1000;
    starts.push({ id, at: start - t0 });
    await caption(page, text[id]);
    await actions();
    const left = start + length[id] + GAP - Date.now() / 1000;
    if (left > 0) await page.waitForTimeout(left * 1000);
  }

  // ---- Why, and connecting OpenAI ----
  await scene("intro", async () => {
    await page.waitForTimeout(1500);
  });
  await scene("why", async () => {
    await caption(page, "");
    await card(
      page,
      `<span class="dot"></span><h1>Studio photos, <em>free</em>, for everyone starting out.</h1>
       <p>We used AI to rebuild a part of Aaina's studio as a free, open-source app, for anyone starting a business without a photoshoot budget.</p>`,
    );
  });
  await card(page, null);
  await scene("connect", async () => {
    await click(page, page.getByRole("link", { name: "Get started" }));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Connect OpenAI");
  });
  await scene("chatgpt", async () => {
    await page.waitForTimeout(1200);
    await click(page, page.getByRole("button", { name: /Sign in with ChatGPT/ }));
  });
  await scene("keyhow", async () => {
    await caption(page, "");
    await card(
      page,
      `<h1>Get an <em>OpenAI</em> key</h1>
       <ol>
         <li>Go to <code>platform.openai.com</code> and sign in.</li>
         <li>Billing: add a little credit. <b>$5 is about 100 photos.</b></li>
         <li>API keys: <b>Create new secret key</b>, and copy it.</li>
       </ol>
       <p>It's a separate account from a ChatGPT subscription; you can use the same email.</p>`,
    );
  });
  await card(page, null);
  await scene("key", async () => {
    await type(page, page.getByLabel("API key"), "sk-proj-••••••••••••••••••••••••");
    await click(page, page.getByRole("button", { name: "Check key" }));
    await expect(page.getByText("Key works. You can make photos.")).toBeVisible();
  });
  await scene("folder", async () => {
    await click(page, page.getByRole("link", { name: "Continue" }));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Where should photos go?");
  });

  // ---- A shoot ----
  await scene("product", async () => {
    await click(page, page.getByRole("button", { name: "Start using Aaina" }));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What are we shooting today?");
    await page.waitForTimeout(600);
    await click(page, page.getByRole("link", { name: /New shoot/ }).first());
    const chooser = page.waitForEvent("filechooser");
    await click(page, page.getByRole("button", { name: "Choose photos" }));
    await (await chooser).setFiles({ name: "emerald-slip-dress.png", mimeType: "image/png", buffer: photo("dress-product") });
    await expect(page.getByText("Read by ChatGPT")).toBeVisible();
    await page.mouse.wheel(0, 420);
  });
  await scene("model", async () => {
    await click(page, page.getByRole("link", { name: /Next: model/ }));
    await page.getByText(/Suggested for your/).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await click(page, page.getByRole("img", { name: "Chloe", exact: true }).first());
  });
  await scene("poses", async () => {
    await click(page, page.getByRole("link", { name: /Next: poses/ }));
    await click(page, page.getByText("Walking", { exact: true }).first());
    await click(page, page.getByText("Front view", { exact: true }).first());
    await click(page, page.getByRole("tab", { name: /^All/ }));
    await type(page, page.getByPlaceholder("Search poses"), "three-quarter");
    await click(page, page.getByText("Three-quarter, facing camera-left", { exact: true }).first());
  });
  await scene("scene", async () => {
    await click(page, page.getByRole("link", { name: /Next: scene/ }));
    await page.waitForTimeout(800);
    await click(page, page.getByRole("tab", { name: "Colour" }));
    await page.waitForTimeout(900);
    await click(page, page.getByRole("tab", { name: "Scenes" }));
    await type(page, page.getByLabel("Search scenes"), "studio");
    await click(page, page.getByRole("button", { name: /^Warm Minimal Arch Studio/ }));
  });
  await scene("review", async () => {
    await click(page, page.getByRole("link", { name: /Next: review/ }));
    await page.waitForTimeout(700);
    await click(page, page.getByRole("tab", { name: "High" }));
  });
  await scene("make", async () => {
    await click(page, page.getByRole("button", { name: /Make 3 photos/ }));
    await expect(page.getByText("Making your photo").first()).toBeVisible();
    await expect(page.getByText("Making your photo")).toHaveCount(0, { timeout: 60_000 });
  });
  const viewer = page.getByRole("dialog", { name: "Photo viewer" });
  await scene("viewer", async () => {
    await click(page, page.getByRole("article").filter({ hasText: "Ready" }).first().getByRole("link"));
    await expect(viewer).toBeVisible();
    await page.waitForTimeout(800);
    await click(page, viewer.getByRole("button", { name: "Compare with my product photo" }));
    await page.waitForTimeout(1500);
    await click(page, viewer.getByRole("button", { name: "Compare with my product photo" }));
    await click(page, viewer.getByRole("button", { name: /Fix something/ }));
    await type(page, viewer.getByLabel("What to fix"), "Make the straps a little thinner");
    await page.waitForTimeout(600);
    await click(page, viewer.getByRole("button", { name: "All tools" }));
    await click(page, viewer.getByRole("button", { name: /Other colours/ }));
  });
  await scene("save", async () => {
    await click(page, viewer.getByRole("button", { name: "All tools" }));
    await click(page, viewer.getByRole("button", { name: /Save photo…/ }));
    await page.waitForTimeout(900);
    await click(page, page.getByText("Amazon", { exact: true }));
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");

  // ---- More ----
  await scene("ghost", async () => {
    await page.goto(at("/create/new", true));
    await click(page, page.getByRole("tab", { name: "Ghost mannequin" }));
    await click(page, page.getByRole("button", { name: /Use a past product/ }));
    await page.waitForTimeout(700);
    await click(page, page.getByRole("dialog").locator(".tile.selectable").first());
    await click(page, page.getByRole("dialog").getByRole("button", { name: "Use this product" }));
    await page.waitForTimeout(600);
    await click(page, page.getByRole("link", { name: /Next/ }).last());
    await page.waitForTimeout(1000);
  });
  await scene("ownmodel", async () => {
    await page.goto(at("/models/new", true));
    await type(page, page.getByLabel(/^Name/), "Mira");
    await click(page, page.getByRole("button", { name: /Show me 3 faces/ }));
    await expect(page.getByRole("heading", { name: "Pick a face" })).toBeVisible({ timeout: 20_000 });
    await click(page, page.getByRole("button", { name: /Use this face/ }).nth(1));
    await expect(page.getByText("Making the reference sheet")).toHaveCount(0, { timeout: 30_000 });
  });
  await scene("ownpose", async () => {
    await page.goto(at("/library/poses", true));
    await click(page, page.getByRole("button", { name: /Make a pose/ }));
    await type(page, page.getByLabel("Describe the pose"), "Hands in pockets, leaning on one leg");
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await page.goto(at("/library/scenes", true));
    await click(page, page.getByRole("button", { name: /Make a scene/ }));
    await type(page, page.getByLabel("Describe the scene"), "A soft white studio with sheer curtains");
  });
  await page.keyboard.press("Escape");
  await scene("settings", async () => {
    await page.goto(at("/settings", true));
    await page.waitForTimeout(1200);
    await page.locator("section#data").evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  });
  await scene("end", async () => {
    await caption(page, "");
    await card(
      page,
      `<span class="dot"></span><h1>Aaina <em>Desktop</em></h1>
       <p>Free and open source, for Mac, Windows and Linux.</p>
       <p><code>desktop.aaina.world</code></p>`,
    );
  });
  await page.waitForTimeout(1500);

  await cdp.send("Page.stopScreencast");
  const end = Date.now() / 1000;

  // Frames to a constant 30 fps video: each frame is held until the next one arrives.
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(3)}`).join("\n");
  writeFileSync(join(OUT, "frames.txt"), `ffconcat version 1.0\n${list}\nfile '${frames[frames.length - 1].file}'\n`);
  const offset = frames[0].t - t0; // when the first frame was taken, against the narration clock
  const voices = starts.flatMap((s) => ["-i", join(VOICE, `${s.id}.mp3`)]);
  const delays = starts.map((s, i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round((s.at - offset) * 1000 + 300))}:all=1[a${i}]`);
  const mix = `${delays.join(";")};${starts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${starts.length}:normalize=0[voice]`;
  execFileSync("ffmpeg", [
    "-y",
    "-f", "concat", "-safe", "0", "-i", join(OUT, "frames.txt"),
    ...voices,
    "-filter_complex", `[0:v]fps=30,scale=1920:1200:flags=lanczos,format=yuv420p[v];${mix}`,
    "-map", "[v]", "-map", "[voice]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest",
    join(OUT, "aaina-desktop-demo.mp4"),
  ], { stdio: "inherit" });
});
