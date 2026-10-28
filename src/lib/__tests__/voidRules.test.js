/**
 * Security-rule tests for the void workflow, run against the real
 * database.rules.json with the `targaryen` rules simulator.
 *
 * Targaryen evaluates the same rules language as Firebase but is not the Firebase
 * emulator. It compares objects by reference, so whole-order rewrites are tested as
 * merge updates here, and the pre-existing `items` equality check is disabled below. Run `firebase emulators:start --only database` and repeat the key
 * cases by hand before relying on a deployment (see docs/void_workflow.md).
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const targaryen = require("targaryen")
const rules = JSON.parse(readFileSync(new URL("../../../database.rules.json", import.meta.url), "utf8"))

// Targaryen cannot deep-compare objects (it compares by reference), so the existing
// `items` immutability check always fails there, for every write to every order, in
// the original rules too. It is switched off for this simulation only; nothing in
// database.rules.json changes. Everything the void workflow added is still evaluated.
const orderRules = rules.rules.orders.$customerId.$orderId
const ITEMS_EQ = "newData.child('items').val() === data.child('items').val()"
if (!orderRules[".validate"].includes(ITEMS_EQ)) throw new Error("items check moved; update this test")
orderRules[".validate"] = orderRules[".validate"].replace(ITEMS_EQ, "true")

const NOW = "2026-10-28T02:05:00.000Z"
const item = { menuItemId: "m_1", name: "Iced Americano", price: 80, qty: 2, category: "Coffee" }

const baseOrder = (over = {}) => ({
  customerId: "c1",
  customerName: "Cashier One",
  displayId: "ORD-1",
  items: { m_1: item },
  subtotal: 160,
  discountType: "none",
  discountAmount: 0,
  total: 160,
  paymentMethod: "Cash",
  status: "pending",
  createdAt: "2026-10-28T02:00:00.000Z",
  ...over,
})

const voidRequest = (over = {}) => ({
  requestId: "r1", status: "pending", reason: "Incorrect order entered", requestedBy: "c1",
  requestedByName: "Cashier One", requestedAt: NOW, previousOrderStatus: "preparing", ...over,
})

function makeDb(orders = {}) {
  return targaryen.database(rules, {
    users: {
      c1: { name: "Cashier One", email: "c1@x.com", role: "cashier", createdAt: NOW },
      c2: { name: "Cashier Two", email: "c2@x.com", role: "cashier", createdAt: NOW },
      a1: { name: "Owner", email: "a1@x.com", role: "admin", createdAt: NOW },
      a2: { name: "Off Duty", email: "a2@x.com", role: "admin", createdAt: NOW, disabled: true },
    },
    menu: { m_1: { name: "Iced Americano", price: 80, description: "d", category: "Coffee", available: true } },
    orders,
  })
}

const as = (db, uid) => db.as({ uid, token: { email: `${uid}@x.com` } })
const allowed = (r) => r.allowed === true

const plain = () => makeDb({ c1: { o1: baseOrder() } })
const pendingVoid = () =>
  makeDb({ c1: { o1: baseOrder({ status: "pending_void", voidRequest: voidRequest() }) } })

describe("cashier cannot touch the void fields", () => {
  it("cannot change an existing order's status at all", () => {
    expect(allowed(as(plain(), "c1").write("/orders/c1/o1/status", "cancelled"))).toBe(false)
    expect(allowed(as(plain(), "c1").write("/orders/c1/o1/status", "pending_void"))).toBe(false)
  })

  it("cannot write voidRequest directly or smuggle it into an order", () => {
    expect(allowed(as(plain(), "c1").write("/orders/c1/o1/voidRequest", voidRequest()))).toBe(false)
    expect(allowed(as(plain(), "c1").update("/orders/c1/o1", { status: "pending_void", voidRequest: voidRequest() }))).toBe(false)
  })

  it("cannot create an order that is already pending_void or carries void data", () => {
    const db = makeDb()
    expect(allowed(as(db, "c1").write("/orders/c1/new", baseOrder()))).toBe(true)
    expect(allowed(as(db, "c1").write("/orders/c1/new", baseOrder({ status: "pending_void" })))).toBe(false)
    expect(allowed(as(db, "c1").write("/orders/c1/new", baseOrder({ voidRequest: voidRequest() })))).toBe(false)
    expect(allowed(as(db, "c1").write("/orders/c1/new", baseOrder({ voidHistory: { r0: voidRequest({ requestId: "r0" }) } })))).toBe(false)
  })

  it("cannot approve or decline their own request", () => {
    const db = pendingVoid()
    expect(allowed(as(db, "c1").write("/orders/c1/o1/status", "cancelled"))).toBe(false)
    expect(allowed(as(db, "c1").write("/orders/c1/o1/voidRequest/status", "approved"))).toBe(false)
    expect(allowed(as(db, "c1").write("/orders/c1/o1/voidRequest", null))).toBe(false)
  })

  it("cannot read or write another cashier's orders", () => {
    const db = pendingVoid()
    expect(allowed(as(db, "c2").read("/orders/c1/o1"))).toBe(false)
    expect(allowed(as(db, "c2").write("/orders/c1/o1/voidRequest", voidRequest({ requestedBy: "c2" })))).toBe(false)
  })

  it("can read their own void request", () => {
    expect(allowed(as(pendingVoid(), "c1").read("/orders/c1/o1/voidRequest"))).toBe(true)
  })
})

describe("admin clients cannot forge decisions either", () => {
  it("cannot move an order to pending_void or fabricate a request", () => {
    expect(allowed(as(plain(), "a1").write("/orders/c1/o1/status", "pending_void"))).toBe(false)
    expect(allowed(as(plain(), "a1").write("/orders/c1/o1/voidRequest", voidRequest()))).toBe(false)
    expect(allowed(as(plain(), "a1").update("/orders/c1/o1", { status: "pending_void", voidRequest: voidRequest() }))).toBe(false)
  })

  it("cannot decide a request by writing the order directly", () => {
    const db = pendingVoid()
    expect(allowed(as(db, "a1").write("/orders/c1/o1/status", "cancelled"))).toBe(false)
    expect(allowed(as(db, "a1").write("/orders/c1/o1/status", "preparing"))).toBe(false)
    expect(allowed(as(db, "a1").write("/orders/c1/o1/voidRequest/status", "approved"))).toBe(false)
    expect(allowed(as(db, "a1").write("/orders/c1/o1/voidRequest/decidedBy", "a1"))).toBe(false)
    expect(allowed(as(db, "a1").update("/orders/c1/o1", { status: "cancelled", voidRequest: voidRequest({ status: "approved", decision: "approved", decidedBy: "a1" }) }))).toBe(false)
    expect(allowed(as(db, "a1").update("/orders/c1/o1", { status: "cancelled", "voidRequest/status": "approved" }))).toBe(false)
  })

  it("cannot erase the audit trail", () => {
    const db = pendingVoid()
    expect(allowed(as(db, "a1").write("/orders/c1/o1/voidRequest", null))).toBe(false)
    expect(allowed(as(db, "a1").write("/orders/c1/o1/voidRequest/reason", null))).toBe(false)
    expect(allowed(as(db, "a1").write("/orders/c1/o1/voidRequest/status", null))).toBe(false)
    expect(allowed(as(db, "a1").write("/orders/c1/o1", null))).toBe(false)
  })

  it("cannot rewrite history", () => {
    const db = makeDb({ c1: { o1: baseOrder({ voidHistory: { r0: voidRequest({ requestId: "r0", status: "declined" }) } }) } })
    expect(allowed(as(db, "a1").write("/orders/c1/o1/voidHistory/r0/status", "approved"))).toBe(false)
    expect(allowed(as(db, "a1").write("/orders/c1/o1/voidHistory/r0", null))).toBe(false)
    expect(allowed(as(db, "a1").write("/orders/c1/o1/voidHistory", null))).toBe(false)
  })

  it("cannot refund an order while its void is pending", () => {
    const refund = { id: "f1", orderId: "o1", amount: 10, reason: "test reason", status: "completed", createdAt: NOW, approvedBy: "a1" }
    expect(allowed(as(pendingVoid(), "a1").write("/orders/c1/o1/refunds/f1", refund))).toBe(false)
  })
})

describe("existing admin behaviour is unchanged", () => {
  it("advances a normal order through its statuses", () => {
    for (const s of ["preparing", "ready", "completed", "cancelled"]) {
      expect(allowed(as(plain(), "a1").write("/orders/c1/o1/status", s))).toBe(true)
    }
  })

  it("records a refund on a completed order, including the whole-order rewrite the app uses", () => {
    const db = makeDb({ c1: { o1: baseOrder({ status: "completed" }) } })
    const refund = { id: "f1", orderId: "o1", amount: 10, reason: "test reason", status: "completed", createdAt: NOW, approvedBy: "a1" }
    expect(allowed(as(db, "a1").write("/orders/c1/o1/refunds/f1", refund))).toBe(true)
    expect(allowed(as(db, "a1").update("/orders/c1/o1", { refunds: { f1: refund }, refundedTotal: 10 }))).toBe(true)
  })

  it("rewrites an order that carries a decided request without changing it", () => {
    const decided = baseOrder({ status: "cancelled", voidRequest: voidRequest({ status: "approved", decision: "approved", decidedBy: "a1", decidedAt: NOW }) })
    const db = makeDb({ c1: { o1: decided } })
    expect(allowed(as(db, "a1").update("/orders/c1/o1", { note: "kept" }))).toBe(true)
  })

  it("still lets an admin delete an order that was never void-requested", () => {
    expect(allowed(as(plain(), "a1").write("/orders/c1/o1", null))).toBe(true)
  })

  it("keeps totals and items immutable", () => {
    expect(allowed(as(plain(), "a1").update("/orders/c1/o1", { total: 1 }))).toBe(false)
  })

  it("rejects a disabled admin", () => {
    expect(allowed(as(plain(), "a2").write("/orders/c1/o1/status", "preparing"))).toBe(false)
  })
})
