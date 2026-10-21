// Speaks the narration with OpenAI's speech model, one file per scene (paid, about $0.015 a minute):
//   OPENAI_API_KEY=… npx tsx docs/tools/demo/tts.ts [scene ids…]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NARRATION } from "./narration";

const OUT = join(import.meta.dirname, "out", "voice");
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const VOICE = "shimmer";
const INSTRUCTIONS =
  "Soft, gentle and warm, with a pleasant, smiling tone. Calm and unhurried, a little quieter than usual, like a kind guide showing a friend something useful for their new business. Natural pauses, no hype. The name 'Ayna' is pronounced EYE-nuh, two syllables, rhyming with 'China'.";

/** One line, asked again (up to 3 times) when OpenAI is slow to answer. */
async function speak(input: string): Promise<Uint8Array> {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: VOICE, input, instructions: INSTRUCTIONS, response_format: "mp3" }),
      });
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      if (attempt >= 3) throw e;
      console.log(`asking again (${(e as Error).message})`);
    }
  }
}

for (const n of NARRATION) {
  if (only.length ? !only.includes(n.id) : existsSync(join(OUT, `${n.id}.mp3`))) continue;
  writeFileSync(join(OUT, `${n.id}.mp3`), await speak(n.say));
  console.log("spoke", n.id);
}
