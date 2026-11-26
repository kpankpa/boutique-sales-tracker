# Development Plan — Sneakwise POS

**Scope:** One company, multiple branches. Browser installer, lightweight POS, authentication, small CRM, owner reporting, and a public Sneakwise storefront with cart, wishlist and WhatsApp checkout handoff. Owner notifications remain deferred but designed for.

**Architecture:** MVVM (Model–View–ViewModel) on Next.js App Router.

**Last updated:** 26 November 2026

---

## 1. Phase map

| Phase | Name | Outcome | Status |
|---|---|---|---|
| 0 | Discovery & baseline | Problem confirmed, scope agreed, constraints documented | Done — see `BA_Feasibility_Sales_Notification_App_Ghana.md` |
| 1 | Foundations & installer | Database, design system, browser installer, auth, roles, branches | Done |
| 2 | Core POS | Product catalogue, sale entry, offline queue, stock decrement, receipts | Done |
| 3 | Small CRM | Customers, purchase history, credit, consent records | Done |
| 4 | Admin & reporting | Daily summary, branch filters, audit log, notification outbox | Done |
| 5 | Notifications (deferred) | Owner WhatsApp/SMS delivery worker reading the outbox | Deferred by owner — customer checkout handoff is Phase 10–12 |
| 6 | Hardening | Backups, security review, DPC compliance, error handling | Done |
| 7 | Deployment | Vercel + Neon/PostgreSQL, environment config, smoke tests | Done |
| 8 | Pilot & iteration | Staff training, 2-week pilot, KPI review | In progress — pending storefront pilot |
| 9 | Scale (optional) | Purchase orders, stock counts, GRA E-VAT, multi-company tenancy | Partial — barcode/QR done; rest later |
| 10 | Storefront foundations | Public catalogue API, safe product projection, shop settings | Done |
| 11 | Storefront browsing | Product grid, filters, product cards, wishlist | Done |
| 12 | Cart & WhatsApp checkout | Persistent cart, structured order message, wa.me handoff | Done |
| 13 | Storefront hardening & pilot | Mobile QA, stale-price guard, analytics, owner training | In progress — real-device QA and pilot pending |

---

## 2. Phase 0 — Discovery & baseline

**Goal:** Confirm the business need and the constraints before writing code.

**Activities**
- Research Ghana telecom, payment and retail context.
- Define the problem, stakeholders, objectives and success measures.
- Compare build vs buy.
- Decide hosting, tenancy and deferred scope.

**Deliverables**
- `BA_Feasibility_Sales_Notification_App_Ghana.md`
- Decision record: Vercel-style hosting, single company with branches, notifications later.

**Exit criteria:** Scope and hosting agreed. Done.

---

## 3. Phase 1 — Foundations & installer

**Goal:** A fresh deployment can be set up entirely from the browser, and users can sign in with the right permissions.

### Must-have features
- Database schema creation and migration marker.
- `/staff/install` wizard: environment check, database prepare, company/branch setup, admin account, optional demo data, finish.
- Installer locks itself after completion.
- Authentication: admin password, cashier PIN or password, locked sessions, sign out.
- Roles: `admin`, `cashier`.
- Branch assignment for cashiers; server-side branch scoping.
- Design system and UI component library.
- MVVM folder structure and coding standards.

### Recommended features
- Install wizard progress indicator with clear step labels.
- "Start empty" and "Load demo data" choices.
- Password strength hint and confirm field.
- Session expiry warning in the UI.
- Simple health/status endpoint for deployment checks.

### Exit criteria
- A new database can be installed in under 3 minutes by a non-technical owner.
- Admin and cashier see different navigation.
- No write endpoint is reachable before installation.

---

## 4. Phase 2 — Core POS

**Goal:** A cashier can complete a sale quickly and accurately on a phone or browser.

### Must-have features
- Product catalogue: SKU, name, price, cost, active flag.
- Sale screen: add by SKU or product list, quantity, price preview, payment method.
- Payment methods: cash, mobile money, card, credit.
- Optional discount with reason.
- Receipt number and sale record.
- Stock decrement per branch.
- Sale history for the cashier's branch.
- Offline queue: save locally when network fails, replay when online.

### Recommended features
- Product search as the user types.
- Favourite/fast-moving products pinned at the top.
- Large touch targets for phone use.
- Clear "Queued — will sync" state.
- Low-stock warning at point of sale.
- Confirmation screen before final submit for high-value sales.

### Exit criteria
- A sale is recorded with under 10 seconds of extra effort.
- Offline sales sync without duplicates.
- Stock quantity matches recorded sales.

---

## 5. Phase 3 — Small CRM

**Goal:** Keep customer records and credit sales in one place without turning into a marketing suite.

### Must-have features
- Customer: name, phone, optional email, tags, notes, consent timestamp.
- Customer search by name or phone.
- Purchase history linked to sales.
- Credit balance and payment log.
- Walk-in customer as default.
- Data export for the owner.

### Recommended features
- Duplicate-phone warning on customer creation.
- "Top customers" list in admin overview.
- Credit due list.
- Privacy notice shown when a customer record is created.
- Delete/deactivate customer with audit entry.

### Exit criteria
- Any sale can be linked to a customer in two taps.
- Owner can see who owes what and export the list.
- Consent timestamp is stored for every customer with a phone number.

---

## 6. Phase 4 — Admin & reporting

**Goal:** The owner can see what is happening across all branches.

### Must-have features
- Daily summary: sales count, total, cash/MoMo/card/credit split, branch breakdown.
- Sales list with branch and date filters.
- Product and customer management screens.
- Staff management: create cashiers, assign branch, deactivate.
- Branch management.
- Audit log: who did what and when.
- Notification outbox: pending events visible for the future worker.

### Recommended features
- Compare branches side by side.
- Low-stock list.
- Cash variance field at close of day.
- CSV export of sales and customers.
- Role-based navigation.

### Exit criteria
- Owner can answer "what sold today, where, and who sold it" in under 30 seconds.
- Outbox contains structured events even though nothing is delivered yet.

---

## 7. Phase 5 — Notifications (deferred)

**Goal:** Deliver owner alerts without changing POS code.

### Features
- Worker reads `notification_outbox` where status is `pending`.
- WhatsApp Business Platform template messages for instant sale and exception alerts.
- SMS fallback through a Ghana gateway.
- Daily digest at a configurable time.
- Delivery status and retry with backoff.
- Opt-out and quiet hours.

### Recommended features
- Exception-only instant alerts.
- Message templates stored in settings.
- Delivery log visible in admin.

### Exit criteria
- Alerts delivered in under 10 seconds when online.
- Failed deliveries retried and visible.
- No duplicate alerts on sync replay.

---

## 8. Phase 6 — Hardening

**Goal:** Make the system safe for real shop data.

### Must-have features
- HTTPS enforced in production.
- Strong session secret from environment.
- Password and PIN hashing with scrypt.
- Rate limiting on login.
- Input validation on every write.
- Database backups documented and scheduled.
- Error pages that do not leak internals.
- DPC Act 843 compliance: privacy notice, consent, export/delete, data minimisation.

### Recommended features
- Audit log retention policy — done via `npm run prune:audit` (`AUDIT_RETENTION_DAYS`, 30-day minimum).
- Restore drill from a backup — done on 23 November 2026.
- Dependency audit — `npm audit` reports 0 vulnerabilities.
- Simple uptime check — `/api/status` is available for monitoring.

### Exit criteria
- No secret in source control.
- A backup can be restored.
- Unauthorised access is blocked server-side.

---

## 9. Phase 7 — Deployment

**Goal:** Run on Vercel with a hosted PostgreSQL database.

### Steps
1. Create the Neon/PostgreSQL database and connect it to Vercel.
2. Set `DATABASE_URL`, `SESSION_SECRET` and S3-compatible image storage variables.
3. Keep local development on `file:data/pos.db`; use `npm run migrate:neon` only when intentionally replacing hosted data.
4. Run `/staff/install` in production.
5. Smoke test: install, login, create product, record sale, view report.
6. Point a custom domain and confirm HTTPS.

### Recommended features
- Separate production and staging databases.
- Status endpoint for monitoring.
- PostgreSQL-safe SQL: every multi-table `GROUP BY` must include all non-aggregated selected columns.

**Exit criteria:** The production Admin dashboard, POS, reports and receipts load without 500 errors. Done on Neon.

---

## 10. Phase 8 — Pilot & iteration

**Status:** In progress. Internal POS hardening is complete; live staff pilot and storefront pilot are still pending.

**Goal:** Prove value in a real boutique.

### Activities
- Train 2–5 staff on POS, stock edits, barcode/QR scanning and transaction references.
- Run for two weeks.
- Compare baseline and post-pilot figures.
- Add the public storefront to the pilot only after Phase 13 checks pass.

### KPIs
- 98% of sales entered within two minutes.
- Cash variance down by 50%.
- Stockouts down by 30%.
- Extra time per sale under 10 seconds.

---

## 11. Phase 9 — Scale (optional)

**Status:** Partial. Barcode/QR labels and smart scan-to-fill are done; the remaining items are parked until after the storefront pilot.

- **Done:** manufacturer barcodes, `SW1:` smart QR labels with legacy `SLAWN1:` decoding, scan-to-fill.
- **Later:** purchase orders and suppliers.
- **Later:** stock counts and cycle-count workflow beyond quick adjustments.
- **Later:** GRA E-VAT integration if VAT-registered.
- **Later:** multi-company tenancy if selling to other boutiques.

---

## 11A. Storefront business analysis

**Goal:** Let a walk-in or social-media customer browse Sneakwise sneakers, save favourites, build a bag, and send a complete order request to the boutique's WhatsApp without creating an account.

**Stakeholders**
- **Shopper:** wants to see models, available sizes, prices and photos on a phone; wants to ask about an item quickly.
- **Owner/staff:** wants the exact items, sizes, quantities and total in one WhatsApp message; confirms payment and records the sale in the POS.
- **Developer/operator:** needs safe public data, configurable WhatsApp destination, and no accidental stock or sales side effects.

**Business rules**
1. Only active products appear in the storefront.
2. Cost price, branch names, staff data, customers and audit records never leave the public API.
3. Stock shown is a summed availability signal across branches, not a reservation.
4. Checkout creates **no sale, customer, payment or stock movement**. It opens WhatsApp with a structured enquiry/order. Staff confirms availability and payment, then records the sale in the POS.
5. Prices in the WhatsApp message are re-read from the server at checkout time, so an old browser tab cannot quote an edited price.
6. The WhatsApp number is configured by the owner in Admin → Shop settings, with an environment fallback for deployment.
7. If no number is configured, checkout offers a copyable order text and a clear setup message instead of a broken link.

**Non-goals for this phase**
- Online payment, delivery tracking, discounts, account login, user reviews and automated owner alerts.
- Creating a CRM customer from a storefront contact form without consent.

**Risks and mitigations**
| Risk | Mitigation |
|---|---|
| Customer sees a pair that sold out elsewhere | Availability is labelled "subject to confirmation"; staff confirms before POS sale |
| Stale tab quotes old price | Checkout rebuilds the message from the public catalogue API |
| Public API leaks internal data | Dedicated safe projection; never reuse `/api/products` response |
| WhatsApp number not configured | Admin setting + env fallback + copy-text fallback |
| Accidental POS double-counting | WhatsApp handoff never writes sale/stock tables |
| Long message breaks deep link | Compact line format, capped note length and item count |

---

## 11B. Senior engineer design

**Routes**
- `/shop` — catalogue, search, category and size filters, add-to-bag, wishlist toggle.
- `/shop/cart` — quantities, removals, subtotal, checkout entry.
- `/shop/wishlist` — saved models with add-to-bag action.
- `/shop/checkout` — customer name, phone, payment preference, note, order preview and WhatsApp handoff.

**Model / service**
- `listPublicProducts()` returns only customer-safe fields.
- `listStockTotals()` sums stock by product, both SQLite and PostgreSQL safe.
- `getShopCatalog()` combines settings, active categories and products into one public response.
- `getShopSettings()` / `updateShopSettings()` own validation and the audit entry.
- `wa.me` URL building happens at the edge (viewmodel), using only data returned by the public API.

**Client state**
- Cart and wishlist are client-only, stored in `localStorage` under `sneakwise.shop.*` keys.
- Storage reads are validated and corrupt values are discarded instead of crashing the app.
- A shop context provider shares catalogue, bag and wishlist state across `/shop/*` routes.

**Acceptance criteria**
- A visitor can browse, filter, save, add to bag, edit quantities and reach checkout without signing in.
- The WhatsApp text includes every chosen item, size, quantity, unit price, line total and grand total.
- No public endpoint returns `cost`, `barcode`, branch details or inactive products.
- Build and smoke checks pass on SQLite and Neon.

---

## 12. Phase 10 — Storefront foundations

**Goal:** Expose a safe catalogue and let the owner control the WhatsApp destination.

### Must-have features
- Public `GET /api/shop/catalog` requiring installation but no login.
- Active products only; no `cost`, `barcode`, branch or staff fields.
- Availability derived from summed stock; inactive products hidden.
- Admin `GET/POST /api/settings` for company name and WhatsApp number.
- Ghana-friendly number normalisation to international `233…` format.
- Audit entry when shop settings change.

### Exit criteria
- Anonymous request returns a usable catalogue.
- An edited price is reflected in the next anonymous request.
- Invalid or empty WhatsApp configuration cannot produce a broken deep link.

---

## 13. Phase 11 — Storefront browsing

**Goal:** A shopper can find a pair on a phone.

### Must-have features
- `/shop` product grid using existing `image_url` photos or a clean placeholder.
- Search by name/SKU, category filter and size filter.
- Add-to-bag and wishlist actions on every card.
- Direct **Order on WhatsApp** action on every available card, carrying that exact size/SKU.
- Availability badge; sold-out pairs cannot be added.
- Persistent wishlist across routes and reloads.
- Public nav shows only Shop and Wishlist; staff tools live under `/staff` with no shop entry point.

### Recommended features
- Hero banner with Sneakwise streetwear styling.
- Result count and empty state.
- Sort by newest/name/price.

### Exit criteria
- Shopper can reach a specific size in two taps on a 375px-wide screen.

---

## 14. Phase 12 — Cart and WhatsApp checkout

**Goal:** The chosen items become one complete WhatsApp order request.

### Must-have features
- `/shop/cart` with quantity steppers, line totals, subtotal and empty state.
- **Send bag on WhatsApp** from the cart for the full selection without a form.
- `/shop/checkout` with required name and phone, optional payment preference and note.
- Server catalogue revalidation before building the message.
- Structured WhatsApp text with SKU, name, size, quantity, unit price, line total and grand total.
- `https://wa.me/<number>?text=…` deep link, plus copy-text fallback.
- Cart is not cleared automatically; shopper clears it after confirming the send.

### Exit criteria
- The generated message contains every selected item and the correct total.
- No sale, customer or stock record is created by checkout.

---

## 15. Phase 13 — Storefront hardening and pilot

**Goal:** Make the public flow safe for real customers.

### Implemented in this pass
- Product quick-view drawer with size pills, sneaker size guide and exact-size WhatsApp handoff.
- Dedicated `/shop/product/[id]` page with specs, wishlist, safety notes, reference, message preview and recommended pairs.
- Owner-configurable delivery/payment choices in Admin → Shop settings; choices are preferences only.
- Short WhatsApp reference (`SW-YYMMDD-XXXX`) on cards, cart, detail page and checkout; no server order/customer record.
- Privacy-safe allow-listed `shop_events` counters with Admin → Insights.
- Staff confirmation SOP at `/staff/sop` and links from POS/Admin shells.
- Public catalogue narrowed to sneakers/slides; legacy non-footwear seed products and categories are removed from the admin catalogue too.

### Still pending
- Mobile QA on real Android and iOS devices.
- Verify stock and price changes appear within one fresh page load.
- Database connection failures must surface as infrastructure errors, never as "not installed".
- Idle PostgreSQL pool client errors are logged, not allowed to crash the server.
- Verify no public API field leaks internal pricing or staff data.
- Owner training: reading WhatsApp orders, confirming payment, recording the POS sale.
- Vercel environment fallback and a real WhatsApp Business number.
- One live phone order before pilot sign-off.

### Deferred recommendations
- Saved delivery notes for repeat customers, only with explicit consent.
- Product badge for "just landed".

### Exit criteria
- A shopper can open a full sneaker detail page, check the size guide and add or order that exact pair.
- The owner receives one readable order with reference, delivery/payment preferences and all items before stock is reserved.
- Insights contains counts only and never personal or payment details.
- Two staff members can run an end-to-end order without developer help.

---

## 16. Feature priority key

- **Must:** required for the phase to be accepted.
- **Recommended:** adds clear value with low risk; include if time allows.
- **Later:** explicitly out of scope until the named phase.

---

## 17. Coding standards

- Use MVVM boundaries: models never import React; views contain no SQL.
- Keep functions under roughly 40 lines; extract when they grow.
- Name things for the business domain: `Sale`, `Cashier`, `Branch`, not `Item1`.
- Use early returns and explicit errors.
- No generated-looking comments; explain why, not what.
- All money values are numbers in cedis, formatted at the edge.
- All dates are stored as ISO strings from SQLite `CURRENT_TIMESTAMP`.
- One concern per file.
