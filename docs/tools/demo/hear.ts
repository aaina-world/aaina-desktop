// Transcribes narration files back to text, to check what was actually said (paid, a fraction of a cent).
import { readFileSync } from "node:fs";
import { join } from "node:path";
for (const id of process.argv.slice(2)) {
  const form = new FormData();
  form.set("model", "gpt-4o-mini-transcribe");
  form.set("file", new Blob([readFileSync(join(import.meta.dirname, "out", "voice", `${id}.mp3`))], { type: "audio/mpeg" }), `${id}.mp3`);
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  console.log(id, ":", ((await r.json()) as { text?: string }).text);
}
