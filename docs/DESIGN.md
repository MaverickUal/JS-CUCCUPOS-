---
name: cuccupos-pos
description: POS / retail dashboard design system. Modern, clean, minimal. React + Tailwind + shadcn/ui. Product: coffee shop point-of-sale (POS) with cashier ordering, admin dashboard, menu management, reports, and customer history.
---

# CuccuPOS — Design System & Documentation

This file is the master documentation for CuccuPOS. It consolidates the design system, system behaviour, codebase organisation, data model, security rules, and workflows. The only separate docs kept are `docs/database.rules.json` (the deployed security rules — source of truth) and `docs/README.md`.

---

## Part 1 — Design system

Built with the **ui-ux-pro-max** skill. All rules below come from its searchable database.

### Product type
- **Primary**: POS / Retail / Service (coffee shop)
- **Audience**: Cashiers (touch-first), Owner/Manager (analytics, reporting)
- **Platform**: Web (desktop + mobile responsive)
- **Usage context**: Fast checkout at counter, admin review at back office

### Design dials
- **Variance**: Mid (4-7) — balanced, modern
- **Motion**: Standard — scroll/stagger motion
- **Density**: Standard — 16-64px spacing scale

### Stack
`react` + `html-tailwind` + Vite build, shadcn/ui components.

### Color palette (from `src/index.css` variables)

| Token | HSL | Use |
|---|---|---|
| `--primary` | 69 28% 35% | Main brand (olive/green) |
| `--primary-foreground` | 54 100% 96% | Light cream on primary |
| `--background` | 54 100% 96% | Page base (warm white) |
| `--foreground` | 84 59% 11% | Main text (dark olive) |
| `--card` | 0 0% 100% | White cards |
| `--muted` | 60 40% 92% | Subtle background fills |
| `--accent` | 66 25% 88% | Soft highlight |
| `--border` | 66 15% 82% | Divider/outline |
| `--destructive` | 0 70% 45% | Errors / destructive actions |
| `--secondary` | 66 19% 82% | Secondary surfaces |
| `--sidebar` | 69 28% 35% | Sidebar background |
| `--sidebar-active` | 68 23% 19% | Active nav state |

### Typography
- **Font family**: `Quicksand` (rounded geometric sans-serif)
- **Base size**: 16px
- **Weights**: `font-bold` (700) headings, `font-semibold` (600) labels, `font-medium` (500) body
- **Scale**: `text-xs` (11px labels), `text-sm` (14px body/meta), `text-base`, `text-lg` (18px headings), `text-2xl` / `text-3xl` (page titles)
- **Line-height**: Tailwind defaults (`leading-tight` headings, `leading-none` cards)
- **Numbers**: `tabular-nums` for all monetary values

### Spacing scale
Base: 4px (1), 8px (2), 16px (3), 24px (4), 32px (5), 48px (6), 64px (7), 96px (8). Micro-steps: `1.5` (6px), `2.5` (10px), `3.5` (14px).

### Component design rules
- **Buttons**: `h-11` default, `h-9` sm, `h-12` lg; `rounded-xl`; variants default/outline/secondary/destructive/ghost; focus ring `ring-2 ring-ring ring-offset-2`; touch target `min-h-[44px] min-w-[44px]`.
- **Cards**: `rounded-xl` border, white bg, subtle shadow; header `p-5`; content `p-5 pt-0`; page wrappers `px-3 sm:px-0`.
- **Inputs**: `h-11` (44px), `rounded-xl`, focus ring, `placeholder:text-muted-foreground`, `tabular-nums` for numbers.
- **Navigation (AppShell)**: sidebar `w-60`, `rounded-2xl` links, `text-lg`; mobile bottom nav fixed; active `bg-sidebar-active shadow-lg`; touch targets `min-h-[44px]`.
- **Tables**: header bold, right-aligned numerics; cells `font-semibold` for IDs/prices, muted for meta; rows `min-h-[44px]`; containers `overflow-hidden`, truncate `max-w-[14rem]`.
- **Dialogs**: `rounded-2xl`, `max-h-[90vh]`, `shadow-xl`; title `text-xl font-bold`; description `text-sm text-muted-foreground`; footer `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`.
- **Status badges**: `rounded-full`, bordered, `text-xs`; active states use `bg-primary` / `bg-destructive`.

### UI/UX improvements applied
1. Accessibility: global `:focus-visible` ring; reduced-motion media query.
2. Touch: `min-h-[44px] min-w-[44px]` targets; `.min-touch` utility.
3. Performance: consistent shadow scale; transition tokens (`fast`=100ms, `slow`=300ms); Material easing.
4. Layout: micro-spacing tokens; responsive `px-3 sm:px-0`.
5. Typography/color: Quicksand; `tabular-nums`; consistent line-height.
6. Animation: `active:scale-[0.99]`; transition tokens; reduced-motion respect.

### Anti-patterns avoided
No emoji icons (lucide SVG only); no placeholder-only labels; no fixed-width containers; no gray-on-gray; no raw hex; no color-only status; no hover-only interactions; no instant state changes.

---

## Part 2 — What the system is

CuccuPOS is a **staff-only coffee-shop point-of-sale web app** (React SPA). No customer-facing site and no custom server: customers are walk-ins who pay at the counter. Firebase Auth + Realtime Database (RTDB) is the entire backend.

**Two roles** (stored in `users/<uid>/role`):
- **Cashier** — builds orders, records cash, sees only their own order history (`/order`, `/history`).
- **Admin / Owner-Manager** — dashboard, orders board, menu, cashier accounts, reports (`/admin/*`).

Core transaction loop: tap `+` on drinks → enter cash → review total/discount/change → confirm (order lands as `pending`) → admin advances `pending → preparing → ready → completed` (or cancels). Cash-only: every order stores `cashTendered` and `changeGiven`. PWD / Senior Citizen 20% discount (one per order, statutory floor per RA 10754 / RA 7432).

### Screens
| Screen | Purpose |
|---|---|
| Dashboard | Sales/order/average for a chosen period, sales chart, best sellers, recent orders — filterable by cashier |
| Orders | Every order newest-first with status filters and search; advance status, cancel, view details, print/export receipt |
| Menu | Add, edit, delete items; sold-out toggle; duplicate-name review |
| Cashiers | Every staff account with its role, order count and last order; disable access |
| Reports | Period report — gross / refunds / net, chart, category split, top items, refund audit, CSV export, print/PDF |
| Order (cashier) | Menu browse, cart with typed quantity, cash checkout with discount |
| History (cashier) | Own orders newest-first, live status bar, receipt/PDF, reorder |

### Filtering the dashboard by cashier
The Owner/Manager can scope the whole dashboard to one cashier. The selector is populated from user records and matches on the cashier's **user id**, never the display name. KPIs, the sales chart, best sellers and recent orders all follow the selection together with the date range. Cancelled orders still contribute nothing.

### The period picker
Dashboard and Reports share one control (`RangePicker`):
| Choice | Chart buckets |
|---|---|
| Today | by hour — `12am, 1am, …` |
| Last 7 days | by day |
| Last 30 days | by day |
| Custom range | by day, from/to date pickers for any past dates |

Choosing today (including via Custom) switches to hourly automatically. KPIs and percentage deltas follow the same window, comparing against the immediately preceding period of equal length. Empty buckets render as real zeroes.

---

## Part 3 — Stack & tooling

| Concern | Choice | Version |
|---|---|---|
| UI | React | 18.3 |
| Language | JavaScript (ES2020+, JSX) | — |
| Build / dev server | Vite | 5.4 |
| Routing | React Router | 6.28 |
| Styling | Tailwind CSS | 3.4 |
| Components | shadcn/ui (Radix primitives) | — |
| Charts | Recharts | 2.13 |
| Icons | lucide-react | 0.460 |
| Toasts | sonner | 1.7 |
| Backend | Firebase Auth + RTDB | 13.0 |
| Validation | Zod | 4.6 |
| Tests | Vitest | 2.1 |

~7,350 lines of JS/JSX across 56 source files, ~1,610 tests (10 suites, 200 cases).

---

## Part 4 — Architecture & data flow

Data flows one way through three layers:

```
  page component
      │  useStore()
      ▼
  AppStore (React context)          ← the only state pages see
      │
      ├──────────────► services/*.services.js  RTDB + Auth
      │                        │
      │                        ▼
      │                 Firebase Auth + Realtime Database
```

Pages never import Firebase. That constraint is what made the backend swap possible.

### Pure logic modules
`stats.js`, `finance.js`, `discounts.js`, `duplicates.js`, `receipt.js`, `roles.js` have no Firebase import. That is what makes the test suite fast and deterministic. `parseQty` is the one tested export in `components/`, kept next to the input that uses it.

### Layer 1 — services
Every RTDB and auth call, 31 exports grouped as menu / orders / auth / users.
- Mutations return `{ success, message, data }`; callers check `success` and surface `message`.
- Reads come in pairs: `getXOnce()` (promise) and `getX(callback)` (live subscription).
- Writes are Zod-validated before hitting the database.
- Single-field writes use `set()` (not `update()`, which throws on primitives in v9+).
- `flattenOrders()` normalises two shapes (admin grouped by customer vs cashier flat) into one array.

### Layer 2 — AppStore
Context holding `users`, `menu`, `orders`, cart, `currentUser`, `authReady`. Subscriptions are role-scoped and re-established when the signed-in user changes:
| Identity | Subscribes to |
|---|---|
| Menu (always) | `/menu` — publicly readable |
| Admin | `/orders` (whole tree) and `/users` |
| Cashier | `/orders/<ownUid>` only |

Cart stays in React local state — never persisted. `authReady` lets route guards avoid redirecting before Firebase Auth resolves.

### Layer 3 — pages
Presentational. Consume `useStore()`; hold only view-local state (search text, open dialogs, selected period).

---

## Part 5 — Routes

| Path | Guard | Page |
|---|---|---|
| `/login` | signed out | Auth |
| `/order` | cashier | Cart + cash checkout with discount |
| `/history` | cashier | Own orders, status tracker, receipt/PDF, reorder |
| `/admin/dashboard` | admin | KPIs + sales chart + best sellers, cashier filter |
| `/admin/orders` | admin | Order board, status flow, cancel |
| `/admin/menu` | admin | Menu CRUD, sold-out toggle |
| `/admin/cashiers` | admin | Cashier list, create/disable accounts |
| `/admin/reports` | admin | Period report, gross/net, CSV, print |
| `*` | — | Redirect to home or `/login` |

Guards in `App.jsx`: `RequireRole`, `PublicOnly`, `RootRedirect`, all gated on `authReady`.

---

## Part 6 — Data model

Three top-level nodes (full detail in the RTDB structure; rules in `docs/database.rules.json`).

```
users/<uid>                 name, email, role, createdAt, disabled?
menu/<itemId>               name, price, description, category, tag, image, available
orders/<customerId>/<id>    customerId, customerName, displayId, items{}, subtotal?,
                            discountType?, discountAmount?, total, paymentMethod,
                            cashTendered?, changeGiven?, refunds{}, refundedTotal?,
                            status, createdAt, note?, voidRequest?, voidHistory?
```

Every `?` field is optional, so orders written before a feature existed still load and appear in reports.

Three decisions worth knowing:
1. **Orders nested under the customer id.** RTDB rules don't cascade and can't filter per query result. Nesting lets a cashier read `/orders/<ownUid>` while an admin reads the whole tree.
2. **Order items are a map keyed by menu item id**, not an array — RTDB returns objects, and the key gives O(1) lookup.
3. **Refunds are appended, never overwritten.** `orders/<id>/refunds/<refundId>` holds one record per refund. No client can write there (`.write: false`); only the Admin SDK can. The order's own `total` and `createdAt` are never modified.

---

## Part 7 — Security model

Firebase Auth owns credentials; RTDB stores no passwords. Access is decided by the database rules, not the UI. Full rules: `docs/database.rules.json`.

| Resource | Public | Cashier | Admin |
|---|---|---|---|
| `menu` | read | read | read + write |
| `orders` | — | read/write own subtree | read + write all |
| `users` | — | read/write own profile | read + write all |

Validation lives in the rules too: prices positive, order totals positive, item quantities 1–99, an order's `customerId` must match the path it sits under. Disabled accounts are blocked at every path. Nobody self-promotes to admin (`role` pinned to `cashier` unless the writer is already an admin).

**The rules are the security boundary.** Hiding a button in React protects nothing.

---

## Part 8 — Business rules

| Rule | Where enforced |
|---|---|
| Cart quantity is 1–99 | `parseQty` clamps typed input; `QuantityStepper` disables at bounds; store clamps; `orderSchema` rejects out-of-range; rules cap qty 1–99 |
| Sold-out items cannot be ordered | Client checks `available`; store rejects |
| Orders always start `pending` | `orderSchema` and security rules reject any other status at creation |
| Cancelled orders count as zero everywhere | `validOrders()` filters them out of all sales figures |
| Orders are never deleted | Cancelled or refunded, to preserve the sales record |
| Cashier sees only their own orders | Path scoping + security rules |
| Only admins change menu or order status | Security rules |
| Only admins create or disable accounts | Cloud Functions / service layer |
| A user cannot change their own role | `role` validation rule |
| Nobody self-promotes to admin | `role` validation rule, and there is no UI to do it |
| An admin cannot disable their own account | Guarded in the function and the UI |
| Discount applied at most once | Recomputed from line items, never accepted from the caller |
| Only one discount per order | `discountType` is a single enum; PWD and Senior never combined |
| No duplicate product name within a category | `findConflictingMenuItems` in add/update paths; existing duplicates listed for review only |
| An account with no valid role cannot sign in | `loginUser` refuses and signs out; `roleLabel` shows "Unknown" |
| A disabled account cannot sign in | `loginUser` checks `disabled`, backed by the auth custom claim / rules |
| A print or PDF contains one transaction | `buildReceipt(order)` is a pure per-order function; `public/receipt.css` hides everything but the receipt element |

### Discounts (statutory basis)
PWD and Senior Citizen concessions, 20% rate. RA 10754 Sec. 32(a)(1) grants PWD "at least twenty percent (20%)" covering "restaurants and recreation centers"; IRR of RA 9442 Sec. 6.1(b) extends it to a restaurant's food/drinks. RA 7432 Sec. 5(a), as amended by RA 9994 and restated in RA 11916, grants Senior Citizens the same 20%. So `DISCOUNT_RATE = 0.2` is a legal floor, not a guess.

What the law also requires and this app does **not** do: proof of entitlement. RA 10754 IRR Sec. 12 requires the concession holder's name, ID number and TIN on the sales record before the discount can be claimed as a tax deduction. The app records only the discount type; the cashier asserts eligibility. Collecting ID details is a privacy/policy decision for the owner. One discount per order satisfies the statutory ban on double-discounting. VAT is not modelled at all (separate BIR bookkeeping).

### Cash only
One payment method. Every order records `cashTendered` and `changeGiven`, letting the owner reconcile the drawer at close (sales collected − change given out − refunds = net in drawer).

---

## Part 9 — Void workflow

A cashier asks to void an order; the Owner/Manager approves or declines. Nothing is deleted, and the cashier can never cancel an order directly.

### Flow
1. **Request.** Cashier history shows **Request Void** on orders that are `pending`, `preparing` or `ready`. Dialog shows the order, asks for a reason (3–300 chars) and confirmation. Sets the order to `pending_void` and stores the previous status.
2. **Review.** Owner/Manager Orders page has a **Pending Void** tab listing every waiting request with order number, cashier, order time, items, total, previous status, reason and request time. Both sides update live through `onValue` listeners.
3. **Approve.** Sets the order to `cancelled` and records the decision. `cancelled` orders are already excluded from sales totals and counts.
4. **Decline.** Needs a reason, restores the recorded previous status, records the decision.
5. **Audit.** Request and decision stay on the order and show in both order views. A decided request cannot be decided again.

Declined orders can be voided again; the earlier request moves into `voidHistory` instead of being overwritten.

### Data added to `orders/<cashierUid>/<orderId>`
| Field | Meaning |
|---|---|
| `status` | New value `pending_void`. Only set/cleared by the void flow. |
| `voidRequest` | Latest request (below). Absent on orders never submitted. |
| `voidHistory/<requestId>` | Earlier requests, same shape. Written only by the backend. |

`voidRequest`: `requestId`, `status` (`pending`/`approved`/`declined`), `reason`, `requestedBy`, `requestedByName`, `requestedAt`, `previousOrderStatus`, and once decided `decision`, `decisionReason` (required when declined), `decidedBy`, `decidedByName`, `decidedAt`. Timestamps are ISO strings. Unset fields are absent (RTDB does not store nulls).

Order status and request status are separate: the first is the order's operational state, the second is the approval state.

### Where each rule is enforced
| Rule | Service layer (`src/services/orders.services.js`) | `docs/database.rules.json` |
|---|---|---|
| Caller is an active cashier / admin | yes | role checks as before |
| Order belongs to the cashier | path built from caller's uid, plus `customerId` check | cashiers cannot write existing orders |
| Reason required (request and decline) | yes | not enforced |
| Eligible status, no duplicate, no refunded order | yes | not enforced |
| Decision made once, against current `requestId` | yes, inside a transaction | not enforced |
| Clients cannot create/change/delete `voidRequest`/`voidHistory` | n/a | yes |
| Clients cannot enter or leave `pending_void` | n/a | yes |
| No refund while a void is pending | n/a | yes |
| Totals, items, payment, timestamps unchanged | unchanged | existing rules |

The service layer uses the Firebase SDK (which obeys the rules), so each operation checks identity, role and state itself. The rules are what stop a signed-in client from skipping the service layer and writing the fields directly.

### Behaviour to know
- Completed orders cannot be voided. They go through the refund flow.
- An order with any refund cannot be voided, and refunds are blocked while a void is pending. A void never touches cash or refund records.
- `pending_void` orders still count in sales until the void is approved.
- The Owner/Manager's existing **Cancel order** button is unchanged and still works for `pending` and `preparing` orders.

### Deploying
Deploy rules and (if used) functions together. Without the backend deployed, the void buttons report unavailable and nothing changes.

```bash
npm run deploy:rules        # firebase deploy --only database
npm run deploy:functions    # installs functions/ deps, then firebase deploy --only functions
npm run emulators          # local Auth + RTDB
```

---

## Part 10 — Known gaps

Stated plainly:
1. **Prices are still client-supplied.** The schema recomputes subtotal, discount and total from line items and rejects a mismatch, and rules cap quantity 1–99 — but nothing checks `items[].price` against the live menu. A modified client could send `price: 1` for a ₱80 drink. Closing this properly means computing orders server-side. Not acceptable once real money is involved; acceptable while payment is a mock.
2. **Discount entitlement is not evidenced.** The 20% rate is verified against statute. What is missing is proof: the law requires the concession holder's name, ID number and TIN on the sales record before the discount can be claimed as a tax deduction, and the app stores only the discount type. The owner must decide whether to capture ID details.
3. **Admin self-demotion is blocked by rules.** An admin cannot change their own `role` (including self-demotion) via the database rules.
4. **No integration or emulator tests.** Pure logic covered by 200 unit tests, but Cloud Functions and security rules are only verified by compiling and manual browser checks against the live database.
5. **Orders never paginate properly.** The board caps at 100 rows and says so; older orders are still reachable by search.
6. **No offline support.** Losing connection mid-shift means losing the cart and failing checkouts.
7. **No four-digit PIN login.** Scoped and then deliberately dropped. A 4-digit PIN is only 10,000 values, so it is only defensible with a salted scrypt hash held in a rules-locked node read solely by the Admin SDK, per-account lockout, and an IP throttle. Email/password stays the only method today.

---

## Part 11 — Accounts

No credentials are stored in this repository. Staff accounts come from:
| Source | Resulting role |
|---|---|
| Provisioned manually in Firebase Console | `cashier` |
| Hand-edited in the Firebase console | `admin` — the only way to make an administrator |

New accounts register at `/register` with the `cashier` role (note: the `/register` route/file was removed in a recent batch; accounts are now created manually in the console or by admin). Promoting someone to `admin` has to be done by hand in the Firebase console — the rules deliberately prevent the app from granting it.

---

## Part 12 — Conventions (things to know before changing things)

1. **Orders are nested at `/orders/<customerId>/<orderId>`.** Not stylistic — RTDB rules don't cascade.
2. **Security rules are the real access control.** The UI hides things, but the database enforces them. Changing the data shape usually means changing `database.rules.json`.
3. **Single-field writes need `set()`, not `update()`.** `update()` throws on a primitive in Firebase v9+.
4. **Order numbers are client-generated** (`ORD-MVC26YJ9`, `makeDisplayId()`). A shared counter would need customers to write to `/counters`, which can't be made safe.
5. **Money is recomputed, never trusted.** `orderSchema` re-derives subtotal, discount and total from the line items and rejects anything that doesn't reconcile. Change the maths in `discounts.js`, not in the caller.
6. **The discount rate is verified; the eligibility evidence is not.** `DISCOUNT_RATE = 0.2` matches statute. The app does not record the ID proof the law requires.
7. **The admin feed arrives grouped by cashier**, not chronologically. `sortByCreatedAtDesc` in the store fixes the ordering — don't assume `orders` is already sorted at the data layer.
8. **`parseDayInput` rejects impossible dates deliberately.** Re-adding plain `new Date(y, m, d)` reintroduces the silent Feb 31 → Mar 3 bug.
9. **The rules in the repo may be behind what's deployed.** Compare `docs/database.rules.json` with the Firebase console before debugging an access error.
10. **Path alias** — `@/` maps to `src/` (declared in both `vite.config.js` and `jsconfig.json`).
11. **Types are the contract** — `src/types.js` mirrors the database exactly. `Order.items` is a `Record<string, OrderItem>`, not an array.
12. **Formatting** — always through `lib/format.js` (`peso`, `formatDateTime`, `formatDate`, `orderNo`). Raw `toLocaleString` calls in JSX are a smell.
13. **Styling** — Tailwind utilities plus `cn()` for conditional classes. Theme colours are CSS variables at the top of `index.css`; there is no dark mode.
14. **Icons** — lucide-react only.
15. **Money** — rounded to 2 decimals (`money()` in the store, `round2` in the pure modules) to avoid float drift. Never accept a total from a caller; recompute it.
16. **Testing** — `npm test` runs 200 unit tests over the pure modules (`stats`, `finance`, `discounts`, `duplicates`, `receipt`, `roles`), the quantity parser, the dashboard filter logic and the order schema. `npm run test:tz` re-runs them in four timezones.

---

## Part 13 — Build & run

```bash
npm install
cp .env.example .env.local    # then fill in the Firebase values
npm run dev                   # http://localhost:5173
npm run build                 # vite build → dist/
npm test                      # 200 unit tests
npm run test:tz               # same suite across four timezones
npm run emulators             # local Firebase Auth + RTDB
npm run deploy:rules          # publish database.rules.json
```

Build requires zero type errors. The bundle is ~1.29 MB (350 kB gzipped) with no code splitting — Firebase and Recharts dominate it. Static build works on any static host (Firebase Hosting, Vercel, Netlify). Set `VITE_FIREBASE_*` on the host; rebuild when they change. Editing `database.rules.json` locally changes nothing until it is published.

---

## Part 14 — Change review (recent batch)

Recent batch changes (confirmed by diff + docs):
| # | File / symbol | Change |
|---|---|---|
| 1 | `src/pages/auth/Register.jsx` | Deleted (62 lines); no route existed |
| 2 | `Login.jsx` / `App.jsx` | `/register` link removed |
| 5 | `pages/admin/Orders.jsx` | Historical price added (`peso(i.price)`) |
| 6 | `pages/admin/Menu.jsx` / `types.js` | `CATEGORIES` unified export; used in Menu + Order filters |
| 8 | `pages/customer/Order.jsx` | Quick customization buttons above note; `cartQtyMap` + `Badge` on cards |
| 9 | `components/ReceiptDialog.jsx` + `lib/receipt.js` | Filter `qty > 0`; guard `cashTendered`/`changeGiven` > 0 (stray ₱0 fix) |
| 10 | `pages/admin/Dashboard.jsx` | `Area type="linear"` |
| 11 | `pages/customer/History.jsx` | Reorder button removed (AppStore reorder logic remains) |
| 12 | `.env.example` | Added values |

Possible omissions/regressions to verify:
- `/register` removed but `actions.js` may still export `register` — verify no callers.
- Reorder button removed from History; confirm if still needed.
- `CATEGORIES` completeness vs seed data.
- Receipt `qty > 0` filter — confirm intended business rule.
- `.env.example` vs `.env.local` field parity.
- Documentation sync: `docs/DESIGN.md` may need updates if `CATEGORIES` or customization buttons change.

---

## Part 15 — Teacher Q&A practice

**Q: What does this app do?**
A: Coffee-shop POS for staff (cashier + admin). Cashier takes orders with discounts; admin manages orders, menu, staff, and reports.

**Q: How does a cashier get to the order screen?**
A: `/login` with cashier role → `App.jsx` `RequireRole cashier` shows `AppShell` cashier → `/order` loads `OrderPage`.

**Q: What stops a cashier from seeing admin pages?**
A: `RequireRole role="admin"` in `App.jsx`. Wrong role → redirect to `/order`. Plus `database.rules.json`: `/orders` full read only for admin; cashier only `/orders/<uid>`.

**Q: Where is all the Firebase access?**
A: Only `src/services/*.services.js`. Pages never import Firebase directly. Store (`AppStore.jsx`) calls services.

**Q: Why does the receipt rebuild from pure data?**
A: `receipt.js` has no Firebase import. Pure modules are fully tested and deterministic.

**Q: Was `/register` intentionally removed?**
A: Yes — file deleted; route never existed in `App.jsx`. Staff accounts are created by admin from `/admin/cashiers` or manually in the console.

---

## Part 16 — Glossary

- **AppShell** (`src/components/AppShell.jsx`): shared layout (sidebar, header, notifications, logout) for cashier and admin variants.
- **AppStore / useStore** (`src/store/AppStore.jsx`): React context holding subscriptions (`users`, `menu`, `orders`), `currentUser`, `authReady`, and local `cart`.
- **Services** (`src/services/*.services.js`): every Firebase Auth / RTDB call; mutations return `{success, message, data}`; reads are live subscriptions or one-shot promises.
- **Role-scoped subscriptions**: `AppStore` listens to different DB paths based on `currentUser.role` (admin = `/orders` + `/users`; cashier = `/orders/<uid>`).
- **RangePicker** (`src/components/RangePicker.jsx`): shared period picker between Dashboard and Reports; switches bucket mode (hourly/daily) based on selection.
- **CATEGORIES** (`src/types.js`): unified export; used in `Menu.jsx` + `Order.jsx` filters.
- **QuantityStepper** (`src/components/QuantityStepper.jsx`): `+` / `-` and typed quantity; clamps 1–99.
- **Order number**: client-generated (`ORD-MVC26YJ9`); `orderNo()` in `format.js`.
- **Cash only**: one payment method (`cashTendered`, `changeGiven`).
- **DISCOUNT RATE = 0.2**: 20% matches RA 10754 Sec. 32(a)(1) (PWD) and RA 7432 Sec. 5(a) as amended (Senior Citizen). No ID proof captured.
- **Waiting**: spinner shown when `!authReady` (`App.jsx`) — prevents redirect loop on deep links.
- **History price (`peso(i.price)`)**: added in `Orders.jsx` so admin sees original price at order time.
- **Receipt zero-fix**: `qty > 0` filter and `cashTendered`/`changeGiven` > 0 guard added to prevent stray ₱0.

---

## Appendix — Repository map

```
src/
  main.jsx                    # Router mount + StoreProvider + Toaster
  App.jsx                     # Route table + role guards
  types.js                    # Shared contracts / DB shape (exports CATEGORIES)
  index.css                   # Tailwind layers + olive/cream CSS variables

  store/
    AppStore.jsx              # React context: users, menu, orders, cart, currentUser, authReady

  lib/
    services/                 # (see src/services/) RTDB + Auth calls
    stats.js                  # Date ranges, bucketing, aggregates (pure)
    finance.js                # Gross / net totals (pure)
    discounts.js              # Discount maths + statutory basis (20%)
    duplicates.js             # Product-name normalization + duplicate detection (pure)
    receipt.js                # Pure receipt model + filenames
    roles.js                  # "admin" → Owner/Manager, "cashier" → Cashier
    format.js                 # Peso/date formatting + orderNo()
    utils.js                  # cn() class merger
    voids.js                  # Void workflow helpers
    schemas.js                # Zod schemas
    __tests__/                # 10 suites, 200 tests

  services/
    auth.services.js
    menu.services.js
    orders.services.js
    users.services.js

  components/
    AppShell.jsx              # Sidebar, header, notification bell, logout
    RangePicker.jsx           # Shared period selector (Dashboard + Reports)
    DiscountPicker.jsx        # PWD / Senior Citizen selector
    ReceiptDialog.jsx         # Print + PDF for one transaction
    StatusBadge.jsx           # Order status → colour
    QuantityStepper.jsx        # +/- and typed quantity
    MenuImage.jsx             # Image with placeholder fallback
    Logo.jsx                  # Placeholder mark
    ui/                       # shadcn primitives

  pages/
    auth/                     # Login, AuthLayout
    customer/                 # Order (cart + checkout), History
    admin/                    # Dashboard, Orders, Menu, Cashiers, Reports

Root config:
  .env.example                # Firebase web config template
  package.json                # Scripts + dependencies
  vite.config.js              # React plugin + "@" → src/ alias
  vitest.config.js            # Test runner, TZ pinned to UTC
  tailwind.config.js          # Theme + olive/cream variables
  firebase.json               # Points at rules (docs/database.rules.json) and hosting (dist)
  docs/database.rules.json    # Source of truth for RTDB access control
  components.json             # shadcn/ui config
```

> Security rules are intentionally kept in `docs/database.rules.json` (referenced by `firebase.json`) rather than duplicated here, so there is a single source of truth. See Part 7 for the model and that file for the exact expressions.