// Runware image generation, budget-guarded. Read the rules in /CLAUDE.md before using.
//
//   node scripts/runware.mjs <name> --prompt "..." --width 1376 --height 768
//        [--ref design/car/web/charger-side.webp ...] [--format PNG|WEBP|JPG]
//        [--model google:4@3] [--approved]
//   node scripts/runware.mjs logo-a --model recraft:v4@vector --format SVG --width 1024 --height 1024
//        --prompt "..." --colors 0f2035,0566fb [--background ffffff]
//
// - Recraft vector models (recraft:v4@vector, $0.08; recraft:v4-pro@vector, $0.30) return SVG
//   only, through taskType "vectorize" (not "imageInference", which rejects the model id);
//   --colors and --background go into their `settings` (checked 2026-10-15).
// - Without --approved it is a dry run: prints the request and exits. Nothing is spent.
// - One image per call (numberResults: 1), one attempt, no retries.
// - Refuses to run if design/generated/<name>.<ext> already exists.
// - Saves the result there and appends prompt + cost to scripts/generations.log.
// - The API key is read from RUNWARE_API_KEY in /.env.local and is never printed.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://api.runware.ai/v1";
// Nano Banana Pro, the model the user chose ($0.138 per image at 1K or 2K). The original
// Nano Banana, google:4@1, was deactivated on 2026-10-02; Nano Banana 2 is google:4@3.
// Checked against https://runware.ai/docs on 2026-10-13.
const DEFAULT_MODEL = "google:4@2";
const MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

const args = process.argv.slice(2);
const name = args[0];
const one = (flag) => {
  const i = args.indexOf(`--${flag}`);
  return i === -1 ? undefined : args[i + 1];
};
const many = (flag) => args.flatMap((arg, i) => (arg === `--${flag}` ? [args[i + 1]] : []));

const prompt = one("prompt");
const width = Number(one("width"));
const height = Number(one("height"));
const format = (one("format") ?? "WEBP").toUpperCase();
const model = one("model") ?? DEFAULT_MODEL;
const refs = many("ref");
const approved = args.includes("--approved");
const rgb = (hex) => ({ rgb: [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16)) });
const colors = one("colors")?.split(",").map(rgb);
const background = one("background");
const settings = {
  ...(colors ? { colors } : {}),
  ...(background ? { backgroundColor: rgb(background) } : {}),
};

if (!name || name.startsWith("--") || !prompt || !width || !height) {
  console.error('usage: node scripts/runware.mjs <name> --prompt "..." --width W --height H [--ref file ...] [--format PNG|WEBP|JPG|SVG] [--colors hex,hex] [--background hex] [--approved]');
  process.exit(1);
}
if (!["PNG", "WEBP", "JPG", "SVG"].includes(format)) {
  console.error(`unsupported --format ${format}`);
  process.exit(1);
}

// Generations are sources, not site images: scripts/images.mjs crops them into the site.
const outPath = join(root, "design", "generated", `${name}.${format.toLowerCase()}`);
if (existsSync(outPath)) {
  console.error(`refusing: ${outPath} already exists. Delete it yourself if a new version is approved.`);
  process.exit(1);
}

const referenceImages = await Promise.all(
  refs.map(async (file) => {
    const mime = MIME[extname(file).toLowerCase()];
    if (!mime) throw new Error(`unsupported reference type: ${file}`);
    const data = await readFile(resolve(root, file));
    return `data:${mime};base64,${data.toString("base64")}`;
  }),
);

// Recraft's text-to-SVG models are a different task type and always return one result.
const vector = format === "SVG";
const task = {
  taskType: vector ? "vectorize" : "imageInference",
  taskUUID: randomUUID(),
  model,
  positivePrompt: prompt,
  width,
  height,
  ...(vector ? {} : { numberResults: 1 }),
  outputType: "URL",
  outputFormat: format,
  includeCost: true,
  ...(referenceImages.length ? { inputs: { referenceImages } } : {}),
  ...(Object.keys(settings).length ? { settings } : {}),
};

if (!approved) {
  console.log("DRY RUN (add --approved after the user has approved this exact image):");
  console.log(
    JSON.stringify(
      { ...task, ...(refs.length ? { inputs: { referenceImages: refs } } : {}) },
      null,
      2,
    ),
  );
  console.log(`would save to ${outPath}`);
  process.exit(0);
}

const env = await readFile(join(root, ".env.local"), "utf8").catch(() => "");
const apiKey = /^RUNWARE_API_KEY=(.+)$/m.exec(env)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!apiKey) {
  console.error("RUNWARE_API_KEY is missing from .env.local");
  process.exit(1);
}

const log = async (entry) =>
  appendFile(
    join(root, "scripts", "generations.log"),
    `${JSON.stringify({ at: new Date().toISOString(), name, model, width, height, format, refs, prompt, ...entry })}\n`,
  );

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify([task]),
});
const body = await response.json().catch(() => ({}));
const result = body.data?.[0];

if (!response.ok || !result?.imageURL) {
  const error = JSON.stringify(body.errors ?? body).slice(0, 600);
  await log({ ok: false, status: response.status, error });
  console.error(`generation failed (HTTP ${response.status}): ${error}`);
  console.error("Not retrying. Ask the user before trying again.");
  process.exit(1);
}

const image = await fetch(result.imageURL);
if (!image.ok) {
  await log({ ok: false, cost: result.cost, error: `download failed: HTTP ${image.status}`, imageURL: result.imageURL });
  console.error(`generated (cost $${result.cost}) but the download failed. URL is in generations.log.`);
  process.exit(1);
}
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, Buffer.from(await image.arrayBuffer()));
await log({ ok: true, cost: result.cost, seed: result.seed, file: outPath.replace(root, "").replaceAll("\\", "/") });

console.log(`saved ${outPath}`);
console.log(`cost  $${result.cost}`);
