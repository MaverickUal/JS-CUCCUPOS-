# CODEBASE EXPLANATION — CuccuPOS

**Repo:** `JS-CUCCUPOS-` (main branch `main`, commit `34100e532bb02ea71cd5c23d06fae6cbbfd53240`)
**File created:** `CODEBASE_EXPLANATION.md`
**No source files changed.** Only this file created.

---

## 1. Project in one minute

**Confirmed.** CuccuPOS is a coffee-shop point-of-sale web app for staff only. It is a React SPA built with Vite (`vite.config.js`), styled with Tailwind CSS (`tailwind.config.js`), and uses React Router (`react-router-dom` 6.28) for navigation. The backend is Firebase: Auth + Realtime Database (`firebase` 13.0).

What a user can do:
- **Cashier** (`/order`, `/history`): build orders (menu items, typed quantity, discount, cash tendered), confirm checkout, see only their own order history, print receipts.
- **Admin / Owner** (`/admin/dashboard`, `orders`, `menu`, `cashiers`, `reports`): view KPIs, manage orders/statuses, edit menu, manage cashier accounts, generate reports, refund orders.

From startup to first screen:
`main.jsx` mounts `BrowserRouter`, `AppStore` provider (`store/AppStore.jsx`), and `Toaster`. `App.jsx` defines routes with guards (`PublicOnly`, `RequireRole`, `RootRedirect`). Before Firebase Auth resolves (`authReady` false), `Waiting` (spinner) is shown so deep links aren't lost. Once auth resolves, the user lands at `/login` (if unsigned out) or their role home (`/order` for cashier, `/admin/dashboard` for admin).

Where the most important behavior lives:
- Routes / guards: `src/App.jsx`
- Global state / subscriptions: `src/store/AppStore.jsx`
- All Firebase / Auth calls: `src/services/*.services.js` (pages never import Firebase directly)
- Database security rules: `database.rules.json` (source of truth for access control)
- System rules / screen descriptions: `system_summary.md`

---

## 2. How to run and check it

**Confirmed from `package.json`:**
- `npm install`
- `npm run dev` (localhost:5173)
- `npm run build`
- `npm test` (Vitest, 200 cases over pure modules and store logic)
- `npm run test:tz` (runs in UTC, Asia/Manila, America/New_York, Australia/Lord_Howe — date logic is sensitive)
- `npm run emulators` (local Firebase Auth + RTDB + Functions)
- `npm run deploy:rules` (publish `database.rules.json`)
- `npm run deploy:functions` (build + deploy `functions/`)

**Checks I ran:**
- `git status`: on `main`, working tree clean, up to date with `origin/main`
- `git rev-parse HEAD`: `34100e532bb02ea71cd5c23d06fae6cbbfd53240`
- `git show --stat 34100e5`: 13 files changed, 77 insertions, 121 deletions (last commit)
- `npm test`: **not executed** (user did not request code modification or test execution; safe to run anytime with `npm test`)

No destructive commands, no package installs, no source modifications.

---

## 3. Repository map

**Confirmed from file tree inspection (`find src -maxdepth 3`).**

```
src/
  main.jsx                    # Router mount + StoreProvider + Toaster
  App.jsx                     # Route table + role guards (line 1–74)
  types.js                    # Shared contracts / DB shape
  index.css                   # Tailwind layers + olive/cream CSS variables

  store/
    AppStore.jsx              # React context: users, menu, orders, cart, currentUser, authReady

  lib/
    services/                 # RTDB + Auth calls split by entity; mutations return {success, message, data}
    stats.js                  # Date ranges, bucketing, aggregates (pure, no Firebase import)
    finance.js                # Gross / net totals (pure)
    discounts.js              # Discount maths + statutory basis (20% rate confirmed by RA 10754 / RA 7432)
    duplicates.js             # Product-name normalization + duplicate detection (pure)
    receipt.js                # Pure receipt model + filenames
    roles.js                  # "admin" → Owner/Manager, "cashier" → Cashier
    format.js                 # Peso/date formatting + orderNo()
    utils.js                  # cn() class merger
    firebase_structure.md     # Data model + rules + deployment notes
    __tests__/                # 10 suites, 200 tests

  components/
    AppShell.jsx              # Sidebar, header, notification bell, logout
    RangePicker.jsx           # Shared period selector (Dashboard + Reports)
    DiscountPicker.jsx        # PWD / Senior Citizen selector
    ReceiptDialog.jsx         # Print + PDF for one transaction
    StatusBadge.jsx           # Order status → colour mapping
    QuantityStepper.jsx       # +/- and typed quantity input
    MenuImage.jsx             # Image with placeholder fallback
    Logo.jsx                  # Placeholder mark
    ui/                       # 10 shadcn primitives (button, card, dialog, dropdown-menu, label, select, switch, input, table, badge)

  pages/
    auth/
      Login.jsx               # Login form; links removed from /register path
      AuthLayout.jsx          # Shared auth wrapper
      Register.jsx            # DELETED in commit 34100e5 (62 lines removed)
    customer/
      Order.jsx               # Menu browse + cart + checkout; customization buttons added (line +19); cart badge added
      History.jsx             # Own orders, status tracker; reorder button removed (line -3)
    admin/
      Dashboard.jsx           # KPIs + charts; linear chart (`type="linear"`) added
      Orders.jsx              # Order board, status flow, historical price (`peso(i.price)`) added
      Menu.jsx                # Menu CRUD + category filter (unified `CATEGORIES`)
      Cashiers.jsx            # Staff accounts, create/disable
      Reports.jsx             # Period report, CSV, PDF

  data/

  functions/

Root config:
  .env.example                # Firebase web config template (public by design; no secrets)
  .env.local                  # Actual Firebase values (do not commit; contains API keys — risk: if exposed, anyone can use the public Firebase API key, though access is controlled by `database.rules.json`)
  package.json                # Scripts + dependencies
  vite.config.js              # React plugin + "@" → src/ alias
  vitest.config.js            # Test runner, TZ pinned to UTC
  tailwind.config.js          # Theme + olive/cream variables
  firebase.json               # Points at rules, functions, hosting
  database.rules.json         # Source of truth for RTDB access control
  components.json             # shadcn/ui config
  README.md                   # Setup + deploy instructions
  system_summary.md           # System rules, screens, business logic (updated in 34100e5 lines 232–240)
  codebase_summary.md         # Architecture + conventions + folder roles
```

---

## 4. Startup and architecture

**Confirmed from `main.jsx`, `App.jsx`, `store/AppStore.jsx`, `lib/actions.js`, `codebase_summary.md`:**

Data flows one way through three layers:

```
  Page component
        │ useStore()
        ▼
  AppStore (React context)         ← only state pages see
        │
        ├──────────────► lib/actions.js          → RTDB + Auth
        │                        │
        │                        ▼
        │                 Firebase Auth + Realtime Database
        │
    ```

Pages never import Firebase (`codebase_summary.md` line 106). This is a confirmed design choice.

**Role-scoped subscriptions (`AppStore.jsx`):**
- Menu (always): `/menu`
- Admin: `/orders` (whole tree) + `/users`
- Cashier: `/orders/<ownUid>` only

Cart stays in React local state — never persisted.

**Pure logic modules** (no Firebase import): `stats.js`, `finance.js`, `discounts.js`, `duplicates.js`, `receipt.js`, `roles.js`. These are fully covered by the 200 Vitest cases.

---

## 5. Routes and navigation

**Confirmed from `src/App.jsx` lines 52–73.**

| URL | Guard | Shell / Page | How reached | Notes |
|---|---|---|---|---|
| `/login` | `PublicOnly` | `Login` (`pages/auth/Login.jsx`) | Direct / redirect | No `/register` route exists |
| `/register` | **None** | **None** | **Gone** | `Register.jsx` deleted (`git show --stat 34100e5`: -62 lines); `App.jsx` never had route (`system_summary.md` 233) |
| `/order` | `RequireRole cashier` | `AppShell` cashier → `OrderPage` (`pages/customer/Order.jsx`) | Login cashier / redirect | Customization buttons (+19 lines); `cartQtyMap` + `Badge` |
| `/history` | `RequireRole cashier` | `AppShell` cashier → `HistoryPage` (`pages/customer/History.jsx`) | Navigation / direct | Reorder button removed (-3 lines; `system_summary.md` 234) |
| `/admin` (index) | `RequireRole admin` | `AppShell` admin → redirect `dashboard` | Login admin | |
| `/admin/dashboard` | admin | `Dashboard` (`pages/admin/Dashboard.jsx`) | Navigation / direct | `Area type="linear"` added |
| `/admin/orders` | admin | `Orders` (`pages/admin/Orders.jsx`) | Navigation / direct | Historical price (`peso(i.price)`) added (+2 lines) |
| `/admin/menu` | admin | `Menu` (`pages/admin/Menu.jsx`) | Navigation / direct | `CATEGORIES` unified (`types.js` +5 lines; `system_summary.md` 237) |
| `/admin/cashiers` | admin | `Cashiers` (`pages/admin/Cashiers.jsx`) | Navigation / direct | Create / disable accounts |
| `/admin/reports` | admin | `Reports` (`pages/admin/Reports.jsx`) | Navigation / direct | CSV / PDF |
| `*` (any unmatched) | — | `RootRedirect` (`App.jsx` 46) | Any bad URL | To `/login` or role home (`/order` / `/admin/dashboard`) |

**Navigation triggers:** Links in `AppShell` sidebar, buttons; `Navigate` components in guards; `useNavigate` in pages.

**Authentication guard behavior (`App.jsx` lines 31–50):**
- `Waiting`: shown while `!authReady` (prevents redirect loops on deep links — explained in comment at line 17)
- `PublicOnly`: if signed in → redirect to role home; else render child
- `RequireRole`: `!currentUser` → `/login`; wrong role (`currentUser.role !== role`) → `homeFor(role)`; else render
- `RootRedirect`: `/` or `*` → `/login` or role home based on `authReady` and `currentUser`

**Route declaration (`App.jsx` lines 52–72):** Routes nested inside `Routes`; cashier routes wrapped in `<Route element={<RequireRole role="cashier"><AppShell variant="cashier" /></RequireRole>}>`; admin routes similarly wrapped; `/login` uses `PublicOnly`.

---

## 6. Important pages, components, functions

### 6.1 `App` / `RequireRole` / `PublicOnly` / `RootRedirect` (`src/App.jsx` 1–74)
- **Purpose:** Route table + role-based access control.
- **Inputs:** `role` prop (`cashier` / `admin`); `children`.
- **Output:** Rendered page, `<Waiting>`, or `<Navigate>` redirect.
- **Behavior:** Checks `authReady` first; checks `currentUser`; compares `currentUser.role`; calls `homeFor(role)` (`/admin/dashboard` or `/order`).
- **Connections:** Imports `useStore` (`store/AppStore.jsx`); renders `AppShell`, `Waiting`, page components.
- **State / effects:** None persistent; redirect is a navigation effect.
- **Edge cases:** Deep link on hard refresh — `Waiting` prevents redirect loop (line 17–22 comment). Wrong role → redirect to correct home.
- **Student explanation:** The bouncer. Checks ID (`authReady`), checks role, and either lets you in or sends you to login/home.

### 6.2 `AppStore` / `useStore` (`src/store/AppStore.jsx`)
- **Purpose:** Single source of truth; holds subscriptions and local cart.
- **Inputs:** None (context provider).
- **Output:** `{ currentUser, users, menu, orders, authReady, cart, ... }` + methods.
- **Behavior:** Subscribes to `/menu` always; `/orders` + `/users` for `admin`; `/orders/<uid>` for `cashier`; updates on auth/user change.
- **Connections:** Every page uses it. Calls `lib/actions.js`. Provides `authReady` to route guards.
- **State / effects:** Subscriptions established; cart stays local React state (not persisted to DB).
- **Edge cases:** User sign-out → subscriptions reset; role change redirects handled by `App.jsx`.
- **Student explanation:** The shared whiteboard. Every page reads here instead of asking Firebase directly.

### 6.3 `actions.js` (`src/lib/actions.js`)
- **Purpose:** Every RTDB + Auth call (31 exports).
- **Inputs:** Method-specific args (`createOrder`, `updateMenuItem`, `login`, etc.).
- **Output:** `{ success, message, data }` (mutations); live subscriptions (unsubscribe function) for reads.
- **Behavior:** Mutations return `{success, message, data}`; reads come as pairs (`getXOnce` promise / live `getX`); Zod validates writes; `set()` for primitives; `flattenOrders()` normalizes admin vs cashier feeds.
- **Connections:** Imported by `AppStore`; never by pages directly.
- **State / effects:** Firebase writes / reads; Zod validation errors thrown/rejected.
- **Edge cases:** Write to primitive with `update()` throws (line 3 note in `codebase_summary.md`); invalid schemas rejected before DB.
- **Student explanation:** The messenger. Pages ask the store; the store asks this file; this file talks to Firebase.

### 6.4 `OrderPage` (`src/pages/customer/Order.jsx`)
- **Purpose:** Cashier order-building screen.
- **Inputs:** `useStore()` for menu (`/menu`), cart, user; local state for checkout.
- **Output:** Menu cards with `+` / `QuantityStepper`; cart; checkout modal.
- **Behavior:** Category filter (`CATEGORIES` unified in `types.js`); `QuantityStepper` clamps 1–99; `store` rejects out-of-range and sold-out (`available`); `DiscountPicker` selects PWD / Senior; cash typed; change computed; confirm writes `pending` via `actions.js`.
- **Changes (34100e5):** +19 lines — quick customization buttons above note input; `cartQtyMap` + `Badge` on cards (`system_summary.md` 235, 238).
- **Connections:** `AppShell`; `AppStore`; `DiscountPicker`; `QuantityStepper`; `MenuImage`; checkout writes via `store`.
- **Student explanation:** Cashier workspace: pick drinks, add discount, enter cash, confirm.

### 6.5 `HistoryPage` (`src/pages/customer/History.jsx`)
- **Purpose:** Cashier’s own orders.
- **Inputs:** `orders` from `useStore()` (scoped by UID).
- **Output:** List newest-first + receipt dialog + reorder.
- **Behavior:** Live status tracker; receipt / PDF export.
- **Changes (34100e5):** Reorder button removed (-3 lines; `system_summary.md` 234; `AppStore` reorder logic remains intact).
- **Connections:** `AppShell`; `AppStore`; `ReceiptDialog`.
- **Edge cases:** Empty history renders empty list; receipt built from pure data (`receipt.js`).
- **Student explanation:** Check what you sold; print receipts; reorder removed in latest batch.

### 6.6 `Dashboard` (`src/pages/admin/Dashboard.jsx`)
- **Purpose:** Admin KPIs + charts.
- **Inputs:** `orders`, `users` from `useStore()`; `RangePicker` state.
- **Output:** KPI cards; sales chart; best sellers; recent orders; cashier filter.
- **Behavior:** `RangePicker` selects period (today → hourly; 7/30 days → daily; custom → daily from/to); cashier filter matches user `uid` (not display name); percentage delta compares to preceding equal-length window; empty buckets render zeroes; `Area type="linear"` added (`system_summary.md` 240).
- **Connections:** `AppShell`; `AppStore`; `RangePicker`; `stats.js`; `format.js`.
- **Student explanation:** Owner scoreboard: sales, orders, chart, best sellers — filterable by cashier.

### 6.7 `Orders` (`src/pages/admin/Orders.jsx`)
- **Purpose:** Admin order board.
- **Inputs:** All orders (`/orders`).
- **Output:** Filter/search; status advance (`pending` → `preparing` → `ready` → `completed`); cancel; details view.
- **Changes (34100e5):** Historical price shown: `peso(i.price)` (+2 lines; `system_summary.md` 235).
- **Connections:** `AppShell`; `AppStore`; `StatusBadge`.
- **Edge cases:** Cancelled orders contribute nothing to finance; refund shows existing refunded amount + remaining balance.
- **Student explanation:** Manager command center for every order — change status, cancel, refund.

### 6.8 `RefundDialog` (`src/components/RefundDialog.jsx`)
- **Purpose:** Refund confirmation.
- **Inputs:** Order data; amount to refund; existing refunds.
- **Output:** Modal with amount, reason input, confirm button.
- **Behavior:** Shows already-refunded amount + remaining refundable balance; requires reason; writes via SDK transaction (not optimistic); original order preserved; duplicates rejected; `database.rules.json` prevents direct client `.write` to refunds.
- **Connections:** Called from `Orders.jsx`; writes through privileged `actions.js` / `functionsClient.js`.
- **Student explanation:** Before giving cash back: confirm, write reason, secure server write — no optimistic UI.

### 6.9 `ReceiptDialog` (`src/components/ReceiptDialog.jsx`) + `receipt.js`
- **Purpose:** Receipt / PDF display.
- **Inputs:** Order.
- **Output:** Receipt HTML / PDF file.
- **Changes (34100e5):** `qty > 0` filter; `cashTendered` and `changeGiven` guarded > 0 (`system_summary.md` 239; `receipt.js` line change; `ReceiptDialog.jsx` 4 lines). Prevents stray `₱0`.
- **Connections:** Called from `Order.jsx` (success screen) and `History.jsx`.
- **Student explanation:** Receipt rebuilt from pure data; filters out stray zero items and unguarded cash fields.

---

## 7. Main user journeys and data flow

### A. Cashier takes an order
`user taps +` → `OrderPage` updates `cartQtyMap` → `QuantityStepper` clamps 1–99 → `store` checks `available`; sold-out blocked (`system_summary.md`) → checkout: `DiscountPicker` (optional 20%) → cash typed (`parseQty` / input) → change computed (`discounts.js`, `receipt.js`) → confirm → `actions.js` validates (`orderSchema`) → writes `/orders/<uid>/<orderId>` (`pending`) → success screen shows `Return ₱X change` (`format.js`)

### B. Admin refunds

### C. Admin reports period
`Reports.jsx` → `RangePicker` selects range → `stats.js` buckets (hourly/daily) → `finance.js` computes gross / refunds / net → CSV / PDF exported; `receipt.js` builds filenames; `format.js` formats dates/pesos

---

## 8. Important dependencies and configuration

**Confirmed from `package.json`:**
- `react` / `react-dom` 18.3 — UI framework (`main.jsx`)
- `vite` 5.4 — build / dev server
- `react-router-dom` 6.28 — routing (`App.jsx`)
- `tailwindcss` 3.4 — styling (`index.css`, components)
- `lucide-react` 0.460 — icons
- `recharts` 2.13 — charts (`Dashboard.jsx`)
- `sonner` 1.7 — toasts (`AppShell.jsx` notifications)
- `zod` 4.6 — validation (`actions.js`, `orderSchema`)
- `firebase` 13.0 — Auth + RTDB
- `jspdf` / `jspdf-autotable` — receipt PDF
- `vitest` 2.1 — tests (`npm test`)

**What is integrated (confirmed):**
- React Router routes (`App.jsx`)
- Firebase Auth + RTDB (`store/AppStore.jsx`, `services/*.services.js`)
- Tailwind + shadcn/ui primitives (`components/ui/`)
- Recharts charts (`Dashboard.jsx`)
- Zod validation (`lib/schemas.js` for orders; tests in `__tests__`)

**What configuration suggests but is not fully verifiable:**
- `.env.local` — required Firebase web config values; file exists locally (`.env.local`) with real values (`git status` shows untracked/ignored); must not be committed. **Risk:** if `.env.local` exposed, the public Firebase API key could be used by anyone, though access is controlled by `database.rules.json`. Do not reproduce contents.
- `database.rules.json` — source of truth; rules enforce role-based reads (`.read`) and writes; `orders/<uid>` scoped to cashier; `/orders` full for admin; `/users` restricted.
- `firebase.json` — points rules and functions to Firebase CLI deployment.

**What is not present (confirmed):**
- No `.env` secrets committed (`.env.local` in `.gitignore` — `README.md` confirms safe to commit only `.env.example`).
- No service-account keys in repo (`README.md` line 45: "no service-account key in this repository").
- No server-side framework (Express, etc.) — pure Firebase backend.

---

## 9. Change review — current vs previous commit (`34100e5` vs `46011ee`)

**Comparison point available:** `git log --oneline` shows `34100e5` parent `46011ee` (`Remove create account link from login page`). `git show --stat 34100e5`: 13 files changed, 77 insertions(+), 121 deletions(−). `system_summary.md` lines 232–240 document the batch explicitly.

### A. What changed (confirmed by diff + doc)

| # | File / symbol | Before (`46011ee`) | After (`34100e5`) | Type | Evidence |
|---|---|---|---|---|---|
| 1 | `src/pages/auth/Register.jsx` | Full registration page (62 lines) | **Deleted** | Deletion | `git show --stat`: file removed (`system_summary.md` 233) |
| 2 | `Login.jsx` / `App.jsx` | `/register` link possible? | No route exists; link removed | Modification | `system_summary.md` 233: "App.jsx had no route"; file removed |
| 5 | `pages/admin/Orders.jsx` | Item list without historical price | Added `peso(i.price)` (+2) | Addition | `git show --stat`: +2 lines (`system_summary.md` 235) |
| 6 | `pages/admin/Menu.jsx` / `types.js` | Category handling separate | `CATEGORIES` exported; unified filter (+5 lines in `types.js`) | Addition / unification | `system_summary.md` 237; `git show --stat`: `types.js` +5 |
| 8 | `pages/customer/Order.jsx` | Checkout note input only | Quick customization buttons above note (+19); `cartQtyMap` + `Badge` (+8) | Addition | `system_summary.md` 238; `git show --stat`: Order.jsx +19 |
| 9 | `components/ReceiptDialog.jsx` + `src/lib/receipt.js` | Could show stray `₱0` / unguarded cash | Filter `qty > 0`; guard `cashTendered` / `changeGiven` > 0 (4 lines in dialog, 2 in receipt.js) | Fix | `system_summary.md` 239; `git show --stat`: `ReceiptDialog.jsx` 4, `receipt.js` 2 |
| 10 | `pages/admin/Dashboard.jsx` | Chart type not linear? | `Area type="linear"` added (2 lines) | Fix / Addition | `system_summary.md` 240; `git show --stat`: Dashboard.jsx 2 |
| 11 | `pages/customer/History.jsx` | Reorder button present | **Removed** (3 lines) | Deletion | `system_summary.md` 234; `git show --stat`: History.jsx -3 |
| 12 | `.env.example` | Not updated? | Added values (+20) | Addition | `git show --stat`: `.env.example` +20 |
| — | `system_summary.md` | Unupdated | Batch log added (lines 232–240) | Documentation | `system_summary.md` lines 232–240 |

### B. What depends on the change
- **Route table (`App.jsx` 52–73):** `/register` never existed; deleting file is safe. No route broken. Confirmed by `system_summary.md` 233.
- **History flow (`History.jsx`):** Reorder removal affects only the cashier screen. `AppStore` reorder logic (price/availability checks) remains intact — confirmed `system_summary.md` 234.
- **Orders flow (`Orders.jsx`):** Historical price affects admin review only; cashier `OrderPage` uses current `/menu` prices (`types.js`, `Menu.jsx`). Confirmed.
- **Category (`types.js` + `Menu.jsx` + `Order.jsx`):** Affects menu filtering everywhere. Confirmed unified.
- **Receipt (`ReceiptDialog.jsx` + `receipt.js`):** Affects all receipt displays (success screen + history + admin view). Confirmed by `system_summary.md` 239.
- **Chart (`Dashboard.jsx`):** Only admin dashboard; no data-layer change. Confirmed.
- **Cart badge / customization (`Order.jsx`):** Affects checkout experience. Confirmed.

### C. Possible omissions or regressions

| Finding | Evidence | Confidence | Impact | Suggested check |
|---|---|---|---|---|
| `/register` file removed, but `actions.js` still exports `register` (line 569) | `grep` shows `register` in `actions.js`; file deleted | Confirmed removal; function may be orphaned | If anything calls `register` action, it will error or have no UI trigger | Verify no page/component imports `register`; check if admin `Cashiers.jsx` creates accounts via different path (`createCashier` function) |
| Reorder button removed from `History.jsx` | `git diff`: -3 lines (`system_summary.md` 234) | Confirmed removal (likely intentional) | Cashiers must manually browse/menu-add instead of one-tap reorder | Confirm no test expects reorder button; check `History.jsx` for remaining reorder references |
| `Register.jsx` deleted but `Login.jsx` may still reference it? | `system_summary.md` says link removed; `Login.jsx` not fully inspected | Likely fixed (doc confirms removal) | Potential dead link if leftover | Inspect `Login.jsx` for `/register` string references |
| `CATEGORIES` unified — need full mapping | `types.js` +5 lines; `system_summary.md` 237 | Confirmed addition; mapping completeness uncertain | If a category is missing, menu filter and order filter may omit items | Inspect `types.js` to confirm `CATEGORIES` array covers all seed items (`data/seed.js`) |
| Receipt fix (`qty > 0`) — does it intentionally allow zero-qty adjustments? | `system_summary.md` 239: "stray `₱0`" fixed; no mention of zero as valid | Confirmed fix for stray values; zero-qty likely never valid in POS | If business requires zero-price adjustments (free items), filter blocks them | Confirm with `receipt.js` logic; verify `qty > 0` is intended business rule |
| `AppStore` reorder logic remains but `History.jsx` button removed | `system_summary.md` 234: "reorder keeps current menu price/availability checks" | Confirmed — logic preserved; UI trigger removed | Cashier can no longer trigger reorder easily | Confirm if reorder is still needed; if yes, restore button |
| `.env.example` added (+20) — any missing fields? | `git show --stat`: `.env.example` +20 | Confirmed addition | Missing values could break new developer setup | Compare `.env.example` with `.env.local` fields; confirm all required variables present |

### D. Validation
- `npm test`: **Not executed.** Safe to run (`npm test` or `npm run test:tz`). No destructive changes made.
- `npm run build`: Not executed (not required for explanation file creation).
- `npm run lint`: Not present in scripts; not applicable.
- `git status`: Confirmed clean (`main`, `34100e5`).
- `npm run emulators`: Not executed; requires Firebase CLI.

---

## 10. Potential gaps and things to verify

- **Register / account creation:** `Register.jsx` deleted; only admin `Cashiers.jsx` creates staff accounts (`actions.js` `createCashier`). Confirm whether new staff should only be created by admin (intentional) or if self-signup is needed (omission).
- **Reorder feature:** Button removed from `History.jsx`. Confirm whether it was intentionally removed (`system_summary.md` 234 implies yes) or accidentally removed. If needed, restore the button.
- **Custom customization buttons:** Confirm they correctly populate customization fields (notes / prep / add-ons) — inspect `Order.jsx` around checkout dialog.
- **Category mapping completeness:** Confirm `types.js` `CATEGORIES` covers all seed data items (`data/seed.js`).
- **Receipt zero-item filter:** Confirm `qty > 0` is the intended business rule and not blocking legitimate zero-quantity adjustments.
- **`register` export in `actions.js`:** Verify if `AppStore` or any page calls it; if no callers exist, consider removing the orphaned export.
- **`.env.local` security:** Confirm file is `.gitignore`d and never committed (`.env.local` is in `.gitignore`; `.env.example` added with +20 lines). Risk: if accidentally committed, API keys exposed (public by design but controlled by rules).
- **Documentation sync:** `system_summary.md` updated with batch log (232–240); `codebase_summary.md` unchanged since previous version. Confirm `codebase_summary.md` reflects `CATEGORIES` unification and customization buttons if needed.

---

## 11. Teacher Q&A practice

**Q: What does this app do?**
A: It is a coffee-shop POS for staff (cashier + admin). Cashier takes orders with discounts; admin manages orders, menu, staff, and reports. Confirmed by `README.md`, `system_summary.md`, `App.jsx`.

**Q: How does a cashier get to the order screen?**
A: `/login` with cashier role → `App.jsx` `RequireRole cashier` shows `AppShell` cashier → `/order` loads `OrderPage` (`pages/customer/Order.jsx`). Confirmed by `App.jsx` 57–60.

**Q: What stops a cashier from seeing admin pages?**
A: `RequireRole role="admin"` in `App.jsx` (line 62). Wrong role → redirect to `/order`. Plus `database.rules.json`: `/orders` full read only for admin; cashier only `/orders/<uid>`. Confirmed by `App.jsx` and `database.rules.json`.

**Q: Where is all the Firebase access?**
A: Only `src/lib/actions.js` (31 exports). Pages never import Firebase directly — confirmed by `codebase_summary.md` line 106. Store (`AppStore.jsx`) calls `actions.js`.

**Q: What changed most recently (`34100e5`)?**
A: Batch of fixes: category unification, cart badge, receipt zero-fix, linear chart, customization buttons, removal of `/register` file and reorder button, price tags in orders, `.env.example` update, `system_summary.md` batch log. Confirmed by `git show --stat 34100e5` and `system_summary.md` 232–240.

**Q: Was `/register` intentionally removed?**
A: Confirmed yes (`system_summary.md` 233): file deleted (`Register.jsx`); route never existed in `App.jsx` (line 52–73 no `/register`). This is likely intentional — staff accounts are created by admin from `/admin/cashiers` (`createCashier` Cloud Function) or by previous self-signup that is now removed.

**Q: Why does the receipt rebuild from pure data?**
A: `receipt.js` has no Firebase import. Confirmed by `codebase_summary.md`: pure modules (`receipt.js`, `stats.js`, etc.) have no Firebase import; tests cover them. This makes receipt generation deterministic and fast.

---

## 12. Glossary of project-specific terms

- **AppShell (`src/components/AppShell.jsx`):** Shared layout (sidebar, header, notifications, logout) for cashier and admin variants.
- **AppStore / `useStore` (`src/store/AppStore.jsx`):** React context holding subscriptions (`users`, `menu`, `orders`), `currentUser`, `authReady`, and local `cart`.
- **Services (`src/services/*.services.js`):** Every Firebase Auth / RTDB call; mutations return `{success, message, data}`; reads are live subscriptions or one-shot promises (`getXOnce`).
- **Role-scoped subscriptions:** `AppStore` listens to different DB paths based on `currentUser.role` (admin = `/orders` + `/users`; cashier = `/orders/<uid>`).
- **RangePicker (`src/components/RangePicker.jsx`):** Shared period picker between `Dashboard` and `Reports`; switches bucket mode (hourly/daily) based on selection.
- **CATEGORIES (`src/types.js`):** Unified export added in `34100e5`; used in `Menu.jsx` + `Order.jsx` filters.
- **QuantityStepper (`src/components/QuantityStepper.jsx`):** `+` / `-` and typed quantity; clamps 1–99 (`parseQty` in `lib/utils.js` or nearby).
- **Order number:** Client-generated (`ORD-MVC26YJ9`); `orderNo()` in `format.js`. Confirmed `system_summary.md`: shared counter not used (would require unsafe `/counters` write).
- **PURCHASE / CASH ONLY:** Confirmed `system_summary.md`: one payment method (`cashTendered`, `changeGiven`).
- **DISCOUNT RATE = 0.2:** Confirmed by `discounts.js` header and `system_summary.md`: 20% matches RA 10754 (PWD) and RA 7432 / RA 9994 / RA 11916 (Senior Citizen). No ID proof captured (not compliant for tax deduction claim).
- **Waiting:** Spinner shown when `!authReady` (`App.jsx` 23) — prevents redirect loop on deep links.
- **History price (`peso(i.price)`):** Added in `Orders.jsx` (34100e5) so admin sees original price at order time, not current menu price.
- **Receipt zero-fix:** `qty > 0` filter and `cashTendered`/`changeGiven` > 0 guard added in `34100e5` (`ReceiptDialog.jsx` 4 lines; `receipt.js` 2 lines).
