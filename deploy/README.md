# Production server

Live since 2026-10-15 at **https://buenoexoticsny.com** (admin panel: https://buenoexoticsny.com/be).

| | |
|---|---|
| Server | VPS 67.223.117.17, Ubuntu 24.04, 2 CPUs, 2 GB RAM + 4 GB swap, 40 GB disk |
| Code | `/opt/bueno` (`backend/`, `frontend/`, `deploy/`) |
| Settings and secrets | `/opt/bueno/deploy/.env` (root only; never copied off the server) |
| Containers | `cd /opt/bueno/deploy && docker compose ps` |
| Backups | `/var/backups/bueno`, daily at 04:15 UTC by `/etc/cron.d/bueno-backup`, kept 14 days |
| Firewall | ufw: only 22, 80, 443 |

## How it fits together

Caddy takes ports 80 and 443, gets and renews the Let's Encrypt certificates, sends `www.` to the bare domain, and routes by path: `/api`, `/be` (admin), Livewire and Filament's assets to the Laravel container, everything else to the Next.js container. One address, so no CORS. MariaDB, the API, the scheduler, the queue worker and the website are not reachable from outside. The `queue` container (same image as the API, `php artisan queue:work`) sends queued emails: today only the review request after a return.

Two things are different from a developer's machine because of the server's virtual CPU ("QEMU Virtual CPU version 2.5+", no SSE4.2, no x86-64-v2):

- **MariaDB 11.4 instead of MySQL 8.4.** The `mysql:8.4` image stops with "Fatal glibc error: CPU does not support x86-64-v2". Laravel uses its `mariadb` driver.
- **No image resizing on the server.** sharp, which Next's image optimizer needs, cannot load there (neither the native build nor the WebAssembly one: "Wasm SIMD unsupported"). The site's images are resized in advance by `scripts/images.mjs` into `frontend/public/images/w/`, and `frontend/lib/imageLoader.ts` picks the right file. After changing a site image, run `node scripts/images.mjs` before deploying.

## Deploying a change

Since 2026-10-30 the code goes through GitHub (https://github.com/kanefrayzy/car-rental, public). `/opt/bueno` on the server is a git checkout of `main` (sparse: `backend`, `frontend`, `deploy`, `scripts`); it pulls over HTTPS. `deploy/.env` is not in the repository and stays on the server.

Commit, then from the repo root on a developer machine:

```bash
npm run deploy                 # push main, then the server pulls it and rebuilds what changed
npm run deploy -- frontend     # force a part too: frontend, backend, caddy or all
```

`scripts/deploy.mjs` refuses uncommitted changes (the server would not get them) and any branch other than `main`, pushes, then runs `deploy/deploy.sh` on the server over `ssh bueno`. That script can also be run on the server itself (`/opt/bueno/deploy/deploy.sh [part]`). It:

- fetches `main` and resets the checkout to it (the server never has its own changes);
- rebuilds from the changed paths: `frontend/` the website, `backend/` the API image (backend, scheduler, queue), `deploy/docker-compose.yml` everything; `deploy/Caddyfile` restarts Caddy (the file is bind-mounted and git puts a new file in its place, so the running Caddy keeps the old copy; `caddy reload` does not help, 2026-10-21);
- removes dangling images (the 40 GB disk was 79% full on 2026-10-30);
- waits until the home page and `/api/settings` answer, then prints the containers' status.

Filament's published CSS, JS and fonts (`backend/public/{css,js,fonts}/filament`) are committed on purpose: the API image does not publish them, so without them the admin panel loses its styles.

To roll back, revert the commit and deploy again (`git revert <sha> && npm run deploy`). The code as it was just before the switch to git is in `/root/bueno-pre-git-2026-10-29.tgz` on the server.

The API container runs the database migrations on every start. Building the website takes a few minutes on this server.

## Blog

Posts are written in the admin panel (`/be/posts`). After a post is published, changed or deleted, the API's queue worker calls the website's `/internal/revalidate` straight over the Docker network (Caddy answers 404 for `/internal/*` from outside), and the blog pages, the sitemap and the RSS feed refresh at once. Both containers need the same `BLOG_REVALIDATE_SECRET` in `deploy/.env` (`openssl rand -hex 32`); without it the site still picks changes up within a few minutes. A scheduled post is announced by the scheduler (`blog:revalidate-due`, every minute) when its time comes.

The website is built while the API may be out of reach, so right after a deploy its blog can be empty for a moment; `docker compose exec backend php artisan blog:revalidate` refreshes it at once. Pictures live in the backend storage volume (`storage/app/public/blog`), served by Apache under `/storage`, and are in the daily backup with it. Run artisan commands that may write pictures as the web server's user (`docker compose exec -u www-data backend php artisan ...`): a folder made by root there cannot be written by Apache until the next restart, which hands `storage/` back to `www-data`; the upload then fails with a message instead of saving.

## Email

Sent through Resend (SMTP `smtp.resend.com:587`, user `resend`, the API key as the password, in `deploy/.env`), from `bookings@buenoexoticsny.com`. The domain is verified in the Resend account. The key can only send, so it cannot list or change domains: that is done in the Resend dashboard. Nothing receives mail at `bookings@`; customers' replies go to `RENTAL_OWNER_EMAIL`. To test without mailing anyone, send to `delivered@resend.dev`.

The thank-you email with the "Leave a review" button goes out 3 hours after "Mark as returned" in the admin panel, only once `GOOGLE_REVIEW_URL` is set in `deploy/.env` (the Google Business Profile's "Ask for reviews" link; empty for now). After setting it: `docker compose up -d backend queue`.

## Card deposits (Stripe)

Test mode since 2026-10-16: `STRIPE_KEY` (pk_test, compiled into the website), `STRIPE_SECRET` and `STRIPE_WEBHOOK_SECRET` in `deploy/.env`. The webhook endpoint in the Stripe dashboard is https://buenoexoticsny.com/api/stripe/webhook; it sends payment_intent.succeeded and charge.refunded, which the API uses.

- The rental itself (price plus tax) is paid online after the owner confirms: the confirmation email has a Pay button to the customer's booking page (/booking), due before pickup. The admin shows Rental: Due / Paid / Refunded, has "Rental paid" for cash, and refunds it when a paid booking is cancelled (toggle in the cancel dialog).
- The customer pays the deposit on their booking page (/booking), which opens right after the request and is linked from every email. It is charged at once (a card hold would lapse after about a week) and refunded from the admin panel: "Refund deposit" (full, or less fees) after the return, or automatically when a paid request is declined or cancelled. A payment that lands on an already cancelled booking is refunded automatically.
- Payment methods come from the dashboard (Settings > Payment methods); Stripe no longer takes a list from the code. Keep it to card, Apple Pay, Google Pay and Link: bank debits take days and can bounce.
- Going live: swap all three values for the live ones (pk_live, sk_live, and the signing secret of a live-mode webhook endpoint with the same URL and events), set the live payment methods the same way, then `docker compose up -d --build`.
- Test card: 4242 4242 4242 4242, any future date, any CVC and ZIP. 4000 0000 0000 0002 is declined.

## Day to day

- Logs: `docker compose logs -f backend` (or `frontend`, `caddy`, `scheduler`, `queue`). Failed queued jobs: `docker compose exec backend php artisan queue:failed`.
- Admin account: `docker compose exec backend php artisan admin:user owner@example.com` creates one or resets a password.
- Restore a backup: `zcat db-DATE.sql.gz | docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" rental'`, and unpack `storage-DATE.tgz` into the backend container's `/var/www/html`.

## Still to set up

- **Owner's email address.** `RENTAL_OWNER_EMAIL` is empty: customers get their emails, the owner gets none (new requests show up only in the admin panel), and customers' replies have nowhere to go. Set it in `deploy/.env`, then `docker compose up -d backend scheduler queue`.
- **SSH.** The server still uses the hosting company's root password. Change it, and preferably sign in with a key and turn password login off.
- **Off-server backups.** The daily copies stay on the same machine.
