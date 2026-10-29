// Runware image-to-video, budget-guarded like scripts/runware.mjs. Read the rules in /CLAUDE.md.
//
//   node scripts/runware-video.mjs <name> --frame video/frames/approach.jpg --prompt "..."
//        [--negative "..."] [--model klingai:kling-video@3-standard] [--duration 5]
//        [--last video/frames/next.jpg] [--width 768 --height 1366] [--approved]
//
// --last makes a transition: the model moves from --frame to --last (Kling 3.0 takes both;
// Hailuo 2.3 Fast only a first frame).
//
// - Kling 3.0 Standard (klingai:kling-video@3-standard): $0.084/s without sound, sizes come
//   from the frame (720x1280 for 9:16), 3-15 s. Hailuo 2.3 Fast (minimax:4@2): $0.0317/s at
//   768p, needs --width/--height (768x1366), 6 or 10 s. Checked 2026-10-16 on runware.ai/docs.
// - Sound is off: the promo has its own soundtrack.
// - Without --approved it is a dry run: prints the request and exits. Nothing is spent.
// - One clip per call, one attempt, no retries. Refuses to overwrite design/generated/video/<name>.mp4.
// - Appends prompt + cost to scripts/generations.log. The key (RUNWARE_API_KEY in /.env.local) is never printed.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://api.runware.ai/v1";

const args = process.argv.slice(2);
const name = args[0];
const one = (flag) => {
  const i = args.indexOf(`--${flag}`);
  return i === -1 ? undefined : args[i + 1];
};
const frame = one("frame");
const last = one("last");
const prompt = one("prompt");
const negative = one("negative");
const model = one("model") ?? "klingai:kling-video@3-standard";
const duration = Number(one("duration") ?? 5);
const width = one("width") ? Number(one("width")) : undefined;
const height = one("height") ? Number(one("height")) : undefined;
const approved = args.includes("--approved");

if (!name || name.startsWith("--") || !frame || !prompt) {
  console.error('usage: node scripts/runware-video.mjs <name> --frame file.jpg --prompt "..." [--negative "..."] [--model id] [--duration s] [--width W --height H] [--approved]');
  process.exit(1);
}

const outPath = join(root, "design", "generated", "video", `${name}.mp4`);
if (existsSync(outPath)) {
  console.error(`refusing: ${outPath} already exists. Delete it yourself if a new version is approved.`);
  process.exit(1);
}

const kling = model.startsWith("klingai:");
const minimax = model.startsWith("minimax:");
const dataUri = async (file) => `data:image/jpeg;base64,${(await readFile(resolve(root, file))).toString("base64")}`;
const frameImages = [{ image: await dataUri(frame), frame: "first" }, ...(last ? [{ image: await dataUri(last), frame: "last" }] : [])];
const task = {
  taskType: "videoInference",
  taskUUID: randomUUID(),
  model,
  positivePrompt: prompt,
  ...(negative && !minimax ? { negativePrompt: negative } : {}),
  duration,
  ...(width && height ? { width, height } : {}),
  inputs: { frameImages },
  outputType: "URL",
  outputFormat: "MP4",
  deliveryMethod: "async",
  includeCost: true,
  numberResults: 1,
  ...(kling ? { providerSettings: { klingai: { sound: false } } } : {}),
};

if (!approved) {
  console.log("DRY RUN (add --approved after the user has approved this clip):");
  console.log(JSON.stringify({ ...task, inputs: { frameImages: frameImages.map((f, i) => ({ ...f, image: i ? last : frame })) } }, null, 2));
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
  appendFile(
    join(root, "scripts", "generations.log"),
    `${JSON.stringify({ at: new Date().toISOString(), name, model, duration, width, height, frame, last, prompt, negative, ...entry })}\n`,
  );
const fail = async (message, entry) => {
  await log({ ok: false, ...entry });
  console.error(message);
  console.error("Not retrying. Ask the user before trying again.");
  process.exit(1);
};

const submitted = await call(task);
if (!submitted.ok || submitted.body.errors?.length) {
  await fail(`submit failed (HTTP ${submitted.status}): ${JSON.stringify(submitted.body).slice(0, 600)}`, {
    status: submitted.status,
    error: JSON.stringify(submitted.body).slice(0, 600),
  });
}
console.log(`queued ${task.taskUUID}`);

// Poll: every 5 s, up to 15 minutes. Polling itself is free.
let result;
for (let i = 0; i < 180; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const polled = await call({ taskType: "getResponse", taskUUID: task.taskUUID });
  if (polled.body.errors?.length) {
    await fail(`generation failed: ${JSON.stringify(polled.body.errors).slice(0, 600)}`, {
      taskUUID: task.taskUUID,
      error: JSON.stringify(polled.body.errors).slice(0, 600),
    });
  }
  const item = polled.body.data?.find((d) => d.taskUUID === task.taskUUID) ?? polled.body.data?.[0];
  if (item?.status === "success" && item.videoURL) {
    result = item;
    break;
  }
  if (item?.status === "error") await fail(`generation failed: ${JSON.stringify(item).slice(0, 600)}`, { taskUUID: task.taskUUID, error: JSON.stringify(item).slice(0, 600) });
  if (i % 6 === 5) console.log(`  still ${item?.status ?? "waiting"} (${(i + 1) * 5} s)`);
}
if (!result) await fail("gave up after 15 minutes; the task may still finish. Its UUID is in generations.log.", { taskUUID: task.taskUUID, error: "poll timeout" });

const video = await fetch(result.videoURL);
if (!video.ok) {
  await log({ ok: false, cost: result.cost, error: `download failed: HTTP ${video.status}`, videoURL: result.videoURL });
  console.error(`generated (cost $${result.cost}) but the download failed. URL is in generations.log.`);
  process.exit(1);
}
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, Buffer.from(await video.arrayBuffer()));
await log({ ok: true, cost: result.cost, taskUUID: task.taskUUID, file: outPath.replace(root, "").replaceAll("\\", "/") });
console.log(`saved ${outPath}`);
console.log(`cost  $${result.cost}`);
