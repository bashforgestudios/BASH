# Bash — Live Events & Clubs

Ticket booking for live events and club nights in India. Built with Next.js 14 (App Router), MongoDB and JWT sessions.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the two required values below
npm run dev                  # http://localhost:3000
```

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB Atlas connection string, or `mongodb://127.0.0.1:27017` locally |
| `AUTH_SECRET` | yes | At least 32 characters. Generate with `openssl rand -hex 32` |
| `MONGODB_DB` | no | Database name (default `bash`) |
| `DEMO_USER` | no | `on` creates demo accounts in production; `off` disables them everywhere |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Ticket emails. Without a key nothing is sent, but each attempt is logged in `email_logs` |
| `LEADS_NOTIFY_EMAIL` | no | Emails these addresses when a club submits "Request access" |
| `DATABASE_URL` | no | Only for the one-time Postgres import (see Migration) |

Tables, indexes and seed data are created automatically on the first request. Open `/api/health` to check that the database and secret are set.

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm run db:migrate`.

## Roles and panels

Every account has one role, and each role lands on its own page after sign-in.

| Role | Lands on | What it can do |
| --- | --- | --- |
| `user` | `/` and `/tickets` | Browses clubs in the detected city, books tickets, sees ticket status, manages their profile |
| `club_admin` | `/club` | Creates and publishes events (flyer, genre tags, booking type, ticket categories with quotas, homepage placement). Reviews the booking queue (approve, reject, cancel, transfer, resend ticket). Creates gate accounts. Reads the scan log. |
| `gate` | `/gate` | Scans ticket codes at the door. Each scan is logged as admitted, already used, declined or invalid. |
| `developer` | `/dev` | All clubs (capacity, quota, bookings, revenue, staff), all users (change roles), all bookings, club applications and leads, payment gateways |

Demo accounts (development by default; production only with `DEMO_USER=on`):

| Email | Password | Role |
| --- | --- | --- |
| `test@bash.in` | `test1234` | user |
| `club@bash.in` | `club1234` | club_admin (Ballrs, Pune) |
| `gate@bash.in` | `gate1234` | gate (Ballrs, Pune) |
| `dev@bash.in` | `dev12345` | developer |

Change or disable these before going live.

## Authentication (JWT)

Sessions are signed JWTs (HS256, `jose`) kept in httpOnly cookies, so page scripts never see them.

| Token | Lifetime | Where | Notes |
| --- | --- | --- | --- |
| Access | 15 min | `bash_at` cookie, or `Authorization: Bearer` for API clients | Carries `sub`, `role`, `club`, `tv` (token version) |
| Refresh | 7 days | `bash_rt` cookie, sent only to `/api/auth/*` | Stored in MongoDB by `jti`, rotated on every use. Replaying a used token revokes the whole session family |

Where it is enforced:

- **`src/middleware.js`** (Edge) guards pages and APIs before they run. `/club` needs `club_admin`; `/gate` needs `gate` or `club_admin`; `/dev` needs `developer`; `/tickets`, `/profile` and `/book/*` need any signed-in account. An expired access token with a live session is refreshed silently, no session goes to `/login?next=...`, and the wrong role goes to its own home page. `/api/dev`, `/api/club` and `/api/gate` get the same coarse check.
- **`requireRole()` / `requireUser()`** in every route handler re-read the role and club from the database, so a demoted account loses access at once. Role changes, password changes, removing a gate and "log out everywhere" bump the user's `token_version`, which invalidates all of their access tokens.
- **CSRF:** cookies are `SameSite=Lax`, and middleware rejects cookie-authenticated writes from another site's `Origin`.
- **Throttling** (MongoDB TTL collection `rate_limits`): 5 failed logins per email and 20 per IP per 10 minutes, 10 sign-ups per IP per hour, 5 club requests per IP per hour.
- **Passwords:** scrypt, minimum 8 characters. Login takes the same path for unknown emails so it does not reveal which accounts exist. The post-login `?next=` redirect only accepts same-site paths.

Endpoints: `POST /api/auth/login`, `/register`, `/refresh`, `/logout` (`{"everywhere": true}` signs out every device), `GET /api/auth/me`.

## Booking flow

- **Non-exclusive:** pay, and the ticket is approved straight away and emailed.
- **Guestlist:** free. The guest uploads an ID photo; the booking waits in the club's Pending queue until the club approves it, and only then is a ticket issued.
- **Exclusive:** pay, and the booking waits in Pending for club review. If the club rejects it a refund is needed (not automated yet).

Statuses: `awaiting_payment` → `pending` → `approved` / `rejected` / `cancelled`. Every decision except transfer deletes the guest's ID photo and records when it was deleted; the club sees that confirmation in the booking drawer.

Quotas: each ticket category has a quota. The quotas of all published events on one date at one club must fit inside the venue capacity. The check runs on save and publish, and the server enforces it. Payment and gate admission use conditional updates, so two simultaneous payments or two gates cannot both succeed.

## Profile

`/profile` shows the flip member card (photos, Bash ID, QR code, details on the back) and quick links.

- **Edit profile** opens one popup with name, mobile, city and Instagram, with Cancel and Save. Email and date of birth are locked.
- The **gear icon** opens Settings: Appearance (see below), change password (other devices are signed out), notification switches (stored on this device) and log out with a confirmation step.

## Appearance and colours

Settings → Appearance has four options, saved on the device:

| Option | Behaviour |
| --- | --- |
| Light / Dark | Always that theme |
| Device | Follows the phone or computer's own appearance setting, live (operating systems can switch it at sunset or on a schedule) |
| Time of day | Light from 6 am to 6 pm by the device clock, dark otherwise (`DAY_START` / `NIGHT_START` in `src/lib/theme.js`) |

The default is Device. A small script in `<head>` sets the theme before the first paint, so there is no flash of the wrong theme, and the browser's status-bar colour follows it.

**How colours work.** Components never hard-code colours. `src/app/globals.css` defines the palette as CSS variables (dark in `:root`, light in `[data-theme="light"]`), and `tailwind.config.js` exposes them as utilities:

| Utility | Meaning |
| --- | --- |
| `bg-canvas`, `bg-surface` | Page background, popups and drawers |
| `text-fg`, `bg-fg/5`, `border-fg/10` | Text and subtle tints (these flip between themes) |
| `bg-brand`, `text-brand-ink`, `text-brand-fg` | Accent fill, accent as text, text on an accent fill |
| `danger`, `success`, `warning` (+ `-ink` for text) | Status colours |

Put `.on-media` on any container that sits on a photo (event cards, hero, member card, scanner) so its text stays light in both themes. Printed-style tickets and QR codes stay on paper colours in both themes.

**Changing the accent.** The default palette is "Ember" (vermilion on warm black and paper). To try another, edit the `--brand*` values in `globals.css`, or set `data-accent="volt"` (acid lime) or `data-accent="cobalt"` (flat blue) on `<html>`. Nothing else needs to change.

## Location

On every page load the browser asks for location once. The position is mapped to the nearest city with clubs, shown under the Bash logo. If location is refused, the last chosen city is used, with Pune as the default.

## Database (MongoDB)

Collections: `users`, `events`, `clubs`, `bookings`, `id_photos`, `scan_logs`, `email_logs`, `payment_gateways`, `business_leads`, `club_applications`, `club_documents`, `assets`, `refresh_tokens`, `rate_limits`. Seed events and clubs stay in `src/data`.

Every document keeps its own string `id` next to Mongo's `_id`. Notable indexes: unique ticket code, a covered index for counting seats and dashboard totals (answered from the index without reading bookings), and TTL expiry for refresh tokens and rate-limit rows.

### Migration from Postgres (Neon)

```bash
# .env.local has MONGODB_URI; add the old DATABASE_URL temporarily
npm run db:migrate
```

`scripts/migrate-from-postgres.mjs` copies every table into MongoDB (upserts by id, safe to rerun). Passwords keep working; everyone signs in once more. Try it on a throwaway database first and compare row counts.

## Performance notes

- Event filtering, ranking and limits run inside MongoDB. Public lists are "lean" (no description, lineup, reviews, FAQs); the event detail page loads the full record. `GET /api/events` returns at most 100 events by default (`?limit=` up to 200) and sends the true count in the `X-Total-Count` header.
- Seed events and clubs are indexed by id in memory (O(1) lookups). The developer dashboards group data with hash maps in one pass.
- `src/lib/memo.js` is a short TTL cache that also shares one computation between simultaneous requests. It is used only for listings and dashboards (a few seconds old is fine), never for quotas, payments or auth.
- Public endpoints send `Cache-Control` (events 15 s, clubs 60 s); uploaded images are immutable for a year.
- The home search waits for a pause in typing and cancels outdated requests. Images load lazily and the camera scanner loads only on the gate page.

On a test database with 3,000 events and 60,000 bookings the events list went from about 1.6 s to about 16 ms, and the developer dashboard from about 2.1 s to under 0.1 s. The cache is per server instance; for many instances consider Redis.

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Create a MongoDB Atlas cluster (or add it from the Vercel Marketplace), allow Vercel's IPs, and set `MONGODB_URI`.
3. Add `AUTH_SECRET` (at least 32 characters) under Project Settings → Environment Variables.
4. Optional: `RESEND_API_KEY` and `EMAIL_FROM` for ticket emails.
5. Deploy, then open `/api/health`.

## Routes

| URL | What |
| --- | --- |
| `/` | Home: events and clubs in your city |
| `/events/[id]` | Event detail |
| `/book/[id]?tier=VIP` | Booking |
| `/tickets` | My tickets |
| `/profile` | Profile, edit popup, settings |
| `/club` | Club panel (club_admin) |
| `/gate` | Gate scanner (gate, club_admin) |
| `/dev` | Developer panel (developer) |
| `/login`, `/register`, `/business` | Sign in, sign up, club request form |
| `/api/auth/*`, `/api/health` | Login, register, refresh, logout, me, health check |

## Project layout

```
src/app          pages and API routes (route handlers are thin)
src/views        full-page client components
src/components   shared UI (Modal, AppShell, cards, QR)
src/lib          stores (MongoDB), auth, jwt, roles, memo cache, helpers
src/middleware.js  Edge route protection
src/data         seed events and clubs
scripts          Postgres to MongoDB migration
```

## Not built yet

- **Payments** are simulated. The gateway chosen in the Developer panel is recorded on each booking, but no money moves. Wire the SDK into `src/app/api/bookings/pay/route.js`.
- **Refunds** for rejected exclusive bookings are not automated.
- **Email verification and password reset** do not exist yet.
- Flyers, profile photos, ID photos and club documents are stored in MongoDB as base64. For real traffic move them to object storage (S3 or R2).
