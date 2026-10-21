// Speaks the narration with OpenAI's speech model, one file per scene (paid, about $0.015 a minute):
//   OPENAI_API_KEY=… npx tsx docs/tools/demo/tts.ts [scene ids…]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NARRATION } from "./narration";

const OUT = join(import.meta.dirname, "out", "voice");
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const INSTRUCTIONS =
  "A warm, friendly, unhurried product walkthrough. Clear and natural, like explaining something useful to a friend who is starting a small business. No hype.";

for (const n of NARRATION) {
  if (only.length ? !only.includes(n.id) : existsSync(join(OUT, `${n.id}.mp3`))) continue;
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "coral", input: n.say, instructions: INSTRUCTIONS, response_format: "mp3" }),
  });
  if (!r.ok) throw new Error(`${n.id}: ${r.status} ${await r.text()}`);
  writeFileSync(join(OUT, `${n.id}.mp3`), new Uint8Array(await r.arrayBuffer()));
  console.log("spoke", n.id);
}
