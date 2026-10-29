// Checks the GA4 lead events on every page of a build made with a GA4 ID
// (NEXT_PUBLIC_GA_ID=G-TEST12345 for a local one):
//   node scripts/check-analytics.mjs [--url http://localhost:3100]
//
// - Every tel: and sms: link on every page in the sitemap (plus the 404 page), on a phone and on
//   a desktop, sends click_call / click_sms, and the link opens the call or text app itself, in
//   the tap (never held back by a script: iOS Safari blocks a call a script starts later).
// - contact_submit is sent once after the message went through, never for a form the site
//   refuses. (booking_submit is checked by check-interactions.mjs, in its booking flow.)
//
// gtag.js is replaced by an empty script, so nothing reaches Google: the events are read from
// window.dataLayer, where the site puts them.
import { chromium, devices } from "playwright";

const args = process.argv.slice(2);
const url = (args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://localhost:3100").replace(/\/+$/, "");

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const sitemap = await (await fetch(`${url}/sitemap.xml`)).text();
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
paths.push("/this-page-does-not-exist");

const browser = await chromium.launch();
const viewports = {
  phone: { ...devices["iPhone 13"] },
  desktop: { viewport: { width: 1440, height: 900 } },
};

for (const [name, options] of Object.entries(viewports)) {
  const context = await browser.newContext(options);
  await context.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  const page = await context.newPage();
  // The call or text app "opens" when the page navigates to tel:/sms:. Chromium reports it and
  // stays on the page; "anchorClick" means the link opened it, not a script.
  const opened = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  cdp.on("Page.frameRequestedNavigation", (e) => /^(tel|sms):/.test(e.url) && opened.push(`${e.reason} ${e.url}`));
  let links = 0;
  const missed = [];

  for (const path of paths) {
    await page.goto(url + path, { waitUntil: "networkidle" });
    // Analytics starts after hydration.
    await page.waitForFunction(() => Array.isArray(window.dataLayer) && window.dataLayer.some((e) => e[0] === "config"), null, { timeout: 10000 });
    const count = await page.locator('a[href^="tel:"], a[href^="sms:"]').count();
    for (let i = 0; i < count; i++) {
      const openedBefore = opened.length;
      const result = await page.evaluate((index) => {
        const link = document.querySelectorAll('a[href^="tel:"], a[href^="sms:"]')[index];
        const before = window.dataLayer.length;
        // A real click event, as a tap makes, whether or not the link is shown at this width.
        const notCancelled = link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
        const events = window.dataLayer.slice(before).filter((e) => e[0] === "event").map((e) => [e[1], e[2]?.link_text]);
        return { href: link.getAttribute("href"), events, heldBack: !notCancelled };
      }, i);
      await page.waitForTimeout(600);
      result.openedAfter = opened.slice(openedBefore);
      links++;
      const expected = result.href.startsWith("tel:") ? "click_call" : "click_sms";
      const ok =
        result.events.length === 1 &&
        result.events[0][0] === expected &&
        !!result.events[0][1] &&
        !result.heldBack &&
        result.openedAfter.length === 1 &&
        result.openedAfter[0] === `anchorClick ${result.href}`;
      if (!ok) missed.push(`${path} #${i} ${result.href}: ${JSON.stringify(result)}`);
    }
  }
  check(`${name}: every tel: and sms: link sends its event and opens the app in the tap`, missed.length === 0, `${links} links on ${paths.length} pages${missed.length ? `; failed: ${missed.join(" | ")}` : ""}`);

  // A tab left open for more than 30 minutes: the next event must not start a session of its
  // own (GA4 then reports its source as (not set)), so a page_view goes first. gtag.js is a stub
  // here, so the session cookie it would keep is set by hand, and the page's clock is moved on.
  const timed = await context.newPage();
  await timed.clock.install();
  const gaId = await page.evaluate(() => window.dataLayer.find((e) => e[0] === "config")[1].replace(/^G-/, ""));
  const setLastHit = async (secondsAgo) => {
    const now = Math.floor((await timed.evaluate(() => Date.now())) / 1000);
    await context.addCookies([{ name: `_ga_${gaId}`, value: `GS2.1.s${now - secondsAgo}$o1$g1$t${now - secondsAgo}$j0$l0$h0`, url }]);
  };
  const load = async () => {
    await timed.goto(`${url}/`, { waitUntil: "networkidle" });
    await timed.waitForFunction(() => Array.isArray(window.dataLayer) && window.dataLayer.some((e) => e[0] === "config"), null, { timeout: 10000 });
    // The listeners are attached in the render that adds the gtag.js script, just after config.
    await timed.locator('script[src*="googletagmanager"]').waitFor({ state: "attached" });
    await timed.clock.runFor(300);
  };
  const siteEvents = (since = 0) => timed.evaluate((since) => window.dataLayer.slice(since).filter((e) => e[0] === "event").map((e) => e[1]).join(), since);
  const after = async (action) => {
    const before = await timed.evaluate(() => window.dataLayer.length);
    await timed.evaluate((action) => {
      if (action === "call") document.querySelector('a[href^="tel:"]').dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      else document.dispatchEvent(new Event("visibilitychange"));
    }, action);
    return siteEvents(before);
  };
  // A visitor back after two hours: GA's own page_view starts the new session; the site adds none.
  await setLastHit(2 * 3600);
  await load();
  const returning = await siteEvents();
  const returningCall = await after("call");
  check(`${name}: a visitor back after hours gets no extra page_view, and the click goes alone`, returning === "" && returningCall === "click_call", `${returning || "-"} / ${returningCall}`);
  for (const [label, minutes, action, expected] of [
    ["in a live session the click goes alone", 5, "call", "click_call"],
    ["after 30 minutes on the page, a page_view starts the new session before the click", 31, "call", "page_view,click_call"],
    ["coming back to a tab after 30 minutes sends a page_view", 31, "return", "page_view"],
    ["coming back within 30 minutes sends nothing", 5, "return", ""],
  ]) {
    await load();
    await setLastHit(0);
    await timed.clock.fastForward(`${String(minutes).padStart(2, "0")}:00`);
    const got = await after(action);
    check(`${name}: ${label}`, got === expected, got || "nothing");
  }
  await timed.close();

  // The contact form: nothing for a refused form, one event after a message went through.
  await page.goto(`${url}/contact`, { waitUntil: "networkidle" });
  const contactSubmits = () =>
    page.evaluate(() => window.dataLayer.filter((e) => e[0] === "event" && e[1] === "contact_submit").length);
  const form = page.locator('form[aria-label="Send us a message"]');
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);
  check(`${name}: no contact_submit for a form the site refuses`, (await contactSubmits()) === 0);
  await form.getByLabel("First name").fill("Test");
  await form.getByLabel("Last name").fill("Visitor");
  await form.getByLabel("Email").fill("test@example.com");
  await form.getByLabel("Phone").fill("6315550142");
  await form.locator("select").first().selectOption({ index: 1 });
  await form.locator("textarea").fill("Checking that the contact form is counted once.");
  await form.locator('button[type="submit"]').click();
  await page.getByRole("status").filter({ hasText: /sent|thank/i }).first().waitFor({ timeout: 10000 });
  check(`${name}: contact_submit once, after the message went through`, (await contactSubmits()) === 1);

  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
