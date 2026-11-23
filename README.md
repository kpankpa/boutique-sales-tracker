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

Notification delivery and GRA E-VAT are not implemented yet.

## Stack

- Next.js 16 App Router, React 19
- Dual-driver data layer: SQLite locally, hosted PostgreSQL (Neon) on Vercel; libSQL/Turso still supported
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

Admins also have **Admin → Stock** for deliveries, stock counts and write-offs. Every item/branch row is editable straight from the table: click the pencil in the **On hand** column, type the new quantity (or use the −/+ steppers), then press the check to save or the × to cancel. The app sends the difference as an audited adjustment, so stock can never go negative. A branch filter sits in the card header for busy shops. Every adjustment is written to the audit log.

## Product sizes

Products have a `category` and optional `size`. Categories include preset sizes:

- **Shoes**: EU sizes (38–46), custom allowed.
- **Dresses / shirts**: XS–XXL, Free size.
- **Trousers / shorts**: waist sizes (28–42).
- **Accessories / Other**: no size, or custom.

In Admin → Products, pick a category, enter a style code, select sizes, and save once. The app creates one SKU per size (`STYLE-SIZE`), tracks stock per branch and size, and the POS prompts for size when selling. Opening stock is applied per size.

## Barcode and QR scanning

Every product can carry a manufacturer barcode (EAN/UPC/Code128, or any code of 3–64 letters, digits, dashes, dots or underscores). Barcodes are unique across the catalogue; item codes (SKUs) still work everywhere as a fallback.

**Hardware scanners (USB/Bluetooth keyboard-wedge):** plug the scanner in and scan anywhere on the POS screen — no setup needed. The app detects the fast keystroke burst (≥4 characters within 1.5 s, terminated by Enter/Tab) and adds the item to the cart, even when no input is focused. Scanning into a focused text field fills that field instead. The same works in Admin for assigning barcodes.

**Camera scanning:** tap **Scan with camera** on the POS (or **Scan** next to a barcode field in Admin). The modal uses the browser's native `BarcodeDetector` when available and falls back to a lazy-loaded ZXing decoder (EAN/UPC, Code 128/39, ITF, Codabar and QR). It supports the torch on capable phones, beeps and flashes on each hit, ignores repeat reads of the same code for 2.5 s, and offers manual entry when no camera is available. Camera access requires HTTPS or `localhost`.

**Scanning flow:** a scan resolves barcode first, then SKU. The POS matches its locally loaded catalogue first, so scanning keeps working offline; when online it also asks `GET /api/lookup?code=` for items added since the page loaded. Scanning an out-of-stock item is blocked with a clear message.

**QR labels:** Admin → Products → **Label** prints a shelf tag with a QR code containing the barcode (or the SKU when there is none), the name, size and price. **Print label sheet** prints one label per product using the current search filter, laid out for A4. Any scanner — hardware or camera — reads these labels at the till.

**Receipts:** completing a sale opens a printable receipt with a QR code of the receipt number. Tap any receipt number in POS or Admin → Sales (or **Scan receipt** with the camera) to reopen it. Receipt lookup is branch-scoped for cashiers. Printing uses the browser print dialog; only the receipt/label area prints.

## Product photos

Admin → Products has a **Choose photo** picker in the add form and in each row's **Edit** mode. Images are resized to at most 900px and compressed to JPEG in the browser before being saved, so photos stay small even when uploaded from a phone. POS product cards and the Admin table show thumbnails; removing a photo is a click away.

When S3 is configured, the server issues a short-lived presigned PUT URL and the browser uploads straight to the bucket; the stored value is a public HTTPS URL. Without S3 (the default for local development), the compressed image is stored inline as a data URL on the product — no external service required. Both stores are accepted by the API, so switching to S3 later does not break existing products.

For S3, create a bucket with public object reads (or point `S3_PUBLIC_BASE_URL` at your CDN) and add a CORS rule allowing `PUT` from your app's origin, e.g.:

```json
[{ "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"] }]
```

Keep write credentials server-side; the browser only ever receives the presigned URL.

Neon Storage is supported through the same interface: set `AWS_ENDPOINT_URL_S3` to your Neon Storage endpoint and `S3_BUCKET` to the bucket name (`sales-bin` in this project). The app switches to path-style object URLs (`https://<endpoint>/<bucket>/<key>`) and derives the public URL automatically; virtual-hosted URLs are not used. Neon Storage's CORS already allows `PUT` with `content-type` from any origin.

## Push local data to Neon

After installing and preparing data locally, copy the SQLite database into the Neon PostgreSQL database with:

```bash
npm run migrate:neon
```

The script reads `DATABASE_URL` from `.env.production.local` (or the process environment), creates the schema, replaces the hosted tables with the local rows (preserving IDs and repairing sequences), then verifies that all table counts match. It refuses to run when the local database is not installed. This **overwrites** the Neon database, so take a backup first.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:data/pos.db` locally, `postgresql://…` (Neon) on Vercel |
| `DATABASE_AUTH_TOKEN` | Turso token only; leave empty for SQLite and PostgreSQL |
| `SESSION_SECRET` | Long random string used to sign session cookies |
| `LOGIN_MAX_ATTEMPTS` | Failed sign-ins before a 15-minute lockout (default 5) |
| `AUDIT_RETENTION_DAYS` | Days of audit history to keep (minimum 30, default 365) |
| `AWS_ENDPOINT_URL_S3` | Optional S3-compatible endpoint (e.g. Neon Storage). Enables path-style `https://<endpoint>/<bucket>/<key>` URLs |
| `AWS_REGION` | S3 bucket region; needed together with the three variables below to enable direct uploads |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 write credentials, used only on the server to sign uploads |
| `S3_BUCKET` | Bucket name for product photos (`sales-bin` on Neon Storage) |
| `S3_PUBLIC_BASE_URL` | Optional public base URL (e.g. CloudFront) instead of the derived endpoint/bucket URL |

Never commit `.env.local` or `.env.production.local` (both are gitignored). The Neon connection string and `SESSION_SECRET` live only in those files or in Vercel's environment settings.

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

Hosted PostgreSQL (Neon): Neon keeps automatic point-in-time backups and lets you restore from the dashboard (Branches → Restore). For an extra logical copy:

```bash
pg_dump "<DATABASE_URL>" > backups/pos-$(date +%F).sql
```

Legacy hosted libSQL, using the Turso CLI:

```bash
turso db shell <database-name> .dump > backups/pos-$(date +%F).sql
```

### Retain audit history

```bash
npm run prune:audit
```

This removes audit rows older than `AUDIT_RETENTION_DAYS` (365 days by default, 30-day minimum). Run it monthly from cron, Task Scheduler or CI. For a hosted database, set `DATABASE_URL` (and `DATABASE_AUTH_TOKEN` for Turso) in that runner. The scripts work with SQLite and PostgreSQL. Take a backup first, and keep at least 30 days of history for incident review.

### Restore

Stop the app, copy the backup over `data/pos.db`, start the app, sign in and confirm sales and stock counts. A restore drill was completed on 23 November 2026: `PRAGMA integrity_check` returned `ok` and all table counts matched the live database.

## Deploy to Vercel

1. Create a Neon PostgreSQL project and copy the pooled connection string (`…-pooler.…neon.tech/neondb?sslmode=require`).
2. Create a Vercel project from this repository.
3. Add `DATABASE_URL` (the Neon string) and a long random `SESSION_SECRET`. For product photos also add `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `S3_BUCKET=sales-bin` (plus optional `S3_PUBLIC_BASE_URL`). Optionally add `LOGIN_MAX_ATTEMPTS` and `AUDIT_RETENTION_DAYS`. No `DATABASE_AUTH_TOKEN` is needed for Neon.
4. Deploy and open `/install`.
5. Smoke test: install → sign in → add product → record sale → view daily summary.
6. Use Neon's dashboard restore for recovery; schedule `npm run prune:audit` from a machine or CI job that has the same database variables.

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
| GET/POST | `/api/products` | Catalogue; POST accepts `category`, `size` or `sizes[]` + `baseSku` for variants, and optional `barcode` |
| GET | `/api/lookup?code=` | Resolve a scanned barcode or SKU to a product |
| GET/POST | `/api/customers` | Small CRM |
| GET | `/api/customers/export` | Export customer records (admin) |
| POST | `/api/customers/deactivate` | Deactivate a customer without losing sale history (admin) |
| GET/POST | `/api/sales` | Sales history and sale capture |
| GET | `/api/sales/receipt?no=` | Full receipt with lines, branch-scoped |
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
