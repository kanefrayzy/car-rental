// End-to-end check of the page's interactions against a running site.
//
//   node scripts/check-interactions.mjs [--url http://localhost:3000] [--api http://localhost:8000/api]
//
// Covers the gallery (arrows, thumbnails, keys, swipe, full-screen viewer) and the booking
// flow (hero bar to the booking page, availability check, validation, keeping what was typed
// when leaving the page, the booking page and its document upload). Prints one line per check
// and exits 1 on a failure.
// Works against the mock and against the real API. Each run books random dates; with --api
// it asks the API for free ones first, so earlier runs and closed dates do not get in the way.
// Prices are read from the page, so a price changed in the admin panel does not break it.
// Screenshots go to scripts/.shots/.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const url = args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://localhost:3000";
const shots = join(dirname(fileURLToPath(import.meta.url)), ".shots");
await mkdir(shots, { recursive: true });

const png = join(shots, "sample-license.png");
await writeFile(
  png,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const txt = join(shots, "sample-notes.txt");
await writeFile(txt, "not an image");

// Each viewport books its own week, somewhere in the next ten months.
let base = 0;
const pickBase = (index) => 10 + index * 150 + Math.floor(Math.random() * 140);

const isoAt = (start, offset) => {
  const d = new Date();
  d.setDate(d.getDate() + start + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const iso = (offset) => isoAt(base, offset);

// With a real API (--api http://localhost:8000/api), earlier runs, closed dates and real
// bookings take dates, so the run asks the API for a free window first. The flow uses the
// days base..base+4.
const api = args.includes("--api") ? args[args.indexOf("--api") + 1].replace(/\/+$/, "") : null;
async function pickFreeBase(index) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = pickBase(index);
    if (!api) return candidate;
    const response = await fetch(`${api}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // The API needs the times too since 2026-10-16; the flow keeps the default 10:00 AM.
      body: JSON.stringify({ carSlug: "dodge-charger-widebody", pickupDate: isoAt(candidate, 0), pickupTime: "10:00", returnDate: isoAt(candidate, 4), returnTime: "10:00" }),
    });
    if ((await response.json()).available) return candidate;
  }
  throw new Error("No free five-day window found through the API.");
}

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch();
for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
]) {
  const { name, ...options } = viewport;
  base = await pickFreeBase(name === "desktop" ? 0 : 1);
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    isMobile: options.isMobile,
    hasTouch: options.hasTouch,
  });
  // A site built with a GA4 ID loads gtag.js: serve an empty one, so nothing reaches Google and
  // the site's own events stay readable in window.dataLayer.
  await context.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(url, { waitUntil: "networkidle" });
  console.log(`\n== ${name} ==`);

  // ---- Gallery --------------------------------------------------------------
  const gallery = page.getByRole("group", { name: /photos$/ });
  await gallery.scrollIntoViewIfNeeded();
  const counter = gallery.locator("p[aria-hidden]");
  const thumbs = page.locator("#the-car ul button[aria-label^='Show photo']");
  // Up to five thumbnails (MAX_THUMBS in CarGallery); further photos are reached with the arrows.
  const total = Number((await counter.textContent()).trim().split("/")[1]);
  const thumbCount = await thumbs.count();
  check("gallery shows a thumbnail per photo, five at most", thumbCount === Math.min(total, 5), `${thumbCount} thumbnails, ${total} photos`);
  check("starts on photo 1", (await counter.textContent()).trim() === `1 / ${total}`);

  await gallery.getByRole("button", { name: "Next photo" }).click();
  check("next arrow moves to photo 2", (await counter.textContent()).trim() === `2 / ${total}`);
  check("thumbnail 2 is marked current", (await thumbs.nth(1).getAttribute("aria-current")) === "true");
  const firstLabel = await thumbs.nth(0).getAttribute("aria-label");
  check("thumbnails keep their order", firstLabel.startsWith("Show photo 1"));

  await gallery.getByRole("button", { name: "Previous photo" }).click();
  await gallery.getByRole("button", { name: "Previous photo" }).click();
  check("previous arrow wraps to the last photo", (await counter.textContent()).trim() === `${total} / ${total}`);

  await thumbs.nth(2).click();
  check("thumbnail click selects that photo", (await counter.textContent()).trim() === `3 / ${total}`);

  await gallery.getByRole("button", { name: "Next photo" }).focus();
  await page.keyboard.press("ArrowRight");
  check("arrow key moves on", (await counter.textContent()).trim() === `4 / ${total}`);

  // Swipe left on the photo (pointer events, as a finger would produce).
  const box = await gallery.boundingBox();
  const y = box.y + box.height / 2;
  await page.dispatchEvent("#the-car [aria-roledescription='carousel']", "pointerdown", { clientX: box.x + box.width * 0.75, clientY: y, pointerType: "touch", bubbles: true });
  await page.dispatchEvent("#the-car [aria-roledescription='carousel']", "pointerup", { clientX: box.x + box.width * 0.25, clientY: y, pointerType: "touch", bubbles: true });
  check("swipe left moves on", (await counter.textContent()).trim() === `5 / ${total}`);

  // Full-screen viewer.
  await gallery.getByRole("button", { name: /^View larger/ }).click();
  const viewer = page.getByRole("dialog", { name: "Photo viewer" });
  await viewer.waitFor({ state: "visible" });
  check("click on the photo opens the viewer on the same photo", (await viewer.locator("p").first().textContent()).trim() === `5 / ${total}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(shots, `viewer-${name}.png`) });
  await page.keyboard.press("ArrowRight");
  check("arrow key works in the viewer", (await viewer.locator("p").first().textContent()).trim() === `${(5 % total) + 1} / ${total}`);
  await viewer.getByRole("button", { name: "Next photo" }).click();
  await page.keyboard.press("Escape");
  await viewer.waitFor({ state: "hidden" });
  check("Escape closes the viewer", !(await viewer.isVisible()));
  check("gallery stays on the photo viewed last", (await counter.textContent()).trim() === `${((5 + 1) % total) + 1} / ${total}`);
  // The viewer unmounts a moment after the dialog closes, so give it up to two seconds.
  const scrollRestored = await page
    .waitForFunction(() => document.documentElement.style.overflow === "", null, { timeout: 2000 })
    .then(() => true, () => false);
  check("page scroll is restored", scrollRestored);
  await gallery.screenshot({ path: join(shots, `gallery-${name}.png`) });

  // ---- Booking --------------------------------------------------------------
  await page.evaluate(() => window.scrollTo(0, 0));
  const bar = page.locator("form[aria-label='Check availability']");
  // The price shown on the car card: it can come from the API (changed in the admin panel).
  const price = Number(/\$(\d+)/.exec(await page.locator("#the-car article").first().textContent())[1]);
  const usd = (amount) => `$${amount.toLocaleString("en-US")}`;

  await bar.getByRole("button", { name: "Check Availability" }).click();
  check("empty bar explains what is missing", (await bar.getByRole("status").textContent()) === "Choose a pick-up date.");
  check("and puts focus on the pick-up date", await bar.getByLabel("Pick-up date").evaluate((el) => el === document.activeElement));

  await bar.getByLabel("Pick-up date").fill(iso(0));
  check("after pick-up, focus moves to the return date", await bar.getByLabel("Return date").evaluate((el) => el === document.activeElement));
  await bar.getByLabel("Return date").fill(iso(3));
  await bar.getByLabel("Pick-up time").selectOption("12:00");
  await bar.getByLabel("Return time").selectOption("12:00");
  await bar.getByRole("button", { name: "Check Availability" }).click();
  await page.waitForURL(/\/book\/dodge-charger-widebody\?/, { timeout: 10000 });
  const form = page.locator("main form").filter({ has: page.getByRole("heading", { name: "Choose your dates" }) });
  await form.waitFor();
  check("free dates open the booking page", true);
  check("at the top of the page", (await page.evaluate(() => Math.round(window.scrollY))) === 0, `y=${await page.evaluate(() => Math.round(window.scrollY))}`);
  check("with the dates and times filled in", (await form.getByLabel("Pick-up date").inputValue()) === iso(0) && (await form.getByLabel("Return date").inputValue()) === iso(3) && (await form.getByLabel("Pick-up time").inputValue()) === "12:00");
  await form.getByLabel("Pick-up time").selectOption("10:00");
  await form.getByLabel("Return time").selectOption("10:00");
  await page.getByText("Available for your dates · 3 days").waitFor({ timeout: 8000 });
  check("the page confirms the car is free", true);
  // Booking funnel events (only with a GA4 ID compiled in): the site's events in window.dataLayer.
  const gaEvents = (event) =>
    page.evaluate((event) => (window.dataLayer ? window.dataLayer.filter((e) => e[0] === "event" && e[1] === event).map((e) => e[2]) : null), event);
  const dateEvents = await gaEvents("booking_dates_selected");
  if (dateEvents !== null) {
    check(
      "booking_dates_selected is sent with the days and the answer, no dates or personal data",
      dateEvents.length >= 1 &&
        dateEvents.every((e) => Number.isInteger(e.rental_days) && ["available", "unavailable", "error"].includes(e.availability) && ["link", "draft", "form"].includes(e.dates_from)) &&
        dateEvents.at(-1).availability === "available" && dateEvents.at(-1).rental_days === 3 &&
        !JSON.stringify(dateEvents.map(({ page_location, ...rest }) => rest)).match(/\d{4}-\d{2}-\d{2}|@|Jordan|555/),
      JSON.stringify(dateEvents.map(({ page_location, ...rest }) => rest)),
    );
  }
  const summary = () => page.locator("main dl").filter({ visible: true }).first().textContent();
  check("the price shows days, tax and total", /× 3 days/.test(await summary()) && (await summary()).includes(usd(3 * price)) && /Tax \([\d.]+%\)/.test(await summary()) && (await summary()).includes("Rental total"));
  // Phones and tablets get the total right under the dates; from lg the side panel has it.
  const underDates = page.locator("[data-price-under-dates]");
  if (name === "mobile") {
    const text = (await underDates.textContent()) ?? "";
    check("phones see the total, tax and deposit right under the dates", /× 3 days/.test(text) && text.includes(usd(3 * price)) && /Tax \(/.test(text) && text.includes("Refundable deposit") && text.includes("Nothing is charged now"), text.slice(0, 80));
  } else {
    check("desktop keeps the total in the side panel only", !(await underDates.isVisible()));
  }
  await page.screenshot({ path: join(shots, `booking-form-${name}.png`) });

  await form.getByRole("button", { name: "Send booking request" }).click();
  const alerts = () => form.getByRole("alert").count();
  check("empty details and terms are rejected", (await alerts()) === 4, `${await alerts()} alerts`);
  await form.getByLabel("Full name").fill("Jordan Rivera");
  check("a corrected field loses its error at once", (await alerts()) === 3);
  const detailsViews = await gaEvents("booking_details_view");
  if (detailsViews !== null) check("booking_details_view is sent once the driver details are reached", detailsViews.length === 1, `${detailsViews.length} sent`);
  const phone = form.getByLabel("Mobile phone");
  await phone.pressSequentially("6315550142");
  check("the phone is masked as it is typed", (await phone.inputValue()) === "(631) 555-0142", await phone.inputValue());
  for (let i = 0; i < 5; i++) await phone.press("Backspace");
  check("backspace goes through the formatting", (await phone.inputValue()) === "(631) 55", await phone.inputValue());
  await phone.fill("+1 631 555 0142");
  check("a pasted country code is dropped", (await phone.inputValue()) === "(631) 555-0142", await phone.inputValue());

  // The draft is in this browser, not just this tab.
  const tab = await context.newPage();
  await tab.goto(`${url}/book/dodge-charger-widebody`, { waitUntil: "networkidle" });
  await tab.waitForFunction(() => document.querySelector("main input[autocomplete=name]")?.value === "Jordan Rivera", null, { timeout: 5000 }).catch(() => {});
  check("a new tab keeps what was typed", (await tab.locator("main input[autocomplete=name]").inputValue()) === "Jordan Rivera");
  await tab.close();

  // Leave for the home page and come back: nothing typed is lost.
  await page.goto(url, { waitUntil: "networkidle" });
  if (name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator("nav[aria-label='Mobile']").locator("xpath=..").getByRole("link", { name: "Book Now" }).click();
  } else {
    await page.locator("header").getByRole("link", { name: "Book Now" }).click();
  }
  await page.waitForURL(/\/book\/dodge-charger-widebody$/);
  await form.getByLabel("Full name").waitFor();
  await page.waitForFunction(() => document.querySelector("main input[autocomplete=name]")?.value === "Jordan Rivera", null, { timeout: 5000 }).catch(() => {});
  check("coming back keeps the dates and what was typed", (await form.getByLabel("Full name").inputValue()) === "Jordan Rivera" && (await form.getByLabel("Mobile phone").inputValue()) === "(631) 555-0142" && (await form.getByLabel("Return date").inputValue()) === iso(3));

  // Times: days are counted per 24 hours from the pick-up time.
  check("times default to 10:00 AM", (await form.getByLabel("Pick-up time").inputValue()) === "10:00" && (await form.getByLabel("Return time").inputValue()) === "10:00");
  await form.getByLabel("Return time").selectOption("10:30");
  await page.getByText("Available for your dates · 4 days").waitFor({ timeout: 8000 });
  check("returning half an hour later adds a day", (await summary()).includes(usd(4 * price)));
  await form.getByLabel("Return time").selectOption("10:00");
  await page.getByText("Available for your dates · 3 days").waitFor({ timeout: 8000 });
  // Same-day rental: only slots after the pick-up time can be picked for the return.
  await form.getByLabel("Return date").fill(iso(0));
  const sameDay = await form.getByLabel("Return time").evaluate((select) =>
    [...select.options].filter((option) => !option.disabled).map((option) => option.value),
  );
  check("on the same day, return times start after pick-up", sameDay[0] === "10:30" && sameDay.at(-1) === "23:00", sameDay.slice(0, 2).join(","));
  await form.getByLabel("Return time").selectOption("20:00");
  await page.getByText("Available for your dates · 1 day").waitFor({ timeout: 8000 });
  check("a same-day rental is one day", true);

  // New dates are checked again and repriced.
  await form.getByLabel("Return date").fill(iso(4));
  await form.getByLabel("Return time").selectOption("10:00");
  await page.getByText("Available for your dates · 4 days").waitFor({ timeout: 8000 });
  check("changed dates are checked again", true);
  check("and repriced", (await summary()).includes(usd(4 * price)));
  if (name === "mobile") check("the total under the dates follows the new dates", ((await underDates.textContent()) ?? "").includes("× 4 days"));

  // Tapping a date or time field never moves the page.
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => Math.round(window.scrollY));
  await form.getByLabel("Pick-up date").click();
  await page.keyboard.press("Escape");
  await form.getByLabel("Pick-up time").focus();
  await page.waitForTimeout(300);
  check("tapping a date or time keeps the page where it was", (await page.evaluate(() => Math.round(window.scrollY))) === before);

  await form.getByLabel("Email").fill("jordan@example.com");
  check("the terms link opens /rental-terms", (await form.getByRole("link", { name: "Rental Terms" }).getAttribute("href")) === "/rental-terms");
  await form.getByLabel("I agree to the").check();
  const bookingSubmits = () =>
    page.evaluate(() => (window.dataLayer ? window.dataLayer.filter((entry) => entry[0] === "event" && entry[1] === "booking_submit").length : null));
  check("no booking_submit before the request is sent", ((await bookingSubmits()) ?? 0) === 0);
  await form.getByRole("button", { name: "Send booking request" }).click();
  await page.waitForURL(/\/booking\?booking=/, { timeout: 10000 });
  await page.getByText("Request sent.").waitFor({ timeout: 10000 });
  check("a sent request opens the booking page", true);
  // Counted once, and only now that the API accepted the request (no GA4 ID: nothing to count).
  const submits = await bookingSubmits();
  if (submits !== null) check("booking_submit is sent once, after the API accepted the request", submits === 1, `${submits} sent`);
  const paymentViews = await gaEvents("booking_payment_view");
  if (paymentViews !== null)
    check(
      "booking_payment_view is sent once, for the deposit step",
      paymentViews.length === 1 && paymentViews[0].payment === "deposit",
      JSON.stringify(paymentViews.map(({ page_location, ...rest }) => rest)),
    );
  check("which says what to do next", await page.getByText("Next: pay the").isVisible());
  check("and shows the status", await page.getByText("Waiting for your deposit").isVisible());
  check("the address drops the one-time new=1", !page.url().includes("new=1"));
  await page.screenshot({ path: join(shots, `booking-page-${name}.png`), fullPage: true });

  // Documents on the booking page.
  await page.getByRole("button", { name: "Upload now" }).click();
  await page.getByLabel("Driver’s license").setInputFiles(txt);
  check("a wrong file type is rejected", /isn’t supported/.test((await page.locator("main").getByRole("alert").allTextContents()).join(" ")));
  await page.getByRole("button", { name: "Upload documents" }).click();
  check("both documents are asked for", (await page.locator("main").getByRole("alert").count()) === 2);
  await page.getByLabel("Driver’s license").setInputFiles(png);
  await page.getByLabel("Proof of insurance").setInputFiles(png);
  await page.getByRole("button", { name: "Upload documents" }).click();
  await page.getByText("Both received.").waitFor({ timeout: 10000 });
  check("documents upload on the booking page", true);

  // The next booking starts clean, and the header leads back to this one.
  const bookingId = new URL(page.url()).searchParams.get("booking");
  await page.goto(`${url}/book/dodge-charger-widebody`, { waitUntil: "networkidle" });
  check("after sending, the form starts clean", (await form.getByLabel("Full name").inputValue()) === "" && (await form.getByLabel("Pick-up date").inputValue()) === "");
  if (name === "mobile") await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "My booking" }).filter({ visible: true }).click();
  await page.waitForURL(/\/booking\?booking=/);
  check("My booking leads back to the booking page", new URL(page.url()).searchParams.get("booking") === bookingId);

  const linkPath = new URL(page.url()).pathname;
  await page.goto(`${url}/upload?booking=x&expires=1&signature=y`);
  check("old /upload links lead to the booking page", page.url().includes("/booking?booking=x"), linkPath);
  await page.goto(`${url}/booking`);
  await page.locator("main").getByRole("alert").waitFor();
  check("a link without its signature is explained", (await page.locator("main").getByRole("alert").textContent()).includes("incomplete"));

  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}
await browser.close();

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
