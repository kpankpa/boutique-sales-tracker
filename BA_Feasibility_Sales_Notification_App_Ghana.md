# Business Analysis & Feasibility Report
## Boutique sales-entry app with instant owner notification — Ghana

**Date:** 22 November 2026  
**Analyst:** Business Analyst (AI-assisted research)  
**Status:** Decision support / pre-development  
**Workspace:** `sales-tracker`

---

## 1. Executive summary

**Verdict: Feasible, low technical risk — but "build" is probably not the first move.**

The workflow you described (salesperson keys an item code → owner's phone alerts immediately) is technically straightforward with today's Ghanaian telecom environment. The hard part is not the notification; it is **data integrity** (making sure every sale is actually entered correctly) and **change management** (getting staff to use it every time).

**As a business analyst, my primary advice is:**

1. **Do not build a full POS.** Keep the scope to a "sale capture + owner alert" layer, if you build at all.
2. **Run a buy-before-build pilot.** Ghana already has offline-first POS/inventory apps priced at roughly **GHS 90–250/month** (SellarPro, CliqPOS, mPOS, HilsonPOS, Loyverse, FINDR) that include stock, staff logins and alerts. For a single boutique, a custom app costing GHS 10k–35k will usually take 4–10 years to pay back versus a GHS 150/month tool.
3. **If you do build**, use this architecture: **offline-capable mobile web app (PWA) for staff → cloud database → WhatsApp message to owner (primary) + SMS fallback + daily digest.** Add **USSD/SMS entry as a fallback** so a feature phone or network outage does not stop sales recording.
4. **Notify on exceptions, not only on every sale.** Instant messages for high-value items, voids, discounts and cash variance; a once-daily summary for everything else. Otherwise the owner will mute the alerts within a week.
5. **Pair the app with daily cash/MoMo reconciliation and weekly stock counts.** A notification is a *detective* control — it tells you after the fact. It does not stop under-ringing or unrecorded sales on its own.

---

## 2. Problem statement and objectives

### Problem
In a small boutique, the owner is often not present for every sale. Sales are recorded late (or not at all), stock disappears without explanation, and the owner only discovers problems at closing or at month-end. Existing "notebook" tracking is cheap but invisible until it is too late.

### Business objectives
| Objective | Measure |
|---|---|
| Give the owner near-real-time visibility of sales | % of sales visible to owner within 1 minute |
| Reduce unrecorded sales and stock leakage | Shrinkage % vs. baseline; cash variance at close |
| Speed up reorder decisions | Stockout frequency; days of lost sales |
| Keep staff effort low | Extra seconds per sale; % of sales entered without prompting |

### Out of scope for the MVP (important)
Taking payments, printing GRA-certified receipts, accounting, payroll, customer loyalty, delivery, online store. These belong to a POS/ERP. Do not let the project expand into them without a separate business case.

---

## 3. Stakeholders and personas

| Stakeholder | Interest | Concern |
|---|---|---|
| **Owner** (primary beneficiary) | Know what sold, who sold it, spot leakage | Too many alerts; false alarms; phone always on |
| **Salesperson** (primary user) | Finish the sale quickly | Extra typing slows them down; gets blamed for stock errors |
| **Store manager** (if any) | Reconcile tills and stock | Shared logins destroy accountability |
| **IT/vendor** (if custom build) | Scope, support, hosting | Feature creep, unpaid customisation |
| **GRA / DPC** (regulators) | Tax compliance, data protection | Receipts, consent, registration |

---

## 4. Ghana context — evidence base

| Fact | Implication for the design |
|---|---|
| **42.87m mobile voice subscriptions; 127% penetration** (NCA Q4 2025) | Phone access is almost universal; SMS is a viable fallback. |
| **28.70m mobile data subscriptions; 85% penetration** (NCA Q4 2025) | Most staff/owners can use a data-based app, but not everyone. |
| **26.87m smartphones (57.7% of devices); 10.59m feature + 9.15m basic phones (42.3%)** (NCA Q4 2025) | A smartphone-only staff app excludes a large minority; keep USSD/SMS entry. |
| **26.3m internet users = 74.6% of population** (DataReportal, late 2025) | Offline capability is still required. |
| **WhatsApp used by ~93–98% of internet users in Ghana** (DataReportal/Statista, 2025) | WhatsApp is the obvious owner-notification channel. |
| **Bulk SMS ~GHS 0.022–0.035 per message** locally (mNotify, Arkesel, Hubtel, Sendazi, Oct 2026) | SMS fallback is cheap: ~GHS 30–35 per 1,000 alerts. |
| **WhatsApp Business Platform: Ghana billed at "Rest of Africa" ~US$0.004/utility message** (Meta rate card, Nov 2026); some local reporting quotes ~US$0.0101 after Oct 2026 changes — **verify with your BSP** | Even 1,500 alerts/month is only ~US$6–15 plus provider fees. Cost is not a blocker. |
| **Ghanaian POS software: GHS 90–250/month, offline-first, staff roles, low-stock alerts** (SellarPro, CliqPOS, mPOS, HilsonPOS, 2026) | Strong "buy" alternative; make build-vs-buy an explicit decision. |
| **Retail shrinkage commonly 3–10% of inventory; staff-related loss can be the largest share** (Ghana retail sources, 2026) | The value sits in reducing leakage, not in the alert itself. |
| **Tamale retail study: 80% of shops report power/internet problems; cost is the top adoption barrier (70%)** (2026 study) | Offline queue + low data use + low price are non-negotiable. |
| **Data Protection Act 2012 (Act 843): register as data controller, lawful basis, consent for marketing, security safeguards** | Staff/owner data only in MVP keeps this light; adding customer numbers increases obligations. |
| **GRA E-VAT and 20% total tax from 1 Jan 2026; VAT threshold GHS 750,000 for goods** | A sale-alert app is not a certified invoicing system; keep tax receipts separate unless integrated. |

---

## 5. Options analysis

### 5.1 How the salesperson enters the sale

| Option | Fit for Ghana | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Smartphone PWA / lightweight Android app** | High (58% smartphones, growing) | Offline queue, cheap to build, camera/barcode scan, instant | Needs smartphone + some data | **Primary** |
| **USSD shortcode** (`*123*CODE*QTY#`) | Very high (works on any phone, no data) | Universal, instant, familiar in Ghana | Poor UX for long codes; no barcode; session limits | **Fallback / phase 2** |
| **SMS entry** (`SALE 1042 1 CASH`) | Very high | Works everywhere, keeps a trail | ~GHS 0.03 per sale; slower; parsing errors | **Fallback** |
| **WhatsApp bot entry** | Very high (WhatsApp dominant) | Staff already use it; no new app to learn | Needs data; bot/provider complexity; hard to enforce structure | Good for pilots only |
| **Tablet/PC POS at counter** | Medium | Fast with barcode scanner | Cost, power, fixed location; staff work around it | Later, if volume grows |
| **Paper + owner manually forwards to WhatsApp** | Low | Zero cost | No structure, no analytics, easy to falsify | Baseline only |

### 5.2 How the owner is notified

| Channel | Speed | Cost | Reliability | Verdict |
|---|---|---|---|---|
| **WhatsApp (Business API / BSP)** | 1–10s | ~US$0.004–0.01 + provider fee | Very high where data is available | **Primary** |
| **SMS** | 1–10s | ~GHS 0.03/alert | Highest (works on 2G, no smartphone needed) | **Mandatory fallback** |
| **Push notification in owner app** | 1–3s | Free | Requires app installed + data on | Useful secondary |
| **Telegram bot** | 1–5s | Free | Less used in Ghana than WhatsApp | Optional only |
| **Email** | Minutes | Free | Owner may not check on phone | Daily digest only |
| **Standard WhatsApp Business app, manual** | As fast as staff types | Free | Unstructured, no database | Not a system |

---

## 6. Recommended solution concept — "what it will be like"

### 6.1 End-to-end journey (happy path)

1. Owner adds products once: **item code**, description, price, variant, active/inactive.
   - Example: `DS-042-BLK-M` = "Black Ankara dress, size M, GHS 180".
2. Each salesperson gets a **unique 4–6 digit PIN** (never a shared login).
3. Sale happens. Staff opens the app on their phone, enters PIN, types or scans the item code, enters quantity, picks payment method (Cash / MoMo / Card / Credit).
4. App validates the code against the catalogue. Unknown code is rejected or flagged for owner review.
5. App saves locally first (instant), then syncs to the cloud when data is available.
6. Server writes an **immutable sale record** with timestamp, staff ID, item, qty, price, payment method.
7. Notification rules fire:
   - **Every sale** → daily digest at 19:00 (or configurable).
   - **Exception** → instant WhatsApp/SMS, e.g. discount > 5%, void, high-value item, cash sale above GHS 500, no sale recorded for 2 hours during opening hours.
8. Owner taps the alert, sees the sale record, can acknowledge or flag it for review.
9. At close: cash + MoMo counted and compared to recorded totals. Variance triggers an automatic alert.

### 6.2 Example messages

**Instant (WhatsApp/SMS, keep <160 characters to avoid double SMS billing):**
> SALE 14:32 | Ama | DS-042-BLK-M x1 | GHS180 | Cash | #1042

**Exception:**
> ALERT 15:10 | Ama discounted DS-042 by 15% (GHS27) | reason required | #1043

**Daily digest (WhatsApp/email, 19:00):**
> Today: 23 sales / GHS4,120. Cash GHS2,680 | MoMo GHS1,440. Top: DS-042 (7). Flagged: 1 void, 1 discount. Till variance: -GHS20.

**Avoid Twi characters like ɛ/ɔ in SMS** unless needed — they switch encoding to Unicode and cut a message from 160 to 70 characters, tripling cost.

### 6.3 Screens (minimum viable)

| Screen | Content |
|---|---|
| Staff login | PIN pad, staff name shown after entry |
| New sale | Code/scan field, qty stepper, item preview + price, payment method, optional discount + reason, Submit |
| Sale result | Receipt number, green tick, "queued offline" indicator if no data |
| Owner dashboard (phone web) | Today's sales, exception list, staff leaderboard, low stock, cash variance |
| Admin (owner) | Products, staff, notification rules, owner number, export |

---

## 7. Requirements

### Functional
| ID | Requirement | Priority |
|---|---|---|
| FR1 | Unique staff login by PIN; no shared accounts | Must |
| FR2 | Product catalogue with code, description, price, variant, active flag | Must |
| FR3 | Sale entry by typed or scanned code + qty + payment method | Must |
| FR4 | Unknown-code rejection; price shown before submit | Must |
| FR5 | Offline storage with automatic sync and duplicate detection | Must |
| FR6 | Owner notification via WhatsApp + SMS fallback; configurable number | Must |
| FR7 | Instant exception alerts (high value, discount, void, no-sale gap, till variance) | Must |
| FR8 | Daily/weekly reports by item, staff, payment method | Must |
| FR9 | Immutable audit log with edit/void reason | Must |
| FR10 | Stock decrement and low-stock alert | Phase 2 |
| FR11 | Credit-sale tracking with due date | Phase 2 |
| FR12 | CSV/PDF export; data belongs to the owner | Must |

### Non-functional
| ID | Requirement |
|---|---|
| NFR1 | Works on low-cost Android 8+ as a PWA; initial load < 2MB |
| NFR2 | < 1MB data per staff device per day in normal use |
| NFR3 | Sale saved locally in < 1s; notification delivered within 10s when online; clearly labelled "queued" offline |
| NFR4 | 99% availability during shop hours; cloud backup |
| NFR5 | TLS in transit; hashed PINs; role-based access; no card/payment credentials stored |
| NFR6 | Comply with Act 843: collect only necessary data, document purpose, secure it, allow owner to export/delete |
| NFR7 | English UI; Twi-language labels later if desired (avoid Unicode SMS) |
| NFR8 | Retain records 24 months; daily backup |

---

## 8. Data model (minimal)

```
Staff      (id, name, pin_hash, role, active)
Product    (sku, name, variant, price, active, reorder_level)
Sale       (id, receipt_no, staff_id, created_at, synced_at, payment_method, status)
SaleLine   (sale_id, sku, qty, unit_price, discount, reason)
AlertRule  (id, type, threshold, channel, enabled)
Notification (id, sale_id, channel, sent_at, status)
TillClose  (id, date, staff_id, cash_counted, momo_counted, recorded_total, variance)
```

---

## 9. Feasibility assessment

| Dimension | Rating | Rationale |
|---|---|---|
| **Technical** | High | Standard web/mobile + messaging APIs. Offline sync is well-understood. No novel technology. |
| **Operational** | Medium | Depends on staff discipline, unique logins and daily reconciliation. Power/internet interruptions are real (80% of shops in one study), so offline behaviour is essential. |
| **Economic** | Medium for one boutique / High for multi-shop or productised | Custom build payback is long versus GHS 99–250/month existing tools. Custom wins only if you need specific workflow, multiple branches, or want to sell it to other boutiques. |
| **Legal / regulatory** | Medium | Act 843 registration and security; GRA E-VAT not covered by this app. Keep customer data out of MVP. |
| **Schedule** | High | Pilot with existing tool: 1–2 weeks. Custom MVP: 6–10 weeks. Full productised platform: 3–6 months. |
| **Market / need** | Medium-High | Real pain (shrinkage, stockouts, cash-flow visibility) but owners must be willing to change habits. |

---

## 10. Costs and benefits

### Option comparison (illustrative, verify with vendors)

| Option | Setup | Running | Best for |
|---|---|---|---|
| A. WhatsApp messages only (status quo) | GHS 0 | GHS 0 | Testing whether owner actually wants alerts |
| B. Existing POS + alerts (recommended pilot) | GHS 0–2,000 (optional label/printer) | **GHS 99–250/month** (~GHS 1,200–3,000/yr) | One boutique, fastest payback |
| C. Custom lightweight app (PWA + backend + WhatsApp/SMS) | **GHS 10,000–35,000** (freelance/agency, 6–10 weeks) | GHS 300–800/month (hosting, messaging, support) | Multiple boutiques, unique workflow, or resale product |
| D. Full custom POS with inventory, payments, accounting | GHS 40,000+ | GHS 1,000+/month | Only with a funded multi-branch rollout |

### Benefit example
A boutique with **GHS 50,000 monthly sales** and 3–10% shrinkage loses roughly **GHS 1,500–5,000/month**. If better visibility plus reconciliation cuts that by 20%, that is **GHS 300–1,000/month recovered** — enough to cover Option B many times over, but roughly 15–50 months to recover Option C at its lower estimate.

**Cost of messaging at 50 sales/day (1,500 alerts/month):**
- SMS only: 1,500 × GHS 0.03 ≈ **GHS 45/month**.
- WhatsApp only: ~US$6–15/month + provider platform fee.
- Recommended: instant exceptions only (~100–300/month) + one daily digest → under GHS 15/month.

---

## 11. Key risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Staff forget or refuse to enter sales | Data useless | PIN per staff, supervisor check, fewer than 3 fields per sale, daily reconciliation, positive incentives |
| Fake or wrong item codes | Wrong stock/price | Validate against catalogue, scan barcodes/QR, flag unknown codes, audit log |
| Notification fatigue → owner mutes alerts | Loss of visibility | Digest for routine sales; instant only for exceptions; quiet hours |
| "Instant" delayed by offline/network | False expectation | Save locally, show "queued" status, SMS fallback, set SLA as "near-real-time when connected" |
| Shared staff login | No accountability | Unique PINs, lock after 5 failed tries, named audit records |
| WhatsApp policy/price changes | Cost or delivery changes | Keep SMS fallback; abstract messaging behind one interface |
| Treating app as theft prevention | Disappointment | Position as detection; combine with counts and till reconciliation |
| Customer data added later | Act 843 obligations | Keep customer data out of MVP; get consent and register before adding |
| GRA receipt compliance | Non-compliant invoices | Keep E-VAT receipts in a certified system; do not issue invoices from this app |

---

## 12. Roadmap

**Phase 0 — Validate (1–2 weeks)**
- Observe one week of sales: how many sales/day, item code format, phone types, network quality.
- Trial an existing POS (e.g. SellarPro Solo / mPOS Starter / CliqPOS free) with owner alerts enabled.
- Baseline: daily cash variance, stockout count, time to close.

**Phase 1 — MVP (4–8 weeks, only if pilot shows a gap)**
- Build PWA sale entry + offline queue + catalogue + staff PINs.
- WhatsApp instant exception alerts + SMS fallback + daily digest.
- Owner web dashboard + export.
- Pilot in one boutique with 2–3 staff for 4 weeks.

**Phase 2 — Harden (4–6 weeks)**
- USSD/SMS entry fallback, barcode labels, stock decrement and low-stock alerts, credit sales.
- Roles, anomaly scoring, multi-branch if needed.

**Phase 3 — Productise (optional, 3–6 months)**
- Multi-tenant, billing, white-label, reseller model for other boutiques.

---

## 13. KPIs for success

- ≥ 98% of sales entered within 2 minutes of the sale.
- Owner-visible within 60 seconds for ≥ 95% of sales when online.
- Cash/MoMo variance at close reduced by ≥ 50% from baseline.
- Stockouts reduced by ≥ 30% over 3 months.
- Extra time per sale ≤ 10 seconds.
- Staff adoption: 100% of sales have a named staff ID.

---

## 14. Decision points — I need your answers to go further

1. **One boutique or several?** (Determines buy vs build.)
2. **What phones do staff use?** Smartphones only, or some feature phones?
3. **Is the owner on WhatsApp?** Do you want API-based automation or a simpler notification method?
4. **Do you also need stock levels, credit sales and MoMo reconciliation, or only sale alerts?**
5. **Budget and timeline?** (GHS 99/month pilot vs GHS 10k+ custom build.)
6. **Do you want to sell this app to other boutiques later?** That changes the business case completely.

---

## 15. Recommended next step

Run **Phase 0** first: configure an existing offline POS with alerts and measure for two weeks. If it still does not meet the need, come back and I can build the **Phase 1 PWA prototype in this workspace** (sale entry, offline queue, product catalogue, WhatsApp/SMS alert hooks, owner dashboard) using the requirements above.

---

## Sources

1. NCA — *Quarterly Statistical Bulletin Q4 2025*: https://nca.org.gh/wp-content/uploads/2026/06/Q4-2025-Statistical-Bulletin.pdf
2. NCA — *Communications Industry Report 2025*: https://nca.org.gh/wp-content/uploads/2026/07/2025-CIR.pdf
3. DataReportal — *Digital 2026: Ghana*: https://datareportal.com/reports/digital-2026-ghana
4. Statista — *Leading social media platforms in Ghana 2025* (WhatsApp 98.4% of internet users): https://www.statista.com/statistics/1171534/leading-social-media-platforms-ghana/
5. Meta — *Pricing on the WhatsApp Business Platform* (updated Nov 2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
6. WhatsApp API Ghana rates: https://wsmartsender.com/whatsapp-api-pricing/ghana
7. mNotify / BMS Africa — SMS pricing: https://bms.africa/pricing
8. Sendazi — *Bulk SMS cost in Ghana (2026)*: https://sendazi.com/blog/bulk-sms-cost-ghana
9. SellarPro — *Best POS Software in Ghana (2026)* and pricing: https://sellarpro.com/guides/best-pos-software-ghana
10. MPOS Ghana — pricing: https://mposghana.com/pricing
11. EliteTeQ — *Which POS Software Is Best in Ghana? 2026*: https://eliteteqpos.com/gh/guides/best-pos-software-ghana
12. SellarPro — *How to Reduce Stock Theft in Ghana Retail Shops*: https://sellarpro.com/blog/how-to-prevent-stock-theft-retail-shops
13. Accra Street Journal — *Why Small Shops Must Track Daily Sales in Ghana*: https://accrastreetjournal.com/2026/03/20/the-sales-notebook-that-saves-your-business-why-small-shops-need-to-track-daily-sales/
14. Inventory control study, Tamale Metropolis (2026): https://doi.org/10.59413/ajocs/v7.i5.24
15. DLA Piper — *Data Protection Laws of the World: Ghana* (Act 843): https://www.dlapiperdataprotection.com/guide.pdf?c=GH
16. Data Protection Commission Ghana: https://dataprotection.org.gh/
