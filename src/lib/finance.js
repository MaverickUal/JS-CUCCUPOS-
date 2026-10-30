import { validOrders } from "@/lib/stats"
import { round2 as r2 } from "@/lib/format"

export function totalsFor(orders, scoped) {
  const sales = validOrders(scoped)
  const gross = r2(sales.reduce((s, o) => s + Number(o.total ?? 0), 0))
  const discountGiven = r2(
    sales.reduce((s, o) => s + Number(o.discountAmount ?? 0), 0)
  )
  return {
    gross,
    refunds: 0,
    net: gross,
    orders: sales.length,
    itemsSold: sales.reduce((s, o) => s + Object.values(o.items).reduce((n, i) => n + i.qty, 0), 0),
    cancelled: orders.length - sales.length,
    avgOrder: sales.length ? r2(gross / sales.length) : 0,
    discountGiven,
    cashCollected: r2(sales.reduce((s, o) => s + (o.cashTendered ?? o.total), 0)),
    changeGiven: r2(sales.reduce((s, o) => s + (o.changeGiven ?? 0), 0)),
  }
}
