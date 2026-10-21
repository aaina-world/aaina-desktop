// End to end on the real, installed app (Windows and Linux), through tauri-driver's WebDriver server on :4444.
// No OpenAI key is needed: the key check goes to OpenAI for real and must be refused. Screenshots go to e2e-app/out.
//   node e2e-app/run.mjs <path to the app>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP = process.argv[2];
const DRIVER = "http://127.0.0.1:4444";
const OUT = join(import.meta.dirname, "out");
mkdirSync(OUT, { recursive: true });
const ELEMENT = "element-6066-11e4-a6e6-4ed1-8e55-ab2f6e4a9b77";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wd(method, path, body) {
  const r = await fetch(DRIVER + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${j?.value?.message ?? r.status}`);
  return j.value;
}

let session;
const start = async () => {
  const s = await wd("POST", "/session", { capabilities: { alwaysMatch: { browserName: "wry", "tauri:options": { application: APP } } } });
  session = s.sessionId;
};
const quit = () => wd("DELETE", `/session/${session}`);
const run = (script, ...args) => wd("POST", `/session/${session}/execute/sync`, { script, args });
let step = 0;
async function shot(name) {
  const png = await wd("GET", `/session/${session}/screenshot`);
  writeFileSync(join(OUT, `${String(++step).padStart(2, "0")}-${name}.png`), Buffer.from(png, "base64"));
}
const text = () => run("return document.body.innerText");

/** Waits until `check` (a function of the page text) is true. */
async function until(what, check, ms = 30_000) {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = await text().catch(() => "");
    if (check(last)) return last;
    await sleep(500);
  }
  await shot(`failed-${what.replace(/\W+/g, "-")}`).catch(() => undefined);
  throw new Error(`Timed out waiting for ${what}. The page said:\n${last.slice(0, 1500)}`);
}
const sees = (words, ms) => until(`"${words}"`, (t) => t.includes(words), ms);

/** Clicks the first visible button or link whose text starts with `label`. */
async function click(label) {
  const found = await run(
    `const want = arguments[0];
     const el = [...document.querySelectorAll("button, a, [role=tab]")].find((e) => e.offsetParent && e.innerText.trim().startsWith(want));
     if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true;`,
    label,
  );
  if (!found) {
    await shot(`missing-${label.replace(/\W+/g, "-")}`);
    throw new Error(`No "${label}" to click`);
  }
  await sleep(400);
}
async function type(selector, value) {
  const el = await wd("POST", `/session/${session}/element`, { using: "css selector", value: selector });
  await wd("POST", `/session/${session}/element/${el[ELEMENT]}/value`, { text: value });
}

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check("the first run starts on the welcome screen", async () => {
  await sees("Model photos of your", 60_000);
  await shot("welcome");
  await click("Get started");
});
check("a key OpenAI refuses is refused (the app reaches api.openai.com)", async () => {
  await sees("Connect");
  await type("#key", "sk-e2e-not-a-real-key-000000000000");
  await click("Check key");
  await until("OpenAI's answer", (t) => /didn't accept|couldn't reach/i.test(t), 45_000);
  const t = await text();
  if (!/didn't accept/i.test(t)) throw new Error("OpenAI could not be reached from the app");
  await shot("key-refused");
  await click("Skip for now");
});
check("the photos folder has a place, and setup finishes", async () => {
  await sees("Where should photos go?");
  const t = await text();
  if (!/Pictures|Aaina/.test(t)) throw new Error("No photos folder shown");
  await shot("folder");
  await click("Start using Aaina");
  await sees("What are we shooting today?");
});
check("the studio catalogue downloads", async () => {
  await until(
    "the catalogue",
    (t) => !t.includes("Getting the studio catalogue") && !/couldn't get the (studio )?catalogue/i.test(t),
    120_000,
  );
  await shot("home");
});
check("studio models show with their pictures", async () => {
  await click("Library");
  await click("Models");
  await sees("Studio models");
  await sleep(4000);
  const loaded = await run("return [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length");
  if (loaded < 8) throw new Error(`Only ${loaded} pictures loaded`);
  await shot("models");
});
check("a new shoot opens on the product step", async () => {
  await click("New shoot");
  await sees("Add your product");
  await shot("new-shoot");
});
check("settings open and the theme changes", async () => {
  await click("Settings");
  await sees("Connection");
  await click("Dark");
  await sleep(600);
  await shot("settings-dark");
  await click("Light");
});
check("after quitting and opening again, setup is remembered", async () => {
  await quit();
  await sleep(2000);
  await start();
  await sees("What are we shooting today?", 60_000);
  await shot("reopened");
});

await start();
let failed = 0;
for (const c of checks) {
  try {
    await c.fn();
    console.log(`ok   ${c.name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${c.name}\n     ${String(e.message).split("\n").join("\n     ")}`);
    break; // later checks build on this one
  }
}
await quit().catch(() => undefined);
console.log(failed ? `${failed} check failed` : `all ${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
