# Development Plan — Sneakwise POS

**Scope:** One company, multiple branches. Web application, browser installer, lightweight POS, authentication, small CRM. Notifications are deferred but designed for.

**Architecture:** MVVM (Model–View–ViewModel) on Next.js App Router.

**Last updated:** 23 November 2026

---

## 1. Phase map

| Phase | Name | Outcome | Status |
|---|---|---|---|
| 0 | Discovery & baseline | Problem confirmed, scope agreed, constraints documented | Done — see `BA_Feasibility_Sales_Notification_App_Ghana.md` |
| 1 | Foundations & installer | Database, design system, browser installer, auth, roles, branches | Done |
| 2 | Core POS | Product catalogue, sale entry, offline queue, stock decrement, receipts | Done |
| 3 | Small CRM | Customers, purchase history, credit, consent records | Done |
| 4 | Admin & reporting | Daily summary, branch filters, audit log, notification outbox | Done |
| 5 | Notifications (deferred) | WhatsApp/SMS delivery worker reading the outbox | Deferred by owner |
| 6 | Hardening | Backups, security review, DPC compliance, error handling | Done |
| 7 | Deployment | Vercel + hosted libSQL, environment config, smoke tests | Next |
| 8 | Pilot & iteration | Staff training, 2-week pilot, KPI review | Planned |
| 9 | Scale (optional) | Barcode labels, GRA E-VAT, advanced stock, resale platform | Optional |

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
- `/install` wizard: environment check, database prepare, company/branch setup, admin account, optional demo data, finish.
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

**Goal:** Run on Vercel with a hosted libSQL database.

### Steps
1. Create a Turso/libSQL database.
2. Create a Vercel project and connect the repository.
3. Set `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`.
4. Run `/install` in production.
5. Smoke test: install, login, create product, record sale, view report.
6. Point a custom domain and confirm HTTPS.

### Recommended features
- `vercel.json` with security headers.
- Separate production and staging databases.
- Status endpoint for monitoring.

---

## 10. Phase 8 — Pilot & iteration

**Goal:** Prove value in a real boutique.

### Activities
- Train 2–5 staff.
- Run for two weeks.
- Compare baseline and post-pilot figures.

### KPIs
- 98% of sales entered within two minutes.
- Cash variance down by 50%.
- Stockouts down by 30%.
- Extra time per sale under 10 seconds.

---

## 11. Phase 9 — Scale (optional)

- Barcode and QR labels.
- Purchase orders and suppliers.
- Advanced stock counts.
- GRA E-VAT integration if VAT-registered.
- Multi-company tenancy if selling to other boutiques.

---

## 12. Feature priority key

- **Must:** required for the phase to be accepted.
- **Recommended:** adds clear value with low risk; include if time allows.
- **Later:** explicitly out of scope until the named phase.

---

## 13. coding standards

- Use MVVM boundaries: models never import React; views contain no SQL.
- Keep functions under roughly 40 lines; extract when they grow.
- Name things for the business domain: `Sale`, `Cashier`, `Branch`, not `Item1`.
- Use early returns and explicit errors.
- No generated-looking comments; explain why, not what.
- All money values are numbers in cedis, formatted at the edge.
- All dates are stored as ISO strings from SQLite `CURRENT_TIMESTAMP`.
- One concern per file.
