# Bueno Exotics

Website, booking API and admin panel for Bueno Exotics, an exotic car rental in Patchogue, NY. The site reads the name from `frontend/config/site.ts`.

| Folder | What it is |
|---|---|
| `frontend/` | The website: Next.js 16 (App Router, TypeScript, Tailwind v4). |
| `backend/` | The booking API and the owner's admin panel: Laravel 13 with Filament. Availability, booking requests with document uploads, emails, Stripe deposits, closed dates, document deletion. See [backend/README.md](backend/README.md). |
| `design/` | Approved mockups, the client's car photos, and the raw image generations (`design/generated`) the site's pictures are cropped from. Nothing here is published. |
| `scripts/` | Image pipeline, screenshots and the end-to-end interaction check. |

## Run everything with Docker

```bash
docker compose up --build
```

- http://localhost:3000 the website
- http://localhost:8000/be the admin panel
- http://localhost:8000 the API
- http://localhost:8025 every email the API sends (nothing leaves your machine)

If a port is taken, copy `.env.docker.example` to `.env`, change the ports there, and run the command again. To sign in to the admin panel, set `ADMIN_PASSWORD` there before the first start, or make an account with `docker compose exec backend php artisan admin:user you@example.com`.

The stack is the website, the API, a `scheduler` container for nightly jobs, MySQL and Mailpit.

## Run without Docker

The website alone, on its built-in mock (no backend needed):

```bash
npm install                    # tooling (sharp, Playwright)
npm --prefix frontend install  # the app
npm run dev                    # http://localhost:3000
```

With the real API: start it (`cd backend && composer setup && composer serve`), put `NEXT_PUBLIC_API_URL=http://localhost:8000/api` in `frontend/.env.local`, and restart the site.

Other commands, from the repo root: `npm run build`, `npm run start`, `npm run lint`, `npm run shoot` (screenshots at 1440px and 390px), `npm run check` (clicks through the gallery and a full booking; add `-- --url http://localhost:3000`, and `--api http://localhost:8000/api` when the site uses the real API).

## Changing content

- **Daily price:** in the admin panel (Price). The site picks it up within a minute or two. `frontend/config/cars.ts` holds the fallback the site shows when it cannot reach the API.
- Phone, email, Instagram, address, deposit, mileage, delivery, age limit: `frontend/config/site.ts`
- The car's name, specs and gallery: `frontend/config/cars.ts`
- FAQ, steps, requirements: `frontend/config/content.ts`; rental terms and privacy pages: `frontend/app/terms`, `frontend/app/privacy`
- Colors, type scale, radii, shadows: `@theme` in `frontend/app/globals.css`
- Logo, browser and phone icons, link preview image: `node scripts/brand.mjs` builds them all from `design/generated/logo-r3-stencil.svg`
- Booking rules and the deposit actually charged: `backend/.env` and `backend/config/rental.php`

Values tagged `PLACEHOLDER` are not confirmed yet. The deposit and the document retention period exist on both sides (`site.ts` and the API's settings); change both.

## How the site talks to the API

Every form goes through `frontend/lib/api.ts`. With `NEXT_PUBLIC_API_URL` set it calls the Laravel API; without it, the same functions answer from a mock in the browser. No component knows which one is in use.

The price is the one thing the site's server reads from the API (`frontend/lib/catalog.ts`, refreshed about once a minute), at `API_INTERNAL_URL` or else `NEXT_PUBLIC_API_URL`.

## Production

Live at https://buenoexoticsny.com since 2026-10-15. The server, how it is set up, how to deploy a change, backups and what is still to configure (email, Stripe, SSH) are in [deploy/README.md](deploy/README.md). `deploy/docker-compose.yml` is the production stack; the root `docker-compose.yml` is for a developer machine.

Before inviting customers: replace the remaining `PLACEHOLDER` values, set the owner's email address (`RENTAL_OWNER_EMAIL` on the server), and have the client (ideally with a lawyer) review the rental terms and privacy pages.

## Secrets

`.env.local` at the repo root holds `RUNWARE_API_KEY` for image generation. `backend/.env` holds the app key and, later, Stripe keys. All `.env` files are gitignored; only the `.example` files are committed.
