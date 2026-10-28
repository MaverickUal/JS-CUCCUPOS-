# Void request and approval workflow

A cashier asks to void an order; the Owner/Manager approves or declines. Nothing is
deleted at any point, and the cashier can never cancel an order directly.

## Flow

1. **Request.** Cashier history shows **Request Void** on orders that are `pending`,
   `preparing` or `ready`. The dialog shows the order, asks for a reason (3-300
   characters) and asks for confirmation. The `requestVoid` Cloud Function sets the
   order to `pending_void` (label **Pending Void**) and stores the previous status.
2. **Review.** The Owner/Manager Orders page has a **Pending Void** tab listing every
   waiting request with order number, cashier, order time, items, total, previous
   status, reason and request time. Both sides update live through the existing
   `onValue` listeners.
3. **Approve.** `approveVoid` sets the order to `cancelled` and records the decision.
   `cancelled` orders are already excluded from sales totals and order counts.
4. **Decline.** `declineVoid` needs a reason, restores the recorded previous status
   and records the decision.
5. **Audit.** The request and decision stay on the order and show in both order views.
   A decided request cannot be decided again.

Declined orders can be voided again. The earlier request moves into `voidHistory`
instead of being overwritten.

## Data

Added to `orders/<cashierUid>/<orderId>`:

| Field | Meaning |
|---|---|
| `status` | New value `pending_void`. Only the functions set or clear it. |
| `voidRequest` | Latest request (below). Absent on orders never submitted. |
| `voidHistory/<requestId>` | Earlier requests, same shape. Written only by the functions. |

`voidRequest`: `requestId`, `status` (`pending` \| `approved` \| `declined`), `reason`,
`requestedBy`, `requestedByName`, `requestedAt`, `previousOrderStatus`, and once decided
`decision`, `decisionReason` (required when declined), `decidedBy`, `decidedByName`,
`decidedAt`. Timestamps are ISO strings like the rest of the order. Unset fields are
absent, not `null`, because RTDB does not store nulls.

Order status and request status are separate: the first is the order's operational
state, the second is the approval state.

## Where each rule is enforced

| Rule | Cloud Function (`functions/src/voids.js`) | `database.rules.json` |
|---|---|---|
| Caller is an active cashier / admin, checked against `users/<uid>` | yes | role checks as before |
| Order belongs to the cashier | path built from the caller's uid, plus `customerId` check | cashiers cannot write existing orders |
| Reason required (request and decline) | yes | not enforced |
| Eligible status, no duplicate, no refunded order | yes | not enforced |
| Decision made once, against the current `requestId` | yes, inside a transaction | not enforced |
| Clients cannot create, change or delete `voidRequest` / `voidHistory` | n/a | yes |
| Clients cannot enter or leave `pending_void` | n/a | yes |
| No refund while a void is pending | n/a | yes, and in `refunds.js` |
| Totals, items, payment, timestamps unchanged | unchanged | existing rules |

The functions use the Admin SDK, which bypasses the rules, so each one checks identity,
role and state itself. The rules are what stop a signed-in client from skipping the
functions and writing the fields directly.

## Behaviour to know about

- Completed orders cannot be voided. They go through the existing refund flow.
- An order with any refund cannot be voided, and refunds are blocked while a void is
  pending. A void never touches cash or the refund records.
- `pending_void` orders still count in sales until the void is approved.
- The Owner/Manager's existing **Cancel order** button is unchanged and still works
  for `pending` and `preparing` orders.

## Deploying

The void operations are callable Cloud Functions, which need the Firebase **Blaze**
plan. Without them the Request Void and Approve/Decline buttons show the existing
"functions not deployed" message and nothing changes.

```bash
npm run deploy:rules        # firebase deploy --only database
npm run deploy:functions    # installs functions/ deps, then firebase deploy --only functions
```

Deploy the rules and the functions together. Rules first would leave the existing app
working but the new buttons unavailable; functions first would leave the void fields
writable by a signed-in admin client until the rules land.

## Tests

```bash
npm test
```

`voids.test.js` covers the transitions and the transaction wrapper.
`voidRules.test.js` runs `database.rules.json` through the `targaryen` simulator. It is
a simulator, not the Firebase emulator. Before relying on a deployment, run
`npm run emulators` and repeat the direct-write cases from that file by hand.
