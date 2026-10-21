// Asks an audio model how the brand name sounds in each file, without hinting at an answer.
import { readFileSync } from "node:fs";
for (const file of process.argv.slice(2)) {
  const q = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-audio",
      modalities: ["text"],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This clip names a desktop app. Describe exactly how the speaker pronounces the app's name (the word before 'Desktop'): give the syllables in a simple capital-letter respelling, for example the word banana would be buh-NAN-uh, and say how many syllables you hear. Reply in one short line.",
            },
            { type: "input_audio", input_audio: { data: readFileSync(file).toString("base64"), format: "mp3" } },
          ],
        },
      ],
    }),
  });
  const j = (await q.json()) as { choices?: { message?: { content?: string } }[]; error?: { message: string } };
  console.log(file.split("/").slice(-2).join("/"), "=>", j.choices?.[0]?.message?.content ?? j.error?.message);
}
