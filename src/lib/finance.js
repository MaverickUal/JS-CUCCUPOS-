import { validOrders } from "@/lib/stats"
import { round2 as r2 } from "@/lib/format"
import { refundedOf, remainingRefundable } from "@/lib/refunds"

// Refund arithmetic lives in refunds.js; re-exported so existing imports keep working.
export { refundedOf, remainingRefundable }

export function totalsFor(orders, scoped) {
  const sales = validOrders(scoped)
  const gross = r2(sales.reduce((s, o) => s + Number(o.total ?? 0), 0))
  const refunds = r2(sales.reduce((s, o) => s + refundedOf(o), 0))
  const discountGiven = r2(
    sales.reduce((s, o) => s + Number(o.discountAmount ?? 0), 0)
  )
  return {
    gross,
    refunds,
    net: r2(gross - refunds),
    orders: sales.length,
    itemsSold: sales.reduce((s, o) => s + Object.values(o.items).reduce((n, i) => n + i.qty, 0), 0),
    cancelled: orders.length - sales.length,
    avgOrder: sales.length ? r2(gross / sales.length) : 0,
    discountGiven,
    cashCollected: r2(sales.reduce((s, o) => s + (o.cashTendered ?? o.total), 0)),
    changeGiven: r2(sales.reduce((s, o) => s + (o.changeGiven ?? 0), 0)),
  }
}

/** Flattened refund history for an audit view, newest first. */
export function refundRows(orders) {
  const rows = []
  for (const o of orders) {
    for (const r of Object.values(o.refunds ?? {})) {
      if (!r || r.status !== "completed") continue
      rows.push({
        id: r.id,
        orderId: o.id,
        orderDisplayId: o.displayId,
        cashierName: o.customerName,
        amount: Number(r.amount ?? 0),
        reason: r.reason,
        createdAt: r.createdAt,
        approvedBy: r.approvedBy,
        approvedByName: r.approvedByName,
      })
    }
  }
  return rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}