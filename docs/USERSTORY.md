# USERSTORY.md — Manual Live Test Script

This is a step-by-step manual test plan for CuccuPOS running on the live site.
Follow it top to bottom. Each step states **what to do** and **what you should see**.
Use two browsers (or incognito) so a Cashier and an Admin can be signed in at the same time.

---

## 0. Prerequisites

1. Open the live site URL.
2. You need at least:
   - One **Admin** account (promoted by hand in Firebase console: `users/<uid>/role = "admin"`).
   - One **Cashier** account (created via Firebase console or sign-up, role `cashier`).
3. Menu should have at least 3 items, one of them marked **sold out**.
4. Have ₱200, ₱500, ₱1,000 cash on hand for tender tests (or use the quick buttons).

---

## 1. Cashier role — sign in

1. Go to `/login`.
2. Enter the Cashier email + password → click **Sign in**.
3. **Expected**: toast "Welcome back, …"; redirect to `/order` (Order screen). Sidebar shows Order, History.

**Negative checks**
- Wrong password → inline error "…", no redirect.
- Disabled account → "This account has been disabled…".
- Account with missing/invalid role → "Your account role is not set correctly…".

---

## 2. Cashier — browse menu and build an order

1. On `/order`, confirm menu cards show name, price, category badge, description.
2. Click a **sold-out** item → **Expected**: nothing added; card is dimmed with "Sold out" badge.
3. Click `+` on an available item 3 times → **Expected**: card shows "3 in order"; cart panel lists it with qty 3 and line total.
4. Use the **− / +** stepper and typed qty field to set qty to 5 → **Expected**: clamped to 1–99; total updates.
5. Try typing 0 or 150 → **Expected**: clamps to 1 or 99; never deletes the line. Use trash icon to remove.
6. Use category tabs (All, Coffee, Milk Tea, Frappe, Others) and search box → **Expected**: filters update; "No drinks match…" when empty.
7. Use Filter button (availability/sort) → **Expected**: available-only / sold-out / sort by name or price.

---

## 3. Cashier — checkout (no discount)

1. Add 2 items (e.g. 2× Iced Americano @ ₱80 = ₱160).
2. In cart panel, leave discount **No discount**.
3. Type cash tendered `200` (or click **Exact** / quick amounts).
4. **Expected**: Subtotal ₱160, Total ₱160, Change ₱40; **Checkout** button enabled.
5. Click **Checkout** → review dialog shows items, subtotal, total, cash, change.
6. Add a kitchen note via quick buttons ("Less Ice") and type a note.
7. Click **Confirm & send to kitchen** → spinner "Processing…" ~1.4s.
8. **Expected**: success screen "Order placed" with order number `ORD-…`; "Return ₱40 change to the customer."; breakdown shows subtotal/total/cash/change.
9. Click **Order more** → cart empty; tender and discount reset.

**Negative check**: tender `100` → Checkout disabled; dialog says "Short by ₱60".

---

## 4. Cashier — checkout with PWD discount

1. Add items totaling ₱200 (e.g. 2× ₱100).
2. Select discount **PWD**.
3. **Expected**: Subtotal ₱200, Discount −₱40 (20%), Total ₱160.
4. Tender `200` → Change ₱40.
5. Confirm order.
6. **Expected**: order stores `subtotal 200`, `discountType pwd`, `discountAmount 40`, `total 160`, `cashTendered 200`, `changeGiven 40`.

Repeat with **Senior Citizen** → same 20% math, `discountType senior`.

**Rule check**: only one discount can be selected at a time (PWD and Senior never combine).

---

## 5. Cashier — History and status tracking

1. Go to `/history`.
2. **Expected**: own orders newest-first; each shows order number, time, payment, items, total, status badge, progress bar (Received → Preparing → Ready → Picked up).
3. Click **Receipt** → receipt dialog shows items, subtotal, discount (if any), total, cash, change. Print and Download PDF work; printed output contains only this transaction.
4. Click **Request Void** on a `pending`/`preparing`/`ready` order → dialog confirms; enter reason (≥3 chars) → submit.
5. **Expected**: order status becomes **Pending Void**; progress bar freezes; audit info shows request.

**Negative checks**
- Completed/cancelled order → no Request Void button.
- Order with a refund → cannot be voided.
- Reason < 3 chars → blocked.

---

## 6. Cashier — notifications

1. When an order becomes **Ready** (admin advances it), the bell badge appears.
2. Click bell → "… is ready" → clicking navigates to `/history`.

---

## 7. Admin role — sign in

1. Sign out (account menu → Log out).
2. Go to `/login`, sign in with Admin account.
3. **Expected**: redirect to `/admin/dashboard`. Sidebar shows Dashboard, Orders, Menu, Cashiers, Reports.

**Guard check**: while signed in as Cashier, visiting `/admin/dashboard` redirects to `/order`.

---

## 8. Admin — Dashboard

1. `/admin/dashboard`: KPIs (Sales, Orders, Average order) for the selected period.
2. Change period: Today / Last 7 days / Last 30 days / Custom range.
   - **Today** → chart switches to hourly buckets (`12am, 1am, …`).
   - Empty periods show real zeroes on the axis.
3. Filter by cashier dropdown → KPIs, chart, best sellers, recent orders all follow; matches by user id.
4. Best sellers bar chart shows cups sold.
5. Recent orders table shows newest 6 (all time, not date-filtered).

---

## 9. Admin — Orders board

1. `/admin/orders`: status filter tabs (All, Pending, Pending Void, Preparing, Ready, Completed, Cancelled) with counts.
2. Search by order number or cashier name.
3. Click an order row's **Details** → dialog shows items, historical price `peso(i.price)`, subtotal/discount (if any), note, status.
4. Advance status: **Start preparing** → **Mark ready** → **Complete**.
5. **Cancel order** (pending/preparing only) → confirm dialog → status `cancelled`; toast success.
6. **Receipt** button → print/PDF for that transaction.
7. **Load more** when >100 rows.

**Negative check**: cancelled orders contribute nothing to sales figures.

---

## 10. Admin — void decisions

1. Go to **Pending Void** tab.
2. **Expected**: each request shows order number, cashier, time, items, total, previous status, reason, request time.
3. Click **Approve Void** → dialog → confirm → order becomes `cancelled`; excluded from sales.
4. Click **Decline Void** → needs a reason → order returns to previous status; cashier sees reason.
5. Decided request cannot be decided again (buttons gone).

**Rule checks**
- Completed orders cannot be voided (no button on cashier side).
- Orders with refunds cannot be voided.
- Refunds blocked while a void is pending.

---

## 11. Admin — Menu management

1. `/admin/menu`: list of items with image, category, price, flags, availability, actions.
2. **Add item**: fill name, price (>0), category, description, image (optional), available toggle → Save. Duplicate name within same category is blocked with alert.
3. **Edit item**: change fields → Save changes.
4. **Toggle availability** switch → item becomes sold out/available; reflects on cashier menu live.
5. **Delete item** → confirm → removed; past orders keep their record.
6. Duplicate review card appears if same name exists in same category (listed, never auto-merged).

---

## 12. Admin — Cashiers

1. `/admin/cashiers`: staff list with name, role badge, email, status, orders count, last order, access switch.
2. Counts header: active cashiers, Owner/Manager, disabled.
3. Search by name/email.
4. Disable a cashier (switch off) → status "Disabled"; that account can no longer sign in.
5. Re-enable (switch on) → status "Active".
6. **Self-disable blocked**: your own switch is disabled.
7. Admin/Owner rows show "Managed in console" (no switch).
8. Accounts with missing/unknown role show "Unknown" badge and still appear.

---

## 13. Admin — Reports

1. `/admin/reports`: pick period via RangePicker.
2. **Expected**: Gross sales, Net sales, Orders (with cancelled count), Cups sold; discount total note if any.
3. Cash summary: cash collected − change given out − refunds = net in drawer.
4. Sales by category (percentages of gross, sum to 100%).
5. Top items table (cups + sales).
6. Sales by day table (unless hourly).
7. **Export CSV** → file downloads with all orders in range (including subtotal, discount, cash, change, refunded, status).
8. **Print / Save as PDF** → report prints; receipts print only their transaction.

---

## 14. Cross-role live sync

1. With Cashier on `/order` and Admin on `/admin/orders` in separate browsers:
   - Cashier places an order → Admin board updates live (new pending order, notification bell).
   - Admin advances status → Cashier `/history` progress bar updates live.
   - Admin approves/declines void → Cashier sees status change live.

---

## 15. Accounts & security sanity checks

1. New sign-up at `/register` (if available) → role `cashier`. [Note: route removed in current build; accounts created in console.]
2. Promote to admin only via Firebase console (`users/<uid>/role = "admin"`); app provides no way.
3. Disabled account cannot sign in.
4. Cashier cannot read other cashiers' orders (only `/orders/<ownUid>`).
5. Cashier cannot write menu or change order status (rules reject).
6. Nobody can set their own role to admin.

---

## 16. Cleanup / reset

- Cancel test orders or mark completed; they remain in records (never deleted).
- Disabled test cashiers can be re-enabled.
- Menu changes persist; revert test items manually.

---

### Quick smoke checklist (2 minutes)
- [ ] Cashier signs in → `/order`
- [ ] Add item, checkout with cash, see change on success
- [ ] Apply PWD discount → total = subtotal − 20%
- [ ] Order appears in Cashier `/history` and Admin `/admin/orders`
- [ ] Admin advances `pending → preparing → ready → completed`
- [ ] Cashier requests void on a pending order; Admin approves → `cancelled`
- [ ] Admin disables a cashier; that account can't sign in
- [ ] Receipt prints/PDFs for one transaction only
- [ ] Dashboard and Reports period picker switches hourly/daily correctly