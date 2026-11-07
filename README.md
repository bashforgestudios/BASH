# Bash — Live Events & Clubs (Next.js)

Next.js 14 (App Router) port of the "Bash" ticket-booking frontend that was originally a Create React App build.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in MONGODB_URI and AUTH_SECRET (openssl rand -hex 32)
npm run dev                  # http://localhost:3000
```

## Roles and panels

Every account has one role. Each role lands on its own page after sign-in.

| Role | Lands on | What it can do |
| --- | --- | --- |
| `user` | `/` and `/tickets` | Sees clubs in the detected city, books tickets, sees ticket status |
| `club_admin` | `/club` | Creates and publishes events (flyer, genre tags, booking type, ticket categories with quotas, homepage placement). Reviews the booking queue (approve, reject, cancel, transfer, resend ticket). Creates gate accounts. Reads the scan log. |
| `gate` | `/gate` | Scans ticket codes at the door. Each scan is logged as admitted, already used, declined or invalid. |
| `developer` | `/dev` | Everything: all clubs (capacity, quota allocation, bookings, revenue, staff), all users (change roles), all bookings, payment gateways. |

Demo accounts, created on first request in development (in production only when `DEMO_USER=on`; `DEMO_USER=off` disables them everywhere):

| Email | Password | Role |
| --- | --- | --- |
| `test@bash.in` | `test1234` | user |
| `club@bash.in` | `club1234` | club_admin (Ballrs, Pune) |
| `gate@bash.in` | `gate1234` | gate (Ballrs, Pune) |
| `dev@bash.in` | `dev12345` | developer |

Change these passwords before going live.

## Booking flow

- **Non-exclusive**: pay, and the ticket is approved straight away and emailed.
- **Guestlist**: free. The guest uploads an ID photo. The booking waits in the club's Pending queue until the club approves it, and only then is a ticket issued.
- **Exclusive**: pay, and the booking waits in Pending for club review. If the club rejects it, a refund is needed (the refund itself is not automated).

Statuses: `awaiting_payment` → `pending` → `approved` / `rejected` / `cancelled`. Every decision except transfer deletes the guest's ID photo and records `photo deleted at`. The club can see that confirmation in the drawer.

Quotas: each ticket category has a quota. The quotas for all published events on one date at one club must fit inside the venue capacity. The check runs on save and on publish, and the server enforces it.

## Location

On every page load the browser asks for location once. The GPS fix is mapped to the nearest city we run clubs in, and that city is shown under the Bash logo. If location is refused, the last city the user chose is used, and Pune is the default.

## Authentication (JWT)

Sessions are signed JWTs (HS256, `jose`) kept in httpOnly cookies, so page scripts never see them.

| Token | Lifetime | Where | Notes |
| --- | --- | --- | --- |
| Access | 15 min | `bash_at` cookie, or `Authorization: Bearer` for API clients | Carries `sub`, `role`, `club`, `tv` (token version) |
| Refresh | 7 days | `bash_rt` cookie, sent only to `/api/auth/*` | Stored in MongoDB by `jti`; rotated on every use. Replaying a used token revokes the whole family |

Where it is enforced:

- **`src/middleware.js`** (Edge) protects pages and APIs before they run. `/club` needs `club_admin`, `/gate` needs `gate` or `club_admin`, `/dev` needs `developer`, `/tickets`, `/profile` and `/book/*` need any signed-in account. An expired access token with a live session is refreshed silently; no session goes to `/login?next=...`; the wrong role goes to its own home page. `/api/dev`, `/api/club` and `/api/gate` get the same coarse role check.
- **`requireRole()` / `requireUser()`** in every route handler re-read the role and club from the database, so a demoted account loses access at once. Role changes, password changes, removing a gate and "log out everywhere" bump the user's `token_version`, which invalidates all of their access tokens immediately.
- **CSRF**: cookies are `SameSite=Lax`, and middleware rejects cookie-authenticated writes whose `Origin` is another site.
- **Throttling** (MongoDB TTL collection `rate_limits`): 5 failed logins per email and 20 per IP per 10 minutes, 10 sign-ups per IP per hour, 5 club requests per IP per hour.
- Passwords: scrypt, minimum 8 characters. Login takes the same path for unknown emails, so it does not reveal which accounts exist.

Endpoints: `POST /api/auth/login`, `/register`, `/refresh`, `/logout` (`{"everywhere": true}` signs out every device), `GET /api/auth/me`.

## Database (MongoDB)

Collections: `users`, `events`, `clubs`, `bookings`, `id_photos`, `scan_logs`, `email_logs`, `payment_gateways`, `business_leads`, `club_applications`, `club_documents`, `assets`, `refresh_tokens`, `rate_limits`. Indexes (including the unique ticket code, and TTL expiry for refresh tokens and rate-limit rows) are created automatically on the first request. Seed events and clubs stay in `src/data`.

Every document has its own string `id` (the same hex ids as before) next to Mongo's `_id`, so API responses have the same shape as the Postgres version. Ticket admission and payment use conditional updates (`used_at: null`, `status: "awaiting_payment"`), so two gates or two payments cannot both win.

### Moving existing Neon data

```bash
# .env.local has MONGODB_URI; add the old DATABASE_URL temporarily
npm run db:migrate
```

`scripts/migrate-from-postgres.mjs` copies every table into MongoDB (upserts by id, safe to rerun). Passwords keep working; everyone signs in once more.

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Create a MongoDB Atlas cluster (or add it from the Vercel Marketplace), allow Vercel's IPs (or `0.0.0.0/0` with a strong password), and set `MONGODB_URI`.
3. Add `AUTH_SECRET` (`openssl rand -hex 32`, at least 32 characters) under Project Settings > Environment Variables.
4. Optional: `RESEND_API_KEY` and `EMAIL_FROM` for ticket emails.
5. Deploy, then open `/api/health` to confirm the database and secret are set.

## Not yet real

- **Payments** are simulated. The gateway chosen in the Developer panel is recorded on each booking, but no money moves. Wire the SDK into `src/app/api/bookings/pay/route.js`.
- **Gate camera scanning**: tickets now show a QR (generated in `src/lib/qr.js`, no extra package) that encodes the `BASH-XXXXXXXX` code. The gate page accepts a typed code or a handheld/keyboard-style scanner; it has no built-in camera scanner yet.
- **Refunds** for rejected exclusive bookings are not automated.

## Routes

| URL | File |
| --- | --- |
| `/` | `src/app/page.jsx` → `src/views/HomePage.jsx` |
| `/club` | Club Panel (club_admin) |
| `/gate` | Gate scanner (gate, club_admin) |
| `/dev` | Developer Panel (developer) |
| `/events/[id]` | `src/app/events/[id]/page.jsx` |
| `/book/[id]?tier=VIP` | `src/app/book/[id]/page.jsx` |
| `/tickets` | `src/app/tickets/page.jsx` |
| `/login`, `/register` | `src/app/login`, `src/app/register` |
| `/api/auth/*`, `/api/health` | login, register, refresh, logout, me, health check |

## What changed from the CRA version

- `react-router-dom` replaced with `next/link` and `next/navigation` (small `useNav` and `NavLink` helpers keep the old call sites unchanged).
- `REACT_APP_BACKEND_URL` replaced by a `/api` rewrite to `BACKEND_URL`.
- Components using hooks or browser APIs are marked `"use client"`.
- `index.css` and `App.css` merged into `src/app/globals.css`; Tailwind config is the default (the original config wasn't in the export).
