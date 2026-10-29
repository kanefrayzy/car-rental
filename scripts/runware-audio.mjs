// Runware music and voice-over generation, budget-guarded like scripts/runware.mjs. Read the rules in /CLAUDE.md.
//
//   node scripts/runware-audio.mjs <name> --prompt "..." [--model runware:ace-step@v1.5-xl-sft]
//        [--duration 40] [--bpm 150] [--key "A minor"] [--approved]
//   node scripts/runware-audio.mjs <name> --model inworld:tts@1.5-max --voice Luna --text "..." [--speed 1] [--approved]
//
// - Voice-over (--voice and --text): Inworld TTS 1.5 Max (inworld:tts@1.5-max), $0.00005 a
//   character, 73 voices by first name; MiniMax Speech 2.8 (minimax:speech@2.8), voices such as
//   English_ManWithDeepVoice; Fish Audio S2.1 Pro (fishaudio:s2.1@pro), $0.000015 a byte, voices by
//   id, bracket cues like [excited]. All take speech.text and speech.voice. Inworld takes emotion
//   tags such as [happy] at the start of the text. Checked 2026-10-16.
//
// - ACE-Step 1.5 XL SFT (runware:ace-step@v1.5-xl-sft): billed by compute, about $0.003 for
//   30-60 s; duration 30-300 s; bpm and keyScale settings; instrumental = vocalLanguage "unknown"
//   and no lyrics. MiniMax Music 2.6 (minimax:music@2.6): $0.15 a track, settings.instrumental,
//   no duration or bpm parameter (put the tempo in the prompt). Checked 2026-10-16 on runware.ai/docs.
// - Without --approved it is a dry run. One track per call, one attempt, no retries.
// - Refuses to overwrite design/generated/audio/<name>.mp3; appends prompt + cost to scripts/generations.log.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://api.runware.ai/v1";

const args = process.argv.slice(2);
const name = args[0];
const one = (flag) => {
  const i = args.indexOf(`--${flag}`);
  return i === -1 ? undefined : args[i + 1];
};
const prompt = one("prompt");
const voice = one("voice");
const text = one("text");
const speed = one("speed") ? Number(one("speed")) : undefined;
const temperature = one("temperature") ? Number(one("temperature")) : undefined; // expressiveness (Inworld 0.1-2, Fish 0-1)
const model = one("model") ?? "runware:ace-step@v1.5-xl-sft";
const duration = Number(one("duration") ?? 40);
const bpm = one("bpm") ? Number(one("bpm")) : undefined;
const key = one("key");
const approved = args.includes("--approved");

if (!name || name.startsWith("--") || !(prompt || (voice && text))) {
  console.error('usage: node scripts/runware-audio.mjs <name> --prompt "..." [--model id] [--duration s] [--bpm n] [--key "A minor"] [--approved]');
  process.exit(1);
}
const outPath = join(root, "design", "generated", "audio", `${name}.mp3`);
if (existsSync(outPath)) {
  console.error(`refusing: ${outPath} already exists.`);
  process.exit(1);
}

const minimax = model.startsWith("minimax:");
const tts = Boolean(voice);
const task = {
  taskType: "audioInference",
  taskUUID: randomUUID(),
  model,
  ...(tts ? { speech: { text, voice, ...(speed ? { speed } : {}) }, ...(temperature ? { settings: { temperature } } : {}) } : { positivePrompt: prompt }),
  ...(tts ? {} : minimax ? { settings: { instrumental: true } } : { duration, settings: { vocalLanguage: "unknown", ...(bpm ? { bpm } : {}), ...(key ? { keyScale: key } : {}) } }),
  outputType: "URL",
  outputFormat: "MP3",
  deliveryMethod: "async",
  includeCost: true,
};

if (!approved) {
  console.log("DRY RUN (add --approved after the user has approved this track):");
  console.log(JSON.stringify(task, null, 2));
  console.log(`would save to ${outPath}`);
  process.exit(0);
}

const env = await readFile(join(root, ".env.local"), "utf8").catch(() => "");
const apiKey = /^RUNWARE_API_KEY=(.+)$/m.exec(env)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!apiKey) {
  console.error("RUNWARE_API_KEY is missing from .env.local");
  process.exit(1);
}
const call = async (body) => {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify([body]),
  });
  return { status: response.status, ok: response.ok, body: await response.json().catch(() => ({})) };
};
const log = async (entry) =>
  appendFile(join(root, "scripts", "generations.log"), `${JSON.stringify({ at: new Date().toISOString(), name, model, ...(tts ? { voice, text, speed, temperature } : { duration, bpm, key, prompt }), ...entry })}\n`);
const fail = async (message, entry) => {
  await log({ ok: false, ...entry });
  console.error(message);
  console.error("Not retrying. Ask the user before trying again.");
  process.exit(1);
};

const submitted = await call(task);
if (!submitted.ok || submitted.body.errors?.length) {
  const error = JSON.stringify(submitted.body).slice(0, 600);
  await fail(`submit failed (HTTP ${submitted.status}): ${error}`, { status: submitted.status, error });
}

let result;
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  const polled = await call({ taskType: "getResponse", taskUUID: task.taskUUID });
  if (polled.body.errors?.length) {
    const error = JSON.stringify(polled.body.errors).slice(0, 600);
    await fail(`generation failed: ${error}`, { taskUUID: task.taskUUID, error });
  }
  const item = polled.body.data?.find((d) => d.taskUUID === task.taskUUID) ?? polled.body.data?.[0];
  if (item?.audioURL && item.status !== "processing") {
    result = item;
    break;
  }
  if (item?.status === "error") await fail(`generation failed: ${JSON.stringify(item).slice(0, 600)}`, { taskUUID: task.taskUUID });
}
if (!result) await fail("gave up after 8 minutes. The task UUID is in generations.log.", { taskUUID: task.taskUUID, error: "poll timeout" });

const audio = await fetch(result.audioURL);
if (!audio.ok) {
  await log({ ok: false, cost: result.cost, error: `download failed: HTTP ${audio.status}`, audioURL: result.audioURL });
  console.error(`generated (cost $${result.cost}) but the download failed. URL is in generations.log.`);
  process.exit(1);
}
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, Buffer.from(await audio.arrayBuffer()));
await log({ ok: true, cost: result.cost, taskUUID: task.taskUUID, file: outPath.replace(root, "").replaceAll("\\", "/") });
console.log(`saved ${outPath}`);
console.log(`cost  $${result.cost}`);
