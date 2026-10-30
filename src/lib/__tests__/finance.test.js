import { describe, expect, it } from "vitest"
import { totalsFor } from "@/lib/finance"

const mkOrder = (extra = {}) =>
  ({
    id: "o1",
    displayId: "ORD-1",
    customerId: "u1",
    customerName: "Juan",
    items: { m_1: { menuItemId: "m_1", name: "Latte", price: 100, qty: 1, category: "Coffee" } },
    total: 100,
    paymentMethod: "Cash",
    status: "completed",
    createdAt: "2026-03-08T10:00:00.000Z",
    ...extra,
  })

describe("totalsFor", () => {
  const orders = [
    mkOrder({ id: "a", total: 100 }),
    mkOrder({ id: "b", total: 200 }),
    mkOrder({ id: "c", total: 999, status: "cancelled" }),
  ]

  it("excludes cancelled orders from every figure", () => {
    const t = totalsFor(orders, orders)
    expect(t.orders).toBe(2)
    expect(t.gross).toBe(300)
    expect(t.cancelled).toBe(1)
  })

  it("derives net from gross (no refunds)", () => {
    const t = totalsFor(orders, orders)
    expect(t.gross).toBe(300)
    expect(t.refunds).toBe(0)
    expect(t.net).toBe(300)
  })

  it("does not double-count a discount as a second deduction", () => {
    const o = mkOrder({ subtotal: 265, discountAmount: 53, total: 212 })
    const t = totalsFor([o], [o])
    expect(t.gross).toBe(212)
    expect(t.discountGiven).toBe(53)
    expect(t.net).toBe(212)
  })

  it("reports zero for an empty set without dividing by zero", () => {
    const t = totalsFor([], [])
    expect(t.gross).toBe(0)
    expect(t.net).toBe(0)
    expect(t.avgOrder).toBe(0)
  })

  it("averages over valid orders only", () => {
    const t = totalsFor(orders, orders)
    expect(t.avgOrder).toBe(150)
  })

  it("sums items sold", () => {
    const t = totalsFor(orders, orders)
    expect(t.itemsSold).toBe(2)
  })

  it("reconciles the drawer from tender and change", () => {
    const t = totalsFor(orders, orders)
    expect(t.cashCollected).toBe(300)
    expect(t.changeGiven).toBe(0)
  })
})
