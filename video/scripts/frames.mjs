// Cuts the vertical start frames for the image-to-video clips out of the approved stills.
// Output: video/frames/<clip>.jpg at 720x1280 (Kling 3.0 inherits the size from the frame)
// and <clip>-768.jpg at 768x1366 (Hailuo 2.3 takes 768x1366). Crops only, no retouching.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "video/frames");

// cx, cy: centre of the crop as a fraction of the picture; h: crop height as a fraction.
export const clips = {
  headlight: { src: "design/generated/car-front-v8.webp", cx: 0.7, cy: 0.56, h: 0.8 },
  wheel: { src: "design/generated/car-side-v8.webp", cx: 0.44, cy: 0.6, h: 1 },
  taillights: { src: "design/generated/car-rear.webp", cx: 0.5, cy: 0.5, h: 1 },
  interior: { src: "design/generated/car-interior.webp", cx: 0.5, cy: 0.5, h: 1 },
  approach: { src: "design/generated/hero-scene-v9.webp", cx: 0.53, cy: 0.5, h: 1 },
  front: { src: "design/generated/car-front-v8.webp", cx: 0.5, cy: 0.5, h: 1 },
  studio: { src: "design/generated/occasion-photoshoot.webp", cx: 0.3, cy: 0.5, h: 1 },
};

await mkdir(out, { recursive: true });
for (const [name, c] of Object.entries(clips)) {
  const file = path.join(root, c.src);
  const { width: W, height: H } = await sharp(file).metadata();
  const h = Math.round(H * c.h);
  const w = Math.round((h * 9) / 16);
  const left = Math.min(W - w, Math.max(0, Math.round(W * c.cx - w / 2)));
  const top = Math.min(H - h, Math.max(0, Math.round(H * c.cy - h / 2)));
  const crop = sharp(file).extract({ left, top, width: w, height: h });
  await crop.clone().resize(720, 1280).jpeg({ quality: 93 }).toFile(path.join(out, `${name}.jpg`));
  await crop.clone().resize(768, 1366).jpeg({ quality: 93 }).toFile(path.join(out, `${name}-768.jpg`));
  console.log(`${name}: ${w}x${h} from ${path.basename(c.src)} (x ${left}, y ${top})`);
}
