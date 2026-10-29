# Backend: booking API

Laravel 13 (PHP 8.3) API for the rental site. It checks availability, stores booking requests, then the customer's driver's license and proof of insurance through a signed upload link, emails the owner and the customer, and takes the deposit through Stripe once Stripe keys are set.

It also serves the owner's admin panel at `/be` (Filament): booking requests, a calendar and closed dates. The website is the Next.js app in `/frontend`; the one file there that talks to this API is `frontend/lib/api.ts`.

## Run it

With Docker, from the repo root (website, API, MySQL and a mail inbox together):

```bash
docker compose up --build
```

Without Docker (SQLite, emails written to `storage/logs/laravel.log`):

```bash
cd backend
composer setup        # install, create .env, app key, tables, the car
composer serve        # http://localhost:8000
```

Use `composer serve`, not `php artisan serve`: it raises PHP's 2 MB upload limit so that 10 MB documents are accepted.

Then point the site at it: put `NEXT_PUBLIC_API_URL=http://localhost:8000/api` in `frontend/.env.local` and restart the site.

Queued jobs (the review request below) need a worker: `php artisan queue:work`. Without one they wait in the `jobs` table. In Docker the `queue` container runs it.

Tests: `composer test` (183 tests; they use an in-memory database and fake storage, mail and Stripe).

## Endpoints

All under `/api`. Requests and responses use camelCase. Errors are JSON: `{"message": "..."}`, plus `{"errors": {"field": ["..."]}}` with status 422 for invalid input. Messages are written for the visitor, and the site shows them as they are.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/cars` | Active cars, in the shape of `frontend/config/cars.ts`. |
| `POST` | `/availability` | Is the car free for the dates, and what it costs. |
| `POST` | `/bookings` | Create a booking request (JSON). |
| `POST` | `/contact` | The website's contact form (/contact and the home page): `firstName`, `lastName`, `email`, `phone`, `occasion` (a key of `rental.contact_topics`), optional `preferredDates` (text), `message` (10 to 2,000 characters), honeypot `company` (must be empty; if not, the answer is the same but nothing is sent). Emailed to `RENTAL_CONTACT_EMAIL` (info@buenoexoticsny.com) with Reply-To the sender. 5 sent messages per IP per hour (429 after). |
| `GET`, `POST` | `/bookings/{bookingId}/upload?expires=…&signature=…` | The customer's booking page: `GET` is its status (price, payments, documents, hold), `POST` the document upload (`multipart/form-data`). Signed link, 7 days, returned with the request and in every email. |
| `POST` | `/bookings/{bookingId}/deposit` | Start the deposit payment. |
| `GET` | `/bookings/{bookingId}/documents/{license\|insurance}` | Download a document. Signed links only. |
| `POST` | `/stripe/webhook` | Called by Stripe; marks deposits as paid. |
| `GET` | `/blog/posts?page=1&perPage=12` | Live blog posts, newest first (`perPage` up to 100), with `meta` (`page`, `perPage`, `total`, `lastPage`). Drafts and posts scheduled for later are never listed. |
| `GET` | `/blog/posts/{slug}` | One live post with its Markdown. `404` for drafts, scheduled and unknown posts. The old slug of a renamed post answers `301`, `Location` the new address and body `{"slug": "<new>"}`. |
| `GET` | `/blog/preview/{postId}?expires=…&signature=…` | Any post, for the admin panel's Preview link (signed, 7 days). |

`POST /availability`

```json
{ "carSlug": "dodge-charger-widebody", "pickupDate": "2026-10-20", "pickupTime": "10:00", "returnDate": "2026-10-23", "returnTime": "10:00" }
```
```json
{ "available": true, "days": 3, "pricePerDay": 499, "totalUsd": 1497 }
```

`POST /bookings` takes the same five fields plus `name`, `phone`, `email` and `acceptTerms: true` (the Rental Terms checkbox). The documents come afterwards, on the customer's booking page (the website's `/booking`), which posts `license` and `insurance` to the upload route; when both are on file the owner gets an email. It answers `201` with the signed link to that page, which the site opens at once:

```json
{
  "bookingId": "01K7...", "status": "pending_deposit", "depositUsd": 1000,
  "link": { "booking": "01K7...", "expires": "1792664474", "signature": "0b51…" }
}
```

or `409` if the dates were taken in the meantime.

`POST /bookings/{bookingId}/deposit` answers `{ "bookingId", "amountUsd", "clientSecret" }`. `clientSecret` is for Stripe's payment form in the browser; it is `null` while Stripe is not configured.

## Rules

Numbers live in `config/rental.php` and are set through `.env`.

- **Price.** Always taken from the `cars` table. Anything about price in a request is ignored. The price and total are copied onto the booking, so later price changes do not alter existing bookings.
- **Dates.** "Today" is the business's day (`RENTAL_TIMEZONE`, default New York), not the server's. Rentals are 1 to 30 days and start at most a year ahead.
- **Times.** Pick-up and return are half-hour slots from 7:00 AM to 11:00 PM (`rental.hours`), New York time, sent as "HH:MM". Pick-up must be later than now; return must be after pick-up (the same day is fine). Days are charged per started 24 hours from the pick-up time, on the wall clock (`AppSupportRentalTime::billedDays`): 10:00 to 10:00 three days later is 3 days, to 10:30 is 4.
- **Overlap.** Both end days count as taken: a car returned on the 14th cannot go out again on the 14th.
- **Statuses.** `pending_deposit` (new request), `deposit_paid`, `confirmed`, `returned` (the owner marked the car back; only from confirmed, and not before the pick-up day), `cancelled`. A returned booking cannot be cancelled; its deposit can still be refunded and an unpaid rental still paid.
- **Which bookings block dates.** Confirmed and returned ones and ones with a paid deposit always. A new request with no deposit holds its dates for `RENTAL_HOLD_HOURS` (24), then they open up again.
- **Uploads.** JPG, PNG, WebP or PDF, 10 MB each, checked by file content.
- **Phone.** US numbers only, stored as `+1XXXXXXXXXX`.
- **Rate limits.** 60 requests a minute per IP, 6 a minute for booking requests.

## Blog

Posts (`posts` table, `App\Models\Post`) are written in the admin panel under **Blog** (`/be/posts`) as Markdown, read by the website's `/blog` pages (`frontend/lib/blog.ts`). Limits and picture sizes are in `config/blog.php`.

- **Publishing.** The buttons under the editor set the status: Save draft, Publish (now; a post published before keeps its first date), Schedule (a date and time ahead, New York time), and for a post on the site Save changes and Move to drafts. A published post whose time is still ahead is "scheduled" and answers 404 like a draft. Preview opens the last saved version on the website through a signed link (7 days, noindex).
- **Derived on every save.** The slug from the title if left empty (`-2`, `-3` when taken), the reading time (220 words a minute), the excerpt from the first paragraph if left empty. A pasted article that opens with `# Title` gives the title (when the field is empty) and loses that line, since the page shows the title as its H1.
- **Renamed posts.** Changing the slug of a live post keeps the old one in `post_slug_redirects`; the API answers 301 for it and the website redirects (308, which search engines treat like 301). The redirect points at the post, so renaming twice never chains. No post may take another post's old slug.
- **Pictures.** The cover (at least 1,200 px wide, Google's minimum for article images) and pictures inside the text (the editor's attach button, drag and drop or paste) are JPG, PNG or WebP up to 8 MB and 6,000 px a side, checked by content. `App\Services\BlogImages` re-encodes them as WebP at most 1,600 px wide on the public disk (`storage/app/public/blog`, served at `/storage`), with 480, 800 and 1,200 px copies; the size is in the file name (`…_1600x900.webp`), which the website's image loader reads. A replaced or deleted cover is deleted with its copies.
- **The website hears about changes.** Publishing, editing a live post, unpublishing and deleting queue `App\Jobs\RevalidateBlog`, which posts to `BLOG_REVALIDATE_URL` with `BLOG_REVALIDATE_SECRET` as a bearer token (retried while the site is down). Editing a draft sends nothing. `blog:revalidate-due` (scheduler, every minute) announces scheduled posts whose time has come; `blog:revalidate` refreshes everything by hand.
- **Rate limit.** The blog routes have their own limit (`RENTAL_BLOG_RATE`, 300 a minute per IP): the website's server makes nearly all the calls from one address.

## Customer documents

Licenses and insurance cards are personal data.

- They are stored on the private disk (`storage/app/private/bookings/{bookingId}/`) under random names. Nothing in `/public` points at them, and the framework's own file-serving route for that disk is switched off.
- Two ways to open one: the link in the owner's email (signed with the app key, one document, expires after `RENTAL_DOCUMENT_LINK_DAYS`, 14), or the booking page in the admin panel after signing in.
- They are deleted `RENTAL_DOCUMENT_RETENTION_DAYS` (180) days after the return date, or after a cancellation, by `php artisan bookings:prune-documents`. The scheduler runs it every night at 3:30 New York time (`php artisan schedule:work`; in Docker, the `scheduler` container). The booking record stays; the panel shows when the files were deleted. The privacy page on the site states the same number (`documentRetentionDays` in `frontend/config/site.ts`): change both.
- Behind an HTTPS proxy set `TRUSTED_PROXIES`, or the signed links fail their check.
- Changing `APP_KEY` breaks every link already sent. In Docker the key is created once and kept in the storage volume.

## Emails

- To the owner (`RENTAL_OWNER_EMAIL`): the request, with the document links. Replying to it writes to the customer. If the address is empty, this email is not sent.
- To the customer: a confirmation that the request arrived; later, when the owner confirms or cancels it in the panel (the owner can skip these).
- To the customer, `RENTAL_REVIEW_DELAY_HOURS` (3) after the owner marks the car returned: a thank-you with a "Leave a review" button to `GOOGLE_REVIEW_URL` (the Google Business Profile's "Ask for reviews" link). Not sent while that is empty. Queued (`App\Jobs\SendReviewRequest`), sent once per booking at most (`review_requested_at`); a failed send is retried a few times.

A mail failure is logged and never fails the booking. Locally mail goes to the log; in Docker it goes to the inbox at http://localhost:8025.

## Stripe

Off by default. To turn it on, set in `.env`:

```
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

and point a Stripe webhook at `https://<api-host>/api/stripe/webhook` for the events `payment_intent.succeeded` and `payment_intent.amount_capturable_updated`.

A deposit is marked paid only by that webhook, never by the browser. `STRIPE_CAPTURE_METHOD=manual` places a hold instead of charging; Stripe releases an uncaptured hold after about a week, so it only suits short lead times.

The site's deposit step does not show Stripe's payment form yet. The API side is ready and tested against a fake gateway and signed test events; it has not been run against a real Stripe account.

## Layout

```
app/
  Enums/                    BookingStatus, DocumentType
  Http/Controllers/Api/     one controller per endpoint
  Http/Requests/            validation (ValidatesRentalPeriod is shared)
  Http/Resources/           CarResource
  Filament/                 the admin panel: resources (bookings, closed dates, price), calendar page, dashboard widgets
  Mail/                     the emails
  Models/                   Car, Booking, BookingDocument, BlockedPeriod, User (admin accounts)
  Services/                 AvailabilityService, BookingManager (owner's actions), DocumentRetention, Deposits/
config/rental.php           business rules
config/cors.php             only FRONTEND_URL may call the API from a browser
database/seeders/CarSeeder  the car; adds it if missing, never overwrites edits
docker/                     entrypoint, Apache and PHP settings for the image
routes/api.php              the route list
routes/console.php          admin:user, bookings:prune-documents and the nightly schedule
dev-server.php              router for `composer serve`
tests/Feature/              the behaviour above, as tests
```

## Admin panel

`/be` on the API's address (in Docker: http://localhost:8000/be). Sign-in only; there is no sign-up.

- **Accounts.** `php artisan admin:user owner@example.com` creates one or sets a new password (it asks for it; `--password=` for scripts). In Docker, `ADMIN_EMAIL` and `ADMIN_PASSWORD` create the account on the first start; after that the owner changes the password in the panel (Profile) and restarts keep it.
- **Dashboard.** Requests waiting for an answer, whether the car is out today, the next pickup, the month's confirmed total.
- **Bookings.** Tabs: waiting, upcoming, past (returned, plus confirmed ones whose return date went by; the badge counts those not marked returned yet), cancelled. A booking page shows the customer, the money, the documents (only to a signed-in owner), the review request (sent, scheduled, or why not) and private notes. Buttons: Confirm, Decline or Cancel (optionally emailing the customer, with a message), Deposit received (for deposits taken outside Stripe), Mark as returned, Send review request (sends it now; greyed out without `GOOGLE_REVIEW_URL`), Notes.
- **Calendar.** A month of bookings and closed dates.
- **Closed dates.** Dates the owner closes by hand (service, a private trip). The website treats them as booked. Dates that a customer already holds cannot be closed.
- **Price.** The daily price. The website reads it from `GET /api/cars` (`frontend/lib/catalog.ts`) and shows a change within a minute or two. Requests already sent keep the price they were made at. The car's name, photos and specs are part of the website, not the panel.

The rules behind the buttons live in `app/Services/BookingManager.php`, not in the panel:

- Confirming, and marking a deposit received on an open request, are refused when another booking that holds dates or closed dates overlap. The owner sees why.
- A request whose 24-hour hold ran out can still be confirmed if its dates are free.
- Bookings are never deleted from the panel; cancelling keeps the record and frees the dates.

The owner's email for a new request links straight to it in the panel.

## Not built yet

- Stripe's payment form on the site, and refunds.
- Delivery addresses, extra-mileage charges, and a second car (the tables and seeder already allow more cars).
