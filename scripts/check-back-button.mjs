// The browser Back button never leaves a form stuck on its spinner (bug of 2026-10-31: the
// hero's "Checking…" survived Back from the booking page, and nothing could be sent again).
//
//   node scripts/check-back-button.mjs [--url http://localhost:3100] [--fake-api] [--only chromium|webkit]
//
// Runs in Chromium and WebKit, on a desktop and an iPhone viewport:
// - client-side Back (Next keeps the page alive in <Activity> and restores its state);
// - full-page Back from the back-forward cache (pageshow with event.persisted);
// - the booking form's Back after a sent request (mock API only: a real API would get a booking).
// With a real API (or --fake-api: a build whose NEXT_PUBLIC_API_URL is answered here), also:
// an availability request that never answers stops after 15 s with a message, a network error
// leaves the button usable, and a double click sends one request.
import { chromium, devices, webkit } from "playwright";

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const url = (arg("--url") ?? "http://localhost:3100").replace(/\/+$/, "");
const fakeApi = args.includes("--fake-api");
const only = arg("--only");
const production = /^https:\/\/(www\.)?buenoexoticsny\.com/.test(url);

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};
const info = (text) => console.log(`info  ${text}`);

const isoAt = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Far out, so a real calendar is very likely free (an availability check books nothing).
const start = 200 + Math.floor(Math.random() * 120);

const iphone = { ...devices["iPhone 13"] };
delete iphone.defaultBrowserType;
const viewports = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: iphone,
};
const engines = {
  // Full Chromium (not the headless shell) with Playwright's "no bfcache" switch removed, so
  // Back really restores a frozen page, as in Chrome on a phone.
  chromium: () =>
    chromium.launch({
      channel: "chromium",
      ignoreDefaultArgs: ["--disable-back-forward-cache"],
      args: ["--enable-features=BackForwardCache"],
    }),
  // Playwright's WebKit on Windows has no bfcache at all: the restore is simulated (see 2.).
  webkit: () => webkit.launch(),
};

/** Answers the site's API calls when the build points at a fake address (--fake-api). */
async function fakeApiRoutes(context) {
  await context.route(/\/api\/availability$/, (route) => {
    const body = route.request().postDataJSON();
    const days = Math.max(1, Math.round((new Date(body.returnDate) - new Date(body.pickupDate)) / 86400000));
    route.fulfill({ json: { available: true, days, pricePerDay: 499, totalUsd: days * 499 } });
  });
}

async function newPage(browser, viewport, { blockClientNavigation = false } = {}) {
  const context = await browser.newContext({ ...viewports[viewport] });
  // The cookie notice stays out of the way, and the page notes a restore from the bfcache.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("bueno:cookie-notice", "test");
    } catch {}
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) window.__restoredFromBfcache = true;
    });
  });
  if (fakeApi) await fakeApiRoutes(context);
  if (blockClientNavigation) {
    // No RSC payload for the booking page: Next falls back to a full page load, so Back is a
    // real document navigation (the bfcache case, as after a deploy changed the build).
    await context.route(/\/book\//, (route) => {
      const request = route.request();
      const rsc = request.headers()["rsc"] === "1" || new URL(request.url()).searchParams.has("_rsc");
      return rsc ? route.abort() : route.continue();
    });
  }
  const page = await context.newPage();
  return { context, page };
}

const bar = (page) => page.locator("form#availability-form");
const barButton = (page) => bar(page).getByRole("button");

async function fillBar(page, offset) {
  // Hydrated: the pick-up date gets its `min` (today) only in the browser. Typed earlier, a date
  // is wiped when React takes over (WebKit on Windows has no date input and is slow to hydrate).
  await bar(page).locator("input[min]").first().waitFor({ state: "attached" });
  await bar(page).getByLabel("Pick-up date").fill(isoAt(offset));
  await bar(page).getByLabel("Return date").fill(isoAt(offset + 2));
}

async function buttonState(button) {
  return {
    text: ((await button.textContent()) ?? "").trim(),
    disabled: await button.isDisabled(),
    busy: (await button.getAttribute("aria-busy")) === "true",
  };
}

const usable = (state, label) => state.text === label && !state.disabled && !state.busy;
const atPath = (pathname) => (address) => new URL(address).pathname === pathname;

/** Submits the hero bar until free dates open the booking page (a real calendar may be taken). */
async function submitBarToBooking(page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await fillBar(page, start + attempt * 7);
    await barButton(page).click();
    const outcome = await Promise.race([
      page.waitForURL(/\/book\//, { timeout: 15000 }).then(() => "booking"),
      bar(page)
        .getByText(/already booked/)
        .waitFor({ timeout: 15000 })
        .then(() => "taken"),
    ]).catch(() => "nothing");
    if (outcome === "booking") return true;
    if (outcome === "nothing") return false;
  }
  return false;
}

async function run(engineName, viewport) {
  const tag = `${engineName} ${viewport}`;
  const browser = await engines[engineName]();
  try {
    // ---- 1. Hero bar, client-side Back ---------------------------------------------
    {
      const { context, page } = await newPage(browser, viewport);
      await page.goto(`${url}/`, { waitUntil: "load" });
      await barButton(page).waitFor();
      const opened = await submitBarToBooking(page);
      check(`${tag}: free dates open the booking page`, opened);
      await page.locator("form#booking-form").waitFor();
      await page.goBack();
      await page.waitForURL(atPath("/"));
      await barButton(page).waitFor({ state: "visible" });
      await page.waitForTimeout(400);
      const state = await buttonState(barButton(page));
      check(`${tag}: client Back, the hero button is usable again`, usable(state, "Check Availability"), JSON.stringify(state));
      check(`${tag}: client Back, the page was not reloaded (state kept by Next)`, (await bar(page).getByLabel("Pick-up date").inputValue()) !== "");
      const again = await barButton(page)
        .click({ timeout: 5000 })
        .then(() => page.waitForURL(/\/book\//, { timeout: 15000 }))
        .then(() => true)
        .catch(() => false);
      check(`${tag}: client Back, a new check goes through`, again);
      await context.close();
    }

    // ---- 2. Hero bar, full-page Back (bfcache) ---------------------------------------
    if (engineName === "chromium") {
      const { context, page } = await newPage(browser, viewport, { blockClientNavigation: true });
      await page.goto(`${url}/`, { waitUntil: "load" });
      await barButton(page).waitFor();
      const opened = await submitBarToBooking(page);
      check(`${tag}: full page load of the booking page`, opened);
      await page.locator("form#booking-form").waitFor();
      await page.waitForLoadState("load");
      // A page restored from the bfcache fires pageshow, not load.
      await page.goBack({ waitUntil: "commit" });
      await page.waitForURL(atPath("/"), { waitUntil: "commit" });
      await barButton(page).waitFor({ state: "visible" });
      await page.waitForTimeout(400);
      const restored = await page.evaluate(() => !!window.__restoredFromBfcache);
      check(`${tag}: Back restored the home page from the bfcache`, restored);
      const state = await buttonState(barButton(page));
      check(`${tag}: bfcache Back, the hero button is usable again`, usable(state, "Check Availability"), JSON.stringify(state));
      await context.close();
    } else {
      // Simulated restore: the booking page's full load is held, the page is frozen where Back
      // would find it ("Checking…" while the next page opens), then gets pageshow persisted.
      const { context, page } = await newPage(browser, viewport, { blockClientNavigation: true });
      let leaving = false;
      await context.route(/\/book\//, (route) => {
        if (route.request().resourceType() !== "document") return route.fallback();
        leaving = true; // never answered
      });
      await page.goto(`${url}/`, { waitUntil: "load" });
      await barButton(page).waitFor();
      await fillBar(page, start);
      await barButton(page).click();
      const deadline = Date.now() + 15000;
      while (!leaving && Date.now() < deadline) await page.waitForTimeout(100);
      check(`${tag}: the booking page opens with a full page load`, leaving);
      await page.evaluate(() => {
        window.stop();
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      });
      await page.waitForTimeout(400);
      const state = await buttonState(barButton(page));
      check(`${tag}: simulated bfcache Back, the hero button is usable again`, usable(state, "Check Availability"), JSON.stringify(state));
      await context.close();
    }

    // ---- 3. Booking form, client-side Back after a sent request (mock API only) ------
    if (!production && !fakeApi) {
      const { context, page } = await newPage(browser, viewport);
      const query = new URLSearchParams({ pickup: isoAt(start), return: isoAt(start + 2) });
      await page.goto(`${url}/book/dodge-charger-widebody?${query}`, { waitUntil: "load" });
      const form = page.locator("form#booking-form");
      await form.getByText(/Available for your dates/).waitFor({ timeout: 10000 });
      await form.getByLabel("Full name").fill("Jordan Rivera");
      await form.getByLabel("Mobile phone").fill("6315550142");
      await form.getByLabel("Email").fill("jordan@example.com");
      await form.getByLabel("I agree to the").check();
      const send = form.getByRole("button", { name: /Send booking request|Sending/ });
      await send.click();
      await page.waitForURL(/\/booking\?/, { timeout: 15000 });
      await page.getByText("Request sent.").waitFor({ timeout: 10000 });
      await page.goBack();
      await page.waitForURL(/\/book\//);
      await send.waitFor({ state: "visible" });
      await page.waitForTimeout(400);
      const state = await buttonState(send);
      check(`${tag}: Back after a sent request, "Send booking request" is usable`, usable(state, "Send booking request"), JSON.stringify(state));
      await context.close();
    }

    // ---- 3b. Send with Driver details empty: errors shown, the first field focused ------
    {
      const { context, page } = await newPage(browser, viewport);
      const query = new URLSearchParams({ pickup: isoAt(start), return: isoAt(start + 2) });
      await page.goto(`${url}/book/dodge-charger-widebody?${query}`, { waitUntil: "load" });
      const form = page.locator("form#booking-form");
      await form.getByText(/Available for your dates|already booked|Couldn’t check/).waitFor({ timeout: 20000 });
      const send = form.getByRole("button", { name: "Send booking request" });
      check(`${tag}: "Send booking request" is never disabled for missing fields`, !(await send.isDisabled()));
      await send.click();
      await page.waitForTimeout(800);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("autocomplete") ?? document.activeElement?.tagName);
      const errors = await form.locator('[aria-invalid="true"]').count();
      check(`${tag}: a refused send shows the errors and focuses the first one`, focused === "name" && errors >= 3, `focused=${focused}, invalid fields=${errors}`);
      await context.close();
    }

    // ---- 4. Timeout, network error, double click (real or fake API) ------------------
    if (production || fakeApi) {
      // Never answers: after 15 s the spinner stops with a message.
      {
        const { context, page } = await newPage(browser, viewport);
        await context.route(/\/api\/availability$/, () => {});
        await page.goto(`${url}/`, { waitUntil: "load" });
        await barButton(page).waitFor();
        await fillBar(page, start);
        const began = Date.now();
        await barButton(page).click();
        const message = await bar(page)
          .getByText(/Couldn’t check dates/)
          .waitFor({ timeout: 25000 })
          .then(() => true)
          .catch(() => false);
        const seconds = Math.round((Date.now() - began) / 1000);
        check(`${tag}: no answer, a message after about 15 s`, message && seconds >= 14 && seconds <= 20, `${seconds} s`);
        check(`${tag}: no answer, the button is usable`, usable(await buttonState(barButton(page)), "Check Availability"));
        await context.close();
      }
      // Network error.
      {
        const { context, page } = await newPage(browser, viewport);
        await context.route(/\/api\/availability$/, (route) => route.abort("internetdisconnected"));
        await page.goto(`${url}/`, { waitUntil: "load" });
        await barButton(page).waitFor();
        await fillBar(page, start);
        await barButton(page).click();
        const message = await bar(page)
          .getByRole("status")
          .filter({ hasText: /./ })
          .waitFor({ timeout: 10000 })
          .then(() => true)
          .catch(() => false);
        check(`${tag}: network error, a message`, message, ((await bar(page).getByRole("status").textContent()) ?? "").trim());
        check(`${tag}: network error, the button is usable`, usable(await buttonState(barButton(page)), "Check Availability"));
        await context.close();
      }
      // A double click while the request is in flight sends one request.
      {
        const { context, page } = await newPage(browser, viewport);
        let requests = 0;
        await context.route(/\/api\/availability$/, async (route) => {
          requests++;
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await route.fallback();
        });
        await page.goto(`${url}/`, { waitUntil: "load" });
        await barButton(page).waitFor();
        await fillBar(page, start);
        await barButton(page).click();
        await barButton(page).click({ force: true }).catch(() => {});
        await barButton(page).dispatchEvent("click").catch(() => {});
        await page.waitForURL(/\/book\//, { timeout: 15000 }).catch(() => {});
        check(`${tag}: a double click sends one availability request`, requests === 1, `${requests} sent`);
        await context.close();
      }
    }
  } catch (error) {
    check(`${tag}: ran to the end`, false, error.message.split("\n")[0]);
  } finally {
    await browser.close();
  }
}

for (const engineName of Object.keys(engines)) {
  if (only && only !== engineName) continue;
  for (const viewport of Object.keys(viewports)) await run(engineName, viewport);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
