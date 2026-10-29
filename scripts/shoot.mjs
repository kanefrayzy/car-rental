// Screenshots the running site at the two mockup widths.
//
//   node scripts/shoot.mjs [name] [--selector "#the-car"] [--url http://localhost:3000]
//                          [--click "button[aria-label='Open menu']"] [--only 390] [--width 834] [--motion]
//
// Output: scripts/.shots/<name>-1440.png and scripts/.shots/<name>-390.png
// Without --selector the full page is captured (the viewport, if --click is used).
// Animations are skipped (prefers-reduced-motion) unless --motion is passed.
// --width adds one extra viewport (for tablet checks) and captures only that one.
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const name = args[0] && !args[0].startsWith("--") ? args[0] : "page";
const url = flag("url") ?? "http://localhost:3000";
const selector = flag("selector");
const click = flag("click");
const only = flag("only");
const extraWidth = Number(flag("width")) || 0;
const motion = args.includes("--motion");

const outDir = join(dirname(fileURLToPath(import.meta.url)), ".shots");
await mkdir(outDir, { recursive: true });

const viewports = [
  { width: 1440, height: 900, deviceScaleFactor: 1 },
  { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

if (extraWidth) {
  viewports.length = 0;
  viewports.push({ width: extraWidth, height: 1000, deviceScaleFactor: 1 });
}

const browser = await chromium.launch();
try {
  for (const { width, height, ...rest } of viewports) {
    if (only && +only !== width) continue;
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: motion ? "no-preference" : "reduce",
      ...rest,
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Scroll through the page once so lazy-loaded images are in the capture.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle");
    if (click) {
      await page.locator(click).first().click();
      await page.waitForTimeout(400);
    }

    const path = join(outDir, `${name}-${width}.png`);
    if (selector) {
      const target = page.locator(selector).first();
      await target.scrollIntoViewIfNeeded();
      await target.screenshot({ path });
    } else {
      await page.screenshot({ path, fullPage: !click });
    }
    console.log(path);
    await context.close();
  }
} finally {
  await browser.close();
}
