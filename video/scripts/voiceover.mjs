// Voice-over for the second cut of the promo (Promo-VO): one TTS file per line, levelled with
// ffmpeg, into video/public/vo/<id>.wav, and their lengths into src/voiceover.json.
//
//   node scripts/voiceover.mjs            dry run: prints the lines
//   node scripts/voiceover.mjs --approved generates the lines that do not exist yet
//
// The figures are spoken forms of frontend/config (cars.ts, site.ts): change them together.
// Voice: Fish Audio S2.1 Pro "Laura" with an [excited] cue, picked by the user from a second
// casting (2026-10-16). The first pick, a calm low voice (Inworld "Serena"), was rejected as
// limp: the user wants it crisp and cheerful. Lines go through scripts/runware-audio.mjs, so
// they are saved in design/generated/audio and logged with their cost.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = "fishaudio:s2.1@pro";
const VOICE = "e3cd384158934cc9a01029cd7d278634"; // Laura, "a confident female narrator"
const VOICE_NAME = "laura";
const DELIVERY = { cue: "[excited] ", speed: "1.05", temperature: "0.9" };

export const lines = {
  place: "Patchogue. Long Island.",
  arrive: "Some cars get you there.",
  entrance: "This one makes an entrance!",
  brand: "Bueno Exotics!",
  power: "Seven hundred seventeen horsepower.",
  sprint: "Zero to sixty in three point six.",
  model: "The Charger Hellcat. Widebody.",
  leather: "Red leather inside.",
  occasions: "Photoshoots. Weddings. Prom.",
  any: "Any occasion!",
  price: "Four ninety-nine a day.",
  book: "Book online!",
  sign: "Bueno Exotics. Long Island!",
};

const approved = process.argv.includes("--approved");
const outDir = path.join(root, "video/public/vo");
await mkdir(outDir, { recursive: true });
const lengths = {};

for (const [id, text] of Object.entries(lines)) {
  const name = `vo-${VOICE_NAME}-${id}`;
  const mp3 = path.join(root, "design/generated/audio", `${name}.mp3`);
  if (!existsSync(mp3)) {
    if (!approved) {
      console.log(`would generate ${id}: "${text}"`);
      continue;
    }
    execFileSync("node", [
      path.join(root, "scripts/runware-audio.mjs"), name, "--model", MODEL, "--voice", VOICE, "--text", DELIVERY.cue + text,
      "--speed", DELIVERY.speed, "--temperature", DELIVERY.temperature, "--approved",
    ], {
      stdio: "inherit",
    });
  }
  // Trim the silence at both ends, level to -16 LUFS, cut the rumble.
  const wav = path.join(outDir, `${id}.wav`);
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", mp3,
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,highpass=f=90,loudnorm=I=-16:TP=-1.5:LRA=7",
    "-ar", "44100", "-ac", "2", wav,
  ]);
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString());
  lengths[id] = Math.round(seconds * 1000) / 1000;
  console.log(`${id.padEnd(10)} ${seconds.toFixed(2)} s  "${text}"`);
}

if (Object.keys(lengths).length === Object.keys(lines).length) {
  await writeFile(path.join(root, "video/src/voiceover.json"), `${JSON.stringify(lengths, null, 2)}\n`);
  console.log("wrote src/voiceover.json");
}
