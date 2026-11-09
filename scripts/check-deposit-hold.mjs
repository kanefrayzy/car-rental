// The deposit hold's card step in a real browser, against a local site and API on Stripe's TEST
// keys (owner, 2026-11-10). What the PHP tests cannot do: Stripe's card form, its 3D Secure
// window, and the booking page's answer.
//
//   node scripts/check-deposit-hold.mjs --url http://localhost:3200 --api http://localhost:8200/api --backend backend
//
// Cards (Stripe test numbers):
//   4242 4242 4242 4242  saved; pick-up three days out, so the hold is only scheduled
//   4000 0025 0000 3155  3D Secure when saved; pick-up within 24 hours, so the hold goes on at once
//   4000 0027 6000 3184  3D Secure on every payment: the hold off session fails ("Hold failed"),
//                        the customer confirms it on the page, and it is on hold
//   4000 0000 0000 0002  declined when saved: the page says so, no card is saved
//   4000 0000 0000 9995  insufficient funds when saved: the same
// Bookings near pick-up overlap each other, so each one is cancelled through `php artisan` in
// --backend (which also releases its hold). Never point this at production.
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const url = arg("--url", "http://localhost:3200").replace(/\/+$/, "");
const api = arg("--api", "http://localhost:8200/api").replace(/\/+$/, "");
const backend = resolve(arg("--backend", "backend"));
if (/buenoexoticsny\.com/.test(url + api)) throw new Error("This check makes bookings and card holds: run it locally only.");
const shots = join(dirname(fileURLToPath(import.meta.url)), ".shots");
await mkdir(shots, { recursive: true });

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

/** New York wall time of now plus `minutes`, on the half hour, inside 7:00 AM to 11:00 PM. */
function nySlot(minutes) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(Date.now() + minutes * 60_000))
      .map((part) => [part.type, part.value]),
  );
  let date = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
  let total = Math.ceil((+parts.hour * 60 + +parts.minute) / 30) * 30;
  if (total > 23 * 60) {
    date = new Date(date.getTime() + 86_400_000);
    total = 7 * 60;
  }
  if (total < 7 * 60) total = 7 * 60;
  const day = date.toISOString().slice(0, 10);
  const next = new Date(date.getTime() + 86_400_000).toISOString().slice(0, 10);
  const time = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return { pickupDate: day, returnDate: next, time };
}

async function book(slot, email) {
  const response = await fetch(`${api}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      carSlug: "dodge-charger-widebody",
      pickupDate: slot.pickupDate,
      pickupTime: slot.time,
      returnDate: slot.returnDate,
      returnTime: slot.time,
      name: "Hold Test",
      phone: "(631) 555-0142",
      email,
      acceptTerms: true,
    }),
  });
  const body = await response.json();
  if (response.status !== 201) throw new Error(`booking refused: ${response.status} ${JSON.stringify(body)}`);
  const { booking, expires, signature } = body.link;
  return { id: booking, page: `${url}/booking?${new URLSearchParams({ booking, expires, signature })}` };
}

function artisan(code) {
  return execFileSync("php", ["artisan", "tinker", `--execute=${code}`], { cwd: backend, encoding: "utf8" }).trim();
}
const cancel = (id) =>
  artisan(`$b = App\\Models\\Booking::where('public_id', '${id}')->first(); if ($b && $b->status->value !== 'cancelled') app(App\\Services\\BookingManager::class)->cancel($b, notifyCustomer: false); echo 'ok';`);
const holdState = (id) =>
  artisan(`$b = App\\Models\\Booking::where('public_id', '${id}')->first(); echo json_encode(['status' => $b->status->value, 'hold' => $b->hold_status?->value, 'card' => $b->card_label, 'intent' => $b->hold_payment_intent_id]);`);

/** Types a card into Stripe's Payment Element (iframes). */
async function fillCard(page, number) {
  const frame = page.frameLocator('iframe[title="Secure payment input frame"]').first();
  await frame.locator('input[name="number"]').waitFor({ timeout: 30_000 });
  await frame.locator('input[name="number"]').fill(number);
  await frame.locator('input[name="expiry"]').fill("12 / 34");
  await frame.locator('input[name="cvc"]').fill("123");
  const zip = frame.locator('input[name="postalCode"]');
  if (await zip.count()) await zip.fill("11772");
}

/** Stripe's test 3D Secure window (testmode-acs.stripe.com, inside its modal): press "Complete". */
async function completeThreeDs(page) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const frame = page.frames().find((candidate) => candidate.url().includes("3d_secure_2_test"));
    const button = frame?.getByRole("button", { name: "Complete" });
    if (button && (await button.isVisible().catch(() => false))) {
      // The test page wires its buttons a moment after it shows them; click until it closes.
      await page.waitForTimeout(1500);
      for (let tries = 0; tries < 5; tries++) {
        await button.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);
        if (!page.frames().some((candidate) => candidate.url().includes("3d_secure_2_test"))) return true;
        if (!(await button.isVisible().catch(() => false))) return true;
      }
      return false;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

/** After "Save card": the step moves on (saved, held at once, or held and refused). */
const savedOnPage = () =>
  page
    .getByText(/^(Card saved|\$500 is on hold|Your bank didn’t approve)/)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(async (error) => {
      await page.screenshot({ path: join(shots, "hold-failed-step.png"), fullPage: true });
      throw error;
    });

async function openCardStep(target) {
  await page.goto(target.page);
  await page.getByText("Security deposit · $500 refundable hold").waitFor({ timeout: 20_000 });
}

const created = [];
try {
  // 1. 4242, pick-up in three days: saved, hold scheduled.
  const later = nySlot(3 * 24 * 60);
  const first = await book(later, "delivered@resend.dev");
  created.push(first.id);
  await openCardStep(first);
  check("the booking page asks for the card", await page.getByText("Next: save your card for the $500 refundable hold. Nothing is charged.").isVisible());
  check("the card step shows the deposit summary", await page.getByText("Security deposit: $500 refundable hold on your card. Nothing is charged. It’s released after the car is returned.").first().isVisible());
  check("the card step says documents can come later", await page.getByText("Your license and insurance can come later, any time before pickup.", { exact: false }).isVisible());
  check("the reservation time names its zone", await page.getByText(/Your dates are reserved until .+ ET\./).isVisible());
  check("and the agreement",await page.getByText("I authorize a $500 hold on my card 24 hours before pickup.", { exact: false }).isVisible());
  await fillCard(page, "4242424242424242");
  await page.getByRole("button", { name: "Save card" }).click();
  check("saving without the tick asks for it", await page.getByText("Tick the box to agree to the $500 hold.").isVisible());
  await page.getByRole("checkbox", { name: /I authorize a \$500 hold/ }).check();
  await page.getByRole("button", { name: "Save card" }).click();
  await page.getByText(/^Card saved.*We place the \$500 hold on it/).waitFor({ timeout: 30_000 });
  check("a saved card is confirmed on the page", true);
  await page.reload();
  await page.getByText(/Card saved \(Visa •••• 4242\)\. We place the \$500 hold on it on .+ ET, 24 hours before pickup/).waitFor({ timeout: 20_000 });  check("after a reload the page says when the hold goes on, in ET", true);
  const firstState = JSON.parse(holdState(first.id));
  check("the API has the card and a scheduled hold", firstState.status === "card_saved" && firstState.hold === "scheduled" && firstState.intent === null, JSON.stringify(firstState));
  await page.screenshot({ path: join(shots, "hold-card-saved.png"), fullPage: true });

  // 2. 3155, pick-up within 24 hours: 3D Secure when saving, then the hold at once.
  const soon = nySlot(120);
  const second = await book(soon, "delivered@resend.dev");
  created.push(second.id);
  await openCardStep(second);
  await fillCard(page, "4000002500003155");
  await page.getByRole("checkbox", { name: /I authorize a \$500 hold/ }).check();
  await page.getByRole("button", { name: "Save card" }).click();
  check("3D Secure opens for 4000 0025 0000 3155", await completeThreeDs(page));
  await savedOnPage();
  await page.reload();
  await page.getByText("$500 is on hold on your card", { exact: false }).waitFor({ timeout: 20_000 });
  const secondState = JSON.parse(holdState(second.id));
  check("pick-up within 24 hours: the hold is on at once", secondState.hold === "on_hold" && !!secondState.intent, JSON.stringify(secondState));
  cancel(second.id);
  check("cancelling releases it", JSON.parse(holdState(second.id)).hold === "released");

  // 3. 3184: 3D Secure every time. The off-session hold fails; the customer confirms it.
  const third = await book(nySlot(120), "delivered@resend.dev");
  created.push(third.id);
  await openCardStep(third);
  await fillCard(page, "4000002760003184");
  await page.getByRole("checkbox", { name: /I authorize a \$500 hold/ }).check();
  await page.getByRole("button", { name: "Save card" }).click();
  check("3D Secure opens for 4000 0027 6000 3184", await completeThreeDs(page));
  await savedOnPage();
  await page.reload();
  await page.getByText("Action needed: confirm the hold").waitFor({ timeout: 20_000 });
  check("the failed hold asks the customer to confirm it", await page.getByText("Your bank didn’t approve the $500 hold.", { exact: false }).isVisible());
  check("the API shows Hold failed", JSON.parse(holdState(third.id)).hold === "failed");
  await fillCard(page, "4000002760003184");
  await page.getByRole("button", { name: "Confirm the $500 hold" }).click();
  check("3D Secure opens for the hold", await completeThreeDs(page));
  await page.getByText("$500 is on hold on your card", { exact: false }).waitFor({ timeout: 30_000 });
  await page.reload();
  await page.getByText("$500 is on hold on your card", { exact: false }).waitFor({ timeout: 20_000 });
  check("confirmed by the customer: on hold", JSON.parse(holdState(third.id)).hold === "on_hold");
  await page.screenshot({ path: join(shots, "hold-on-hold.png"), fullPage: true });
  cancel(third.id);

  // 4. Cards the bank refuses when they are saved.
  for (const [number, label] of [
    ["4000000000000002", "a declined card"],
    ["4000000000009995", "insufficient funds"],
  ]) {
    const target = await book(nySlot(120), "delivered@resend.dev");
    created.push(target.id);
    await openCardStep(target);
    await fillCard(page, number);
    await page.getByRole("checkbox", { name: /I authorize a \$500 hold/ }).check();
    await page.getByRole("button", { name: "Save card" }).click();
    const alert = page.getByRole("alert").filter({ hasText: /declined|insufficient/i });
    await alert.first().waitFor({ timeout: 30_000 });
    check(`${label} is refused on the page`, true, (await alert.first().textContent())?.trim());
    check(`${label}: no card saved`, JSON.parse(holdState(target.id)).status === "pending_deposit");
    cancel(target.id);
  }
  check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
  for (const id of created) {
    try {
      cancel(id);
    } catch {
      // Already cancelled.
    }
  }
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
