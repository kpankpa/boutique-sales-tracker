# UI/UX Guide — Slawn POS

This guide is the design input for the project. It replaces a formal imported UI/UX skill pack and is applied in the component library and screens.

---

## 1. Design principles

1. **Speed over completeness.** A cashier should record a sale faster than writing it in a notebook.
2. **Clarity over density.** Show the next action clearly; hide advanced settings.
3. **Feedback everywhere.** Every tap gets a visible response: saved, queued, failed, requires attention.
4. **Forgiving input.** Validate early, explain errors in plain language, never lose entered data.
5. **Works on a phone first.** Most users will be on a low-cost Android device.
6. **Offline is normal, not an error.** Queued state is calm and explanatory.

---

## 2. Users

| User | Context | Need |
|---|---|---|
| Owner/admin | May be away from the shop; checks on phone | See sales, stock and exceptions quickly |
| Cashier | At the counter, customer waiting | Add item, take payment, move on |
| Manager (future) | Multiple branches | Compare branches and reconcile |

---

## 3. Primary flows

### Installer
Welcome → check environment → prepare database → company/branches → admin account → demo data → review → finish.

### Cashier sign-in
Open app → username → PIN or password → branch shown → POS home.

### Sale
Open POS → tap product or type SKU → adjust quantity → choose payment → optional customer → submit → receipt confirmation.

### Owner check
Open admin → daily summary → branch filter → flagged items → sales list.

---

## 4. Design tokens

| Token | Value | Use |
|---|---|---|
| `--ink` | `#152A24` | Primary text |
| `--ink-soft` | `#5B6B65` | Secondary text |
| `--surface` | `#FFFFFF` | Cards |
| `--canvas` | `#F3F6F4` | Page background |
| `--brand` | `#0B6B4F` | Buttons, active state |
| `--brand-dark` | `#084F3B` | Hover |
| `--gold` | `#D6A434` | Accent, highlights |
| `--danger` | `#B42318` | Errors, voids |
| `--success` | `#0B6B4F` | Saved states |
| `--warning` | `#B54708` | Queued, low stock |
| `--line` | `#DDE5E1` | Borders |
| Radius | `10px` | Cards, inputs, buttons |
| Space scale | `4, 8, 12, 16, 24, 32` | Spacing |
| Font | system UI stack | Fast, no webfont download |

---

## 5. Component rules

- **Button:** one primary action per screen. Minimum height 44px.
- **Input:** label above, helper text below, error text in `--danger`.
- **Card:** one idea per card, title + value + supporting line.
- **Table:** horizontal scroll on small screens; no more than six columns.
- **Badge:** used for role, status, payment method.
- **Toast:** confirms background actions; disappears after 4 seconds.
- **Modal:** only for quick customer creation and confirmations.
- **Navigation:** admin sees Overview, Products, Customers, Sales, Staff, Branches, Outbox. Cashier sees POS and My Sales only.

---

## 6. States to design for

- Empty: no products yet, no sales yet, no customers yet.
- Loading: skeleton or simple "Loading…".
- Offline: banner "Offline — sales will be queued".
- Queued: item in queue with count.
- Error: inline message with a retry action.
- Success: receipt number and total.
- Permission denied: plain explanation and route back.

---

## 7. Accessibility

- Contrast at least 4.5:1 for text.
- All inputs have visible labels.
- Buttons reachable by keyboard with visible focus ring.
- Error messages linked to inputs with `aria-describedby`.
- Status changes announced with `aria-live="polite"`.
- Touch targets at least 44×44px.

---

## 8. Copy rules

- Use plain English: "Sale saved" not "Transaction committed successfully".
- Avoid jargon: "Customer" not "Counterparty".
- Be specific: "SKU DS-042 is not in the catalogue" not "Invalid input".
- Never blame the user.

---

## 9. Screen inventory

| Screen | Owner | Main action |
|---|---|---|
| Install wizard | Installer | Finish setup |
| Login | All | Sign in |
| POS | Cashier | Record sale |
| My Sales | Cashier | Review own sales |
| Overview | Admin | Read daily summary |
| Products | Admin | Add/edit product |
| Customers | Admin/Cashier | Add/find customer |
| Sales | Admin | Filter and export |
| Staff | Admin | Create cashier |
| Branches | Admin | Add branch |
| Outbox | Admin | Inspect pending events |

---

## 10. Do / Do not

**Do:** use tokens, keep layouts responsive, show branch name prominently, confirm destructive actions.

**Do not:** use gradients for decoration, animate non-essential elements, use red for routine warnings, hide navigation behind unlabelled icons, or dump technical errors on screen.
