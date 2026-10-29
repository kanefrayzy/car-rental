// Local photo pipeline: sources -> optimized WebP in /frontend/public/images.
// No network, no generation. Existing outputs are skipped; pass --force to rebuild.
//
//   node scripts/images.mjs [--force]
//
// Part 1 prepares the real photos from /design/car (trim the black letterbox bars of the
// phone screenshots, light color correction, blur licence plates) into /design/car/web.
// They are generation references, not site images.
// Part 2 makes the site's photos from the client's real photos in /design/car/client-3
// (since 2026-10-27), except the hero and the CTA banner, which stay crops of Runware
// generations in /design/generated. Only these crops are public. Crops only: never paste a cut-out car onto another background, it looks fake.
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "design", "car");
const webPhotos = join(srcDir, "web");
const generated = join(root, "design", "generated");
const images = join(root, "frontend", "public", "images");
const force = process.argv.includes("--force");

// ---------------------------------------------------------------------------
// Part 1: real photos. Also used as reference images for generation.
// ---------------------------------------------------------------------------

/** blur regions are in pixels of the trimmed image: { left, top, width, height } */
const photos = [
  { src: "5068938158594002181 (1).jpg", out: join(webPhotos, "charger-side.webp") },
  { src: "5068938158594002179 (1).jpg", out: join(webPhotos, "charger-front-three-quarter.webp") },
  { src: "5068938158594002182 (1).jpg", out: join(webPhotos, "charger-front.webp") },
  {
    src: "5068938158594002180 (1).jpg",
    out: join(webPhotos, "charger-rear.webp"),
    blur: [{ left: 266, top: 198, width: 68, height: 34 }],
  },
];

async function buildPhoto(job, outPath) {
  // Trim first, as its own pass, so blur coordinates are in trimmed pixels.
  const trimmed = await sharp(join(srcDir, job.src))
    .trim({ background: "#000000", threshold: 24 })
    .toBuffer();
  const overlays = await Promise.all(
    (job.blur ?? []).map(async (region) => ({
      input: await sharp(trimmed).extract(region).blur(7).toBuffer(),
      left: region.left,
      top: region.top,
    })),
  );
  // No upscaling: the sources are small and stay honest.
  await sharp(trimmed)
    .composite(overlays)
    .modulate({ brightness: 1.03, saturation: 1.06 })
    .sharpen({ sigma: 0.6 })
    .webp({ quality: 82 })
    .toFile(outPath);
}

// ---------------------------------------------------------------------------
// Part 2: the site's photos, from real photos of the car.
// ---------------------------------------------------------------------------

// Real photos of the car, in /design/car (paths below are relative to it). Crops only, never
// upscaled, at most 1200px wide.
// - client-3: the client's photos of 2026-10-27, a rooftop car park at sunset and dusk. They
//   came through Telegram, so 960x1280. Left out: 03-07 (the photographer's shadow on the
//   ground), 09 (car cut off, tilted), 16 (a passer-by through the windscreen, dash-cam
//   cables), 17 (near copy of 18), 13 (a stranger's car beside it), 11 and 12 (the same seats
//   at dusk, with cables and a dirty mat: the daylight ones below are cleaner).
// - instagram: the post the client sent on 2026-10-13 (a detailer's account). post-1 is the
//   only large original (3072x4096). The user approved these for the site on 2026-10-27.
// - client-2: the client's photos of 2026-10-13 (960x1280; 1, 3 and 4 are copies of the
//   instagram post at a lower size).
// Horizons were measured on the parapet line and the tree line: all within half a degree, so
// nothing is rotated (a rotation would only cost the edges).
const shots = {
  // Front three-quarter at dusk, headlights on, lamps behind. No plate in frame.
  frontThreeQuarterDusk: { file: "client-3/5116558093092326908.jpg" },
  // Straight front at dusk. Darker than the rest, so lifted a little more.
  front: { file: "client-3/5116558093092326918.jpg", brightness: 1.1 },
  // Rear three-quarter at sunset, tail lights on. Plate at the left edge.
  rearSunset: { file: "client-3/5116558093092326910.jpg", plates: [{ left: 0, top: 758, width: 80, height: 112 }] },
  // Straight rear at sunset, the full-width tail light. Plate and dealer frame.
  rear: { file: "client-3/5116558093092326914.jpg", plates: [{ left: 110, top: 898, width: 162, height: 152 }] },
  // Front three-quarter in daylight, freshly washed. No front plate.
  frontThreeQuarter: { file: "instagram/post-1.jpg", brightness: 1.02 },
  // Front seats and the SRT wheel through the open driver's door, daylight.
  interior: { file: "instagram/post-2.jpg", brightness: 1.02 },
  // Rear bench through the open rear door, daylight.
  rearSeats: { file: "instagram/post-4.jpg", brightness: 1.02 },
  // The whole car from the front left, in a driveway. No plate in frame.
  side: { file: "client-2/photo-5.jpg" },
};
const source = (name) => join(srcDir, shots[name].file);

const preparedCache = new Map();

/**
 * One photo with its plates blurred (a soft-edged patch, so no seam shows on the bumper) and a
 * light correction: a touch brighter and more saturated, a gentle sharpen. No smoothing, which
 * is what makes phone photos look plastic. Returns a lossless buffer at the original size.
 */
function prepared(name) {
  if (!preparedCache.has(name)) {
    preparedCache.set(
      name,
      (async () => {
        const job = shots[name];
        const file = source(name);
        const { width, height } = await sharp(file).metadata();
        let image = sharp(file);
        if (job.plates?.length) {
          const rects = job.plates
            .map((r) => `<rect x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" rx="10" fill="#fff"/>`)
            .join("");
          const mask = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><filter id="f"><feGaussianBlur stdDeviation="5"/></filter><g filter="url(#f)">${rects}</g></svg>`,
          );
          const patch = await sharp(file)
            .blur(11)
            .ensureAlpha()
            .composite([{ input: mask, blend: "dest-in" }])
            .png()
            .toBuffer();
          image = sharp(await sharp(file).composite([{ input: patch }]).png().toBuffer());
        }
        return image
          .modulate({ brightness: job.brightness ?? 1.03, saturation: 1.05 })
          .linear(1.03, -3)
          .sharpen({ sigma: 0.5 })
          .png()
          .toBuffer();
      })(),
    );
  }
  return preparedCache.get(name);
}

/** A crop of one prepared photo, written at its own size. */
const cropOf = (name, region, quality = 82) => async (out) => {
  const image = sharp(await prepared(name));
  return (region ? image.extract(region) : image)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality })
    .toFile(out);
};

/**
 * Adds `extra` pixels of sky above a picture. The new sky takes its colour from the top
 * edge, and the real picture fades into it over its first rows, so there are no streaks
 * and no visible join.
 */
async function withSkyAbove(input, extra) {
  const { width, height } = await sharp(input).metadata();
  const feather = 220;
  // Four colour samples across the top edge, stretched back out: a soft sideways gradient
  // with no trace of the individual clouds that touch the edge.
  const samples = await sharp(input)
    .extract({ left: 0, top: 0, width, height: 16 })
    .resize(4, 1, { fit: "fill" })
    .png()
    .toBuffer();
  const sky = await sharp(samples)
    .resize(width, extra + feather, { fit: "fill", kernel: "cubic" })
    .png()
    .toBuffer();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${feather / height}" stop-color="#fff"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`,
  );
  const picture = await sharp(input)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp({ create: { width, height: extra + height, channels: 3, background: "#ffffff" } })
    .composite([
      { input: sky, left: 0, top: 0 },
      { input: picture, left: 0, top: extra },
    ])
    .png()
    .toBuffer();
}

// Gallery frames are 16:10 crops around the car (the main frame's shape); the full-screen
// viewer shows the whole photo instead (gallery/full), which is sharper there than a crop.
// [photo, 16:10 crop, optional crop for the viewer (default: the whole photo)].
const gallery = {
  "charger-front": ["front", { left: 64, top: 492, width: 896, height: 560 }],
  // The viewer crop stops above the garden hose coiled at the bottom of the photo.
  "charger-front-three-quarter": [
    "frontThreeQuarter",
    { left: 0, top: 1700, width: 3072, height: 1920 },
    { left: 0, top: 0, width: 3072, height: 3800 },
  ],
  "charger-rear": ["rearSunset", { left: 0, top: 432, width: 960, height: 600 }],
  "charger-interior": ["interior", { left: 0, top: 470, width: 1170, height: 731 }],
  "charger-rear-seats": ["rearSeats", { left: 0, top: 420, width: 1170, height: 731 }],
  "charger-left": ["side", { left: 0, top: 330, width: 960, height: 600 }],
  "charger-headlights": ["frontThreeQuarterDusk", { left: 0, top: 478, width: 960, height: 600 }],
};

// Generated scenes that stay (user, 2026-10-27: no real photo beats the hero): the hero and
// the CTA banner. Nano Banana Pro generations (see scripts/generations.log), used as they are:
// only cropped here. The hero edit (v7 to v9) removed the Hellcat fender badge, which the real
// car does not have.
const heroScene = join(generated, "hero-scene-v9.webp"); // 3168x1344, car at x 1327-2867, y 420-1228
// Strict side profile with a plain front fender (no badge). Generated fresh: every edit
// of a side view (v4, v5, v7) came back with a ghost of the car in the sky.
const sideScene = join(generated, "car-side-v8.webp"); // 3168x1344, car at x 1065-2950, y 450-1095

const crops = [
  {
    // Desktop hero, 3.47:1. The scene is widened on the left by mirroring its own edge
    // (that area sits under the white fade behind the headline). This shrinks the car to
    // the mockup size (about 540px wide at 1440) and moves it to the right; rows are
    // chosen so the wheels land just above the bottom edge.
    out: "hero-scene-desktop.webp",
    needs: [heroScene],
    build: async (out) => {
      const wide = await sharp(heroScene).extend({ left: 939, extendWith: "mirror" }).png().toBuffer();
      return sharp(wide)
        .extract({ left: 0, top: 89, width: 4107, height: 1184 })
        .resize({ width: 2880 })
        .webp({ quality: 80 })
        .toFile(out);
    },
  },
  {
    // Mobile hero, portrait. The car takes about 84% of the width at the bottom; the sky
    // above it is extended upward (the page fades that area to white for the headline).
    out: "hero-scene-mobile.webp",
    needs: [heroScene],
    build: async (out) => {
      const slice = await sharp(heroScene)
        .extract({ left: 1181, top: 0, width: 1833, height: 1298 })
        .png()
        .toBuffer();
      return sharp(await withSkyAbove(slice, 1332)).resize({ width: 780 }).webp({ quality: 78 }).toFile(out);
    },
  },
  {
    // Tablet and small-laptop hero (768-1279px wide), also the CTA banner there. Portrait-ish
    // on purpose: it is always scaled to the full width and cropped from the top, so the
    // car stays whole at the bottom right, about 56% of the width, with sky above for the copy.
    out: "hero-scene-tablet.webp",
    needs: [heroScene],
    build: async (out) => {
      const slice = await sharp(heroScene)
        .extract({ left: 400, top: 0, width: 2768, height: 1300 })
        .png()
        .toBuffer();
      return sharp(await withSkyAbove(slice, 813)).resize({ width: 1600 }).webp({ quality: 78 }).toFile(out);
    },
  },
  {
    // The side profile under the mobile CTA banner (no longer in the gallery, which has
    // only real photos; the file kept its old path).
    out: "gallery/charger-side.webp",
    needs: [sideScene],
    build: async (out) =>
      sharp(sideScene)
        .extract({ left: 895, top: 154, width: 2260, height: 1190 })
        .resize({ width: 1920 })
        .webp({ quality: 82 })
        .toFile(out),
  },
  {
    // CTA banner (desktop): a 3.4:1 band of the side profile in which the car nearly fills
    // the height, as in the mockup.
    out: "cta-side.webp",
    needs: [sideScene],
    build: async (out) =>
      sharp(sideScene)
        .extract({ left: 464, top: 366, width: 2691, height: 788 })
        .resize({ width: 1680 })
        .webp({ quality: 80 })
        .toFile(out),
  },
  // Real photos.
  ...Object.entries(gallery).flatMap(([slug, [name, region, full]]) => [
    { out: `gallery/${slug}.webp`, needs: [source(name)], build: cropOf(name, region) },
    { out: `gallery/full/${slug}.webp`, needs: [source(name)], build: cropOf(name, full) },
  ]),
  // Blog covers (16:9, the blog's frame), uploaded through the admin panel, which makes its own
  // copies: not site images, so they are written next to the sources, not into public/.
  ...Object.entries({
    "exotic-car-rental-at-21-long-island": ["frontThreeQuarter", { left: 0, top: 1690, width: 3072, height: 1728 }],
    "exotic-car-rental-cost-long-island": ["front", { left: 0, top: 500, width: 960, height: 540 }],
    "exotic-car-or-limo-for-your-wedding": ["rearSeats", { left: 0, top: 470, width: 1170, height: 658 }],
    "car-photoshoot-tips-long-island": ["rearSunset", { left: 0, top: 465, width: 960, height: 540 }],
    "scenic-drives-on-long-island": ["side", { left: 0, top: 360, width: 960, height: 540 }],
    "how-to-rent-an-exotic-car-on-long-island": ["interior", { left: 0, top: 500, width: 1170, height: 658 }],
  }).map(([slug, [name, region]]) => ({
    out: join(srcDir, "blog-covers", `${slug}.webp`),
    needs: [source(name)],
    build: async (out) => {
      await mkdir(dirname(out), { recursive: true });
      return sharp(await prepared(name))
        .extract(region)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(out);
    },
  })),
  {
    // The straight rear, 16:10: the lit tail light and the SRT badge (a service page).
    out: "photos/charger-tail-light.webp",
    needs: [source("rear")],
    build: cropOf("rear", { left: 0, top: 470, width: 960, height: 600 }),
  },
];
// The link preview image (app/opengraph-image.jpg) carries the logo: scripts/brand.mjs.

// ---------------------------------------------------------------------------

await mkdir(webPhotos, { recursive: true });
await mkdir(join(images, "gallery", "full"), { recursive: true });
await mkdir(join(images, "photos"), { recursive: true });

const jobs = [
  ...photos.map((job) => ({
    out: job.out,
    needs: [join(srcDir, job.src)],
    build: (out) => buildPhoto(job, out),
  })),
  ...crops,
];

for (const job of jobs) {
  const outPath = isAbsolute(job.out) ? job.out : join(images, job.out);
  const label = relative(root, outPath).replaceAll("\\", "/");
  const missing = job.needs.filter((file) => !existsSync(file));
  if (missing.length) {
    console.log(`skip   ${label} (missing source)`);
    continue;
  }
  if (existsSync(outPath) && !force) {
    console.log(`skip   ${label} (exists)`);
    continue;
  }
  await job.build(outPath);
  const { width, height } = await sharp(outPath).metadata();
  console.log(`wrote  ${label} ${width}x${height} ${Math.round(statSync(outPath).size / 1024)} KB`);
}

// ---------------------------------------------------------------------------
// Part 3: the smaller widths next/image asks for, made here once. The site serves these
// files as they are (frontend/lib/imageLoader.ts) instead of resizing on the server: the
// production server's virtual CPU cannot run sharp, which Next's own image optimizer needs.
// Each site image gets copies at these widths (below its own); its own width is the file
// itself. A copy is rebuilt when its source is newer, or with --force.
// Every width, the file's own included, also gets an AVIF twin (same name, .avif): <picture>
// elements offer it first (components/ui/ArtImage.tsx). 160 and 256 are for the gallery
// thumbnails, which are about 80px wide on phones (2026-10-19, Lighthouse).
// ---------------------------------------------------------------------------

const WIDTHS = [160, 256, 384, 640, 828, 1080, 1200, 1920, 2880];
const AVIF = { quality: 50, effort: 6 };
const sizedDir = join(images, "w");
const manifestPath = join(root, "frontend", "config", "image-widths.json");
const siteImages = [
  "hero-scene-desktop.webp",
  "hero-scene-mobile.webp",
  "hero-scene-tablet.webp",
  "cta-side.webp",
  ...["gallery", "gallery/full", "photos"].flatMap((dir) =>
    readdirSync(join(images, dir)).filter((file) => file.endsWith(".webp")).map((file) => `${dir}/${file}`),
  ),
];

const manifest = {};
for (const file of siteImages) {
  const source = join(images, file);
  const { width: own } = await sharp(source).metadata();
  const widths = WIDTHS.filter((width) => width < own);

  const fresh = (out) => existsSync(out) && !force && statSync(out).mtimeMs >= statSync(source).mtimeMs;
  const report = (out) =>
    console.log(`wrote  ${relative(root, out).replaceAll("\\", "/")} ${Math.round(statSync(out).size / 1024)} KB`);

  for (const width of widths) {
    const out = join(sizedDir, file.replace(/\.webp$/, `-${width}.webp`));
    if (!fresh(out)) {
      await mkdir(dirname(out), { recursive: true });
      await sharp(source).resize({ width }).webp({ quality: 78 }).toFile(out);
      report(out);
    }
    const avif = out.replace(/\.webp$/, ".avif");
    if (!fresh(avif)) {
      await sharp(source).resize({ width }).avif(AVIF).toFile(avif);
      report(avif);
    }
  }
  const ownAvif = source.replace(/\.webp$/, ".avif");
  if (!fresh(ownAvif)) {
    await sharp(source).avif(AVIF).toFile(ownAvif);
    report(ownAvif);
  }
  manifest[`/images/${file}`] = [...widths, own];
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote  ${relative(root, manifestPath).replaceAll("\\", "/")}`);

// ---------------------------------------------------------------------------
// Part 4: the occasion icons (Recraft V4 Vector, approved 2026-10-19), one per occasion slug.
// Recraft's SVGs carry a large C2PA metadata block and coordinates to many decimals; the copies
// in public/ drop the block and round to whole units of their 2048 viewBox.
// ---------------------------------------------------------------------------

const icons = {
  photoshoot: "icon-photoshoot.svg",
  "music-video": "icon-music-video.svg",
  wedding: "icon-wedding.svg",
  birthday: "icon-birthday.svg",
  prom: "icon-prom-v3.svg",
  event: "icon-event-v2.svg",
};
const iconDir = join(images, "occasions", "icons");
await mkdir(iconDir, { recursive: true });
for (const [slug, file] of Object.entries(icons)) {
  const source = join(generated, file);
  const out = join(iconDir, `${slug}.svg`);
  if (!existsSync(source)) {
    console.log(`skip   ${relative(root, out).replaceAll("\\", "/")} (missing source)`);
    continue;
  }
  if (existsSync(out) && !force && statSync(out).mtimeMs >= statSync(source).mtimeMs) continue;
  const svg = (await readFile(source, "utf8"))
    .replace(/<metadata>[\s\S]*?<\/metadata>/, "")
    .replace(/ xmlns:c2pa="[^"]*"/, "")
    .replace(/ style="display: block;"/, "")
    .replace(/ transform="translate\(0,0\)"/g, "")
    .replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));
  await writeFile(out, svg);
  console.log(`wrote  ${relative(root, out).replaceAll("\\", "/")} ${Math.round(statSync(out).size / 1024)} KB`);
}
