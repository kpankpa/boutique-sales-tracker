# Slawn POS

A lightweight, multi-branch web application for a boutique in Ghana. It covers the browser installer, staff authentication, a fast point-of-sale screen, a small CRM, and owner reporting. WhatsApp/SMS notifications are intentionally deferred; the database already records events in `notification_outbox` for a future delivery worker.

## Current phase

Phase 1–4 of `DEVELOPMENT_PLAN.md` are implemented as a working prototype:

- Browser installer at `/install`
- Admin and cashier authentication with role and branch scoping
- Product catalogue with categories and sizes (shoes, clothing, trousers/shorts, accessories)
- Fast sale entry with size selection per style
- Dexie-backed offline outbox with replay-safe client references
- Stock conflicts surfaced in the POS with adjust, retry and void actions
- Stock tracking per branch and size, with opening stock, adjustments and reorder alerts
- Customer records with consent timestamp and credit fields
- Daily branch summary, low stock, audit log and notification outbox

Notification delivery, barcode labels and GRA E-VAT are not implemented yet.

## Stack

- Next.js 16 App Router, React 19
- libSQL client with SQLite locally and hosted libSQL/Turso on Vercel
- Server-side signed-cookie sessions
- Vanilla CSS design system defined in `UI_UX_GUIDE.md`
- Dexie for durable IndexedDB queueing of offline sales
- Service worker for app-shell caching; `src/app/manifest.json` for home-screen installation

## Architecture

The project follows MVVM:

```
src/
  app/                 Views as routes + thin API handlers
  models/              Database, security, repositories, services
    repositories/      All SQL lives here
    services/          Business rules (installer, auth, sales, admin, reports)
  viewmodels/          Client hooks: useSession, useInstaller, usePos, useAdmin
    offline/           Dexie outbox: durable queue and sync state transitions
  views/               Presentational components and screens
    components/        Reusable UI kit
```

Rules:

- Models never import React.
- Views never contain SQL or fetch logic.
- Viewmodels call `/api/*` and expose state and actions to views.
- API route handlers parse requests and delegate to model services.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The app redirects to `/install`. After installation it redirects to `/login`.

Development defaults to `DATABASE_URL=file:data/pos.db`. The `data` folder is created automatically.

## First-time setup

1. Open `/install`.
2. Prepare the database.
3. Enter company name and one or more branches.
4. Create the admin account.
5. Optionally load sample products and customers.
6. Finish. The installer locks itself.

Sign in as the admin, then create cashiers under **Admin → Staff**. Cashiers can sign in with a 4–6 digit PIN.

## Offline sales and stock conflicts

When the browser is offline, a sale is written to a Dexie table in IndexedDB — not to `localStorage`. Each record keeps its own `clientRef`, status and conflict details, so a crash or refresh cannot lose it. A single-flight sync runs on startup, on the `online` event, and when **Sync now** is tapped. A record left in `syncing` by a closed tab is reset to `pending` on the next load.

The server treats `clientRef` as an idempotency key: a retry returns the original receipt instead of creating a second sale. Stock is checked inside the same transaction that writes the sale, so stock can never go negative.

If stock moved after the sale was queued, the server returns `400` with `INSUFFICIENT_STOCK` and the item details. The sale stays in the outbox with status `conflict` and appears in the POS. The cashier or admin can:

- **Add stock** — a positive adjustment for that branch, then **Retry sale**. Cashiers may only add stock in their own branch; reducing stock is admin-only.
- **Retry sale** — resends the same `clientRef`; a successful record leaves the outbox.
- **Void sale** — removes the unsynced sale from the device.

Admins also have **Admin → Stock** for deliveries, stock counts and write-offs. Every adjustment is written to the audit log.

## Product sizes

Products have a `category` and optional `size`. Categories include preset sizes:

- **Shoes**: EU sizes (38–46), custom allowed.
- **Dresses / shirts**: XS–XXL, Free size.
- **Trousers / shorts**: waist sizes (28–42).
- **Accessories / Other**: no size, or custom.

In Admin → Products, pick a category, enter a style code, select sizes, and save once. The app creates one SKU per size (`STYLE-SIZE`), tracks stock per branch and size, and the POS prompts for size when selling. Opening stock is applied per size.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:data/pos.db` locally, `libsql://…` on Vercel |
| `DATABASE_AUTH_TOKEN` | Turso token; leave empty for local file |
| `SESSION_SECRET` | Long random string used to sign session cookies |
| `LOGIN_MAX_ATTEMPTS` | Failed sign-ins before a 15-minute lockout (default 5) |
| `AUDIT_RETENTION_DAYS` | Days of audit history to keep (minimum 30, default 365) |

Never commit `.env.local`.

## Security and backups

- Sessions are signed with `SESSION_SECRET` and expire after eight hours. The POS shows a warning in the last five minutes.
- Failed sign-ins are counted per IP and username in the `login_attempts` table. Five failures in 15 minutes lock that pair for 15 minutes. Because the counter is in the database, it works across serverless instances.
- Cashiers may only add stock in their own branch. Only admins can reduce stock, manage staff and branches, or export customer records.
- Unexpected API errors are logged on the server and returned as a generic message in production.

### Back up

Local SQLite:

```bash
npm run backup
npm run verify:backup -- backups/<file>.db
```

`npm run backup` uses `VACUUM INTO`, so the copy is consistent even while the app is running. Backups are ignored by git. Schedule it with cron or Task Scheduler and keep at least seven daily copies off the machine.

Hosted libSQL, using the Turso CLI:

```bash
turso db shell <database-name> .dump > backups/pos-$(date +%F).sql
```

### Retain audit history

```bash
npm run prune:audit
```

This removes audit rows older than `AUDIT_RETENTION_DAYS` (365 days by default, 30-day minimum). Run it monthly from cron, Task Scheduler or CI. For a hosted database, set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in that runner. Take a backup first, and keep at least 30 days of history for incident review.

### Restore

Stop the app, copy the backup over `data/pos.db`, start the app, sign in and confirm sales and stock counts. A restore drill was completed on 23 November 2026: `PRAGMA integrity_check` returned `ok` and all table counts matched the live database.

## Deploy to Vercel

1. Create a libSQL/Turso database.
2. Create a Vercel project from this repository.
3. Add `DATABASE_URL`, `DATABASE_AUTH_TOKEN` and a long random `SESSION_SECRET`. Optionally add `LOGIN_MAX_ATTEMPTS` and `AUDIT_RETENTION_DAYS`.
4. Deploy and open `/install`.
5. Smoke test: install → sign in → add product → record sale → view daily summary.
6. Schedule backups and `npm run prune:audit` from a machine or CI job that has the same database variables.

`vercel.json` adds baseline security headers.

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/status` | Install state and database label |
| POST | `/api/install` | `prepare` or `finish` |
| POST | `/api/auth/login` | Password or PIN sign-in |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/meta` | Branches visible to the user |
| GET/POST | `/api/products` | Catalogue; POST accepts `category`, `size` or `sizes[]` + `baseSku` for variants |
| GET/POST | `/api/customers` | Small CRM |
| GET | `/api/customers/export` | Export customer records (admin) |
| POST | `/api/customers/deactivate` | Deactivate a customer without losing sale history (admin) |
| GET/POST | `/api/sales` | Sales history and sale capture |
| GET | `/api/reports/daily` | Branch summary |
| GET | `/api/stock/low` | Low-stock list |
| GET | `/api/stock` | Stock on hand (admin) |
| POST | `/api/stock` | Adjust stock; admin may reduce, cashier may only add in their branch |
| GET/POST | `/api/users` | Staff management (admin) |
| GET/POST | `/api/branches` | Branch management |
| GET | `/api/outbox` | Pending notification events |
| GET | `/api/audit` | Audit log |

## Data protection note

Customer phone numbers are personal data under Ghana's Data Protection Act, 2012 (Act 843). The customer form records a consent timestamp. Keep the data minimal, provide export/delete on request, and register the business with the Data Protection Commission before real customer data is loaded at scale.

## Quality checks

```bash
npm run build
npm audit
npm run backup
npm run verify:backup -- backups/<file>.db
```

A full smoke test is documented in `DEVELOPMENT_PLAN.md` phase 7.
