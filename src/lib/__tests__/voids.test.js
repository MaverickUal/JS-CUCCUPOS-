import { describe, expect, it } from "vitest"
import { applyVoidDecision, applyVoidRequest } from "../../../functions/src/voids.js"
import { canRequestVoid, isPendingVoid, pendingVoids, validateReason, voidTimeline } from "@/lib/voids"
import { applyRefund } from "@/lib/refunds"
import { totalsFor } from "@/lib/finance"

const cashier = { uid: "c1", name: "Cashier One" }
const admin = { uid: "a1", name: "Owner" }
const NOW = "2026-10-28T02:05:00.000Z"

const order = (over = {}) => ({
  customerId: "c1",
  customerName: "Cashier One",
  displayId: "ORD-MVC26YJ9",
  items: { m_1: { menuItemId: "m_1", name: "Iced Americano", price: 80, qty: 2, category: "Coffee" } },
  total: 160,
  paymentMethod: "Cash",
  status: "pending",
  createdAt: "2026-10-28T02:00:00.000Z",
  ...over,
})

const request = (o, ...rest) => {
  const [reason, requestId = "r1", now = NOW] = rest.length ? rest : ["Incorrect order entered"]
  return applyVoidRequest(o, { requestId, reason, cashier, now })
}

const decide = (o, decision, reason, requestId = "r1") =>
  applyVoidDecision(o, { requestId, decision, reason, admin, now: "2026-10-28T02:10:00.000Z" })

describe("requesting a void", () => {
  it("moves the order to pending_void and records the previous status", () => {
    for (const status of ["pending", "preparing", "ready"]) {
      const { order: next } = request(order({ status }))
      expect(next.status).toBe("pending_void")
      expect(next.voidRequest).toMatchObject({
        requestId: "r1", status: "pending", reason: "Incorrect order entered",
        requestedBy: "c1", requestedByName: "Cashier One", requestedAt: NOW, previousOrderStatus: status,
      })
    }
  })

  it("leaves money, items and timestamps untouched", () => {
    const o = order()
    const { order: next } = request(o)
    expect(next).toMatchObject({ total: o.total, items: o.items, createdAt: o.createdAt, paymentMethod: "Cash", displayId: o.displayId })
  })

  it("requires a reason", () => {
    for (const reason of [undefined, "", "  ", "ab", 42]) {
      expect(request(order(), reason).error.code).toBe("invalid-argument")
    }
  })

  it("rejects a duplicate pending request", () => {
    const first = request(order()).order
    expect(request(first, "again please", "r2").error.code).toBe("failed-precondition")
  })

  it("rejects ineligible orders", () => {
    expect(request(order({ status: "completed" })).error.code).toBe("failed-precondition")
    expect(request(order({ status: "cancelled" })).error.code).toBe("failed-precondition")
    expect(request(order({ refundedTotal: 20 })).error.code).toBe("failed-precondition")
    expect(request(null).error.code).toBe("not-found")
  })

  it("keeps a declined request in history when a new one is made", () => {
    const declined = decide(request(order({ status: "preparing" })).order, "declined", "Customer still wants it").order
    const second = request(declined, "Customer left", "r2", "2026-10-28T03:00:00.000Z").order
    expect(second.voidRequest.requestId).toBe("r2")
    expect(second.voidHistory.r1).toMatchObject({ status: "declined", decisionReason: "Customer still wants it" })
    expect(voidTimeline(second).map((r) => r.requestId)).toEqual(["r2", "r1"])
  })
})

describe("deciding a void", () => {
  const pending = () => request(order({ status: "ready" })).order

  it("approve cancels the order and records who and when", () => {
    const { order: next } = decide(pending(), "approved")
    expect(next.status).toBe("cancelled")
    expect(next.voidRequest).toMatchObject({
      status: "approved", decision: "approved", decidedBy: "a1", decidedByName: "Owner", decidedAt: "2026-10-28T02:10:00.000Z",
    })
    expect(next.total).toBe(160)
    expect(next.items).toEqual(order().items)
  })

  it("decline restores the recorded previous status, not always pending", () => {
    for (const status of ["pending", "preparing", "ready"]) {
      const { order: next } = decide(request(order({ status })).order, "declined", "Customer is waiting")
      expect(next.status).toBe(status)
      expect(next.voidRequest).toMatchObject({ status: "declined", decisionReason: "Customer is waiting", decidedBy: "a1" })
    }
  })

  it("decline requires a reason", () => {
    for (const reason of [undefined, "", "no"]) {
      expect(decide(pending(), "declined", reason).error.code).toBe("invalid-argument")
    }
  })

  it("cannot be decided twice", () => {
    for (const first of ["approved", "declined"]) {
      const done = decide(pending(), first, "Because").order
      expect(decide(done, "approved").error.code).toBe("failed-precondition")
      expect(decide(done, "declined", "Again").error.code).toBe("failed-precondition")
    }
  })

  it("rejects a stale requestId", () => {
    expect(decide(pending(), "approved", undefined, "old").error.code).toBe("failed-precondition")
  })

  it("rejects an order that is no longer pending_void or has no request", () => {
    expect(decide(order(), "approved").error.code).toBe("failed-precondition")
    expect(decide(order({ status: "cancelled", voidRequest: pending().voidRequest }), "approved").error.code).toBe("failed-precondition")
    expect(decide(null, "approved").error.code).toBe("not-found")
  })

  it("rejects an order refunded after the request", () => {
    const refunded = { ...pending(), refundedTotal: 50 }
    expect(decide(refunded, "approved").error.code).toBe("failed-precondition")
  })

  it("rejects an unknown decision", () => {
    expect(decide(pending(), "maybe").error.code).toBe("invalid-argument")
  })

  it("refuses a request whose author is not the order's cashier", () => {
    const forged = pending()
    forged.voidRequest = { ...forged.voidRequest, requestedBy: "someone-else" }
    expect(decide(forged, "approved").error.code).toBe("failed-precondition")
  })
})

describe("client helpers and existing rules", () => {
  it("only offers Request Void on eligible orders", () => {
    expect(canRequestVoid(order({ status: "pending" }))).toBe(true)
    expect(canRequestVoid(order({ status: "completed" }))).toBe(false)
    expect(canRequestVoid(order({ status: "cancelled" }))).toBe(false)
    expect(canRequestVoid(request(order()).order)).toBe(false)
    // A declined order can be requested again.
    expect(canRequestVoid(decide(request(order()).order, "declined", "Not now").order)).toBe(true)
  })

  it("lists pending requests oldest first", () => {
    const a = request(order(), "reason a", "a").order
    const b = applyVoidRequest(order({ displayId: "B" }), { requestId: "b", reason: "reason b", cashier, now: "2026-10-28T01:00:00.000Z" }).order
    expect(pendingVoids([a, b, order()]).map((o) => o.voidRequest.requestId)).toEqual(["b", "a"])
    expect(isPendingVoid(order())).toBe(false)
  })

  it("validates reasons", () => {
    expect(validateReason("")).toBeTruthy()
    expect(validateReason("ok reason")).toBeNull()
    expect(validateReason("x".repeat(301))).toBeTruthy()
  })

  it("orders without void data behave as before", () => {
    expect(pendingVoids([order()])).toEqual([])
    expect(voidTimeline(order())).toEqual([])
  })

  it("blocks refunds while a void is pending, and on cancelled orders", () => {
    const o = { ...request(order({ status: "ready" })).order, id: "o1" }
    expect(() => applyRefund(o, { amount: 10, reason: "test reason" }, { uid: "a1", name: "Owner" })).toThrow(/void request/)
    const cancelled = decide(request(order()).order, "approved").order
    expect(() => applyRefund({ ...cancelled, id: "o1" }, { amount: 10, reason: "test reason" }, { uid: "a1" })).toThrow()
  })

  it("keeps pending_void in sales and drops approved voids from sales totals", () => {
    const base = order({ id: "x" })
    const pendingOrder = { ...request(base).order }
    expect(totalsFor([pendingOrder], [pendingOrder]).orders).toBe(1)
    const approved = decide(request(base).order, "approved").order
    const t = totalsFor([approved], [approved])
    expect(t.orders).toBe(0)
    expect(t.gross).toBe(0)
    expect(t.cancelled).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Transaction wrapper, against an in-memory stand-in for an RTDB reference that
// behaves like the real one: the first pass sees null, and a pass that loses a
// race is retried against the winner's data.
// ---------------------------------------------------------------------------
import { runTransition } from "../../../functions/src/voids.js"

function fakeRef(initial) {
  const ref = {
    value: initial,
    passes: 0,
    // Another writer lands between the first pass and the commit.
    raceWith: null,
    async transaction(update) {
      ref.passes++
      let proposed = update(null) // cold cache
      if (proposed === null) {
        if (ref.raceWith) { ref.value = ref.raceWith(ref.value); ref.raceWith = null }
        proposed = update(structuredClone(ref.value))
      }
      if (proposed === undefined) return { committed: false, snapshot: { exists: () => ref.value != null } }
      ref.value = proposed
      return { committed: true, snapshot: { exists: () => ref.value != null } }
    },
  }
  return ref
}
const mkErr = (code, message) => Object.assign(new Error(message), { code })

describe("runTransition", () => {
  const pendingOrder = () => applyVoidRequest(order({ status: "ready" }), { requestId: "r1", reason: "Wrong order", cashier, now: NOW }).order

  it("writes the new order when the transition succeeds", async () => {
    const ref = fakeRef(order())
    await runTransition(ref, (cur) => applyVoidRequest(cur, { requestId: "r1", reason: "Wrong order", cashier, now: NOW }), mkErr)
    expect(ref.value.status).toBe("pending_void")
  })

  it("throws the validation error and writes nothing", async () => {
    const ref = fakeRef(order({ status: "completed" }))
    await expect(
      runTransition(ref, (cur) => applyVoidRequest(cur, { requestId: "r1", reason: "Wrong order", cashier, now: NOW }), mkErr)
    ).rejects.toMatchObject({ code: "failed-precondition" })
    expect(ref.value.status).toBe("completed")
  })

  it("lets only one of two racing decisions win", async () => {
    const ref = fakeRef(pendingOrder())
    // Someone declines between our first pass and our commit.
    ref.raceWith = (cur) => decide(cur, "declined", "Customer is waiting").order
    await expect(
      runTransition(ref, (cur) => decide(cur, "approved"), mkErr)
    ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringMatching(/already been decided/) })
    expect(ref.value.status).toBe("ready")
    expect(ref.value.voidRequest.status).toBe("declined")
  })

  it("reports a missing order as aborted", async () => {
    const ref = fakeRef(null)
    await expect(runTransition(ref, (cur) => decide(cur, "approved"), mkErr)).rejects.toMatchObject({ code: "aborted" })
  })
})
