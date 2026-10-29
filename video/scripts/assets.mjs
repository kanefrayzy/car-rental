// Copies the generated clips and the soundtrack into video/public (gitignored), where Remotion serves them.
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The clips and AI transitions (scripts/runware-video.mjs), as they are.
const clips = [
  "approach", "headlight", "wheel", "taillights", "interior2", "front", "studio", "rear-burnout", "drive-away",
  "tr-headlight-interior2", "tr-smoke-studio", "tr-red-light2", "tr-into-camera",
];
await mkdir(path.join(root, "video/public/clips"), { recursive: true });
for (const name of clips) {
  await copyFile(path.join(root, `design/generated/video/${name}.mp4`), path.join(root, `video/public/clips/${name}.mp4`));
  console.log(`${name}.mp4`);
}

// The soundtrack the user chose (MiniMax Music 2.6, scripts/runware-audio.mjs). src/timing.ts is measured on it.
await copyFile(path.join(root, "design/generated/audio/minimax-cinetrap.mp3"), path.join(root, "video/public/music.mp3"));
console.log("music.mp3");
