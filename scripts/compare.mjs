// Stacks a crop of the mockup above the matching screenshot for a visual diff.
//
//   node scripts/compare.mjs <name> <1440|390> <x> <y> <w> <h>
//
// <name> and the width pick scripts/.shots/<name>-<width>.png (from shoot.mjs).
// x/y/w/h is the region in mockup pixels: design/desktop.png for 1440,
// design/mobile.png for 390. Output: scripts/.shots/<name>-<width>-cmp.png
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const [name, width, x, y, w, h] = process.argv.slice(2);
if (!h) {
  console.error("usage: node scripts/compare.mjs <name> <1440|390> <x> <y> <w> <h>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mockup = join(root, "design", width === "1440" ? "desktop.png" : "mobile.png");
const shotPath = join(root, "scripts", ".shots", `${name}-${width}.png`);
const outPath = join(root, "scripts", ".shots", `${name}-${width}-cmp.png`);

const shot = sharp(shotPath);
const { width: shotW, height: shotH } = await shot.metadata();

const reference = await sharp(mockup)
  .extract({ left: +x, top: +y, width: +w, height: +h })
  .resize({ width: shotW })
  .png()
  .toBuffer();
const { height: refH } = await sharp(reference).metadata();

const gap = 12;
await sharp({
  create: {
    width: shotW,
    height: refH + gap + shotH,
    channels: 3,
    background: "#ff00aa",
  },
})
  .composite([
    { input: reference, left: 0, top: 0 },
    { input: await shot.png().toBuffer(), left: 0, top: refH + gap },
  ])
  .png()
  .toFile(outPath);

console.log(outPath);
