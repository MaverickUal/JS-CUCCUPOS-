import { refundedOf, remainingRefundable } from "@/lib/finance"
import { formatDateTime, orderNo, peso } from "@/lib/format"

export const SHOP_NAME = "CuccuPOS"

/** Human label for a discount type; "none" collapses to no line at all. */
export function discountLabel(type) {
  switch (type) {
    case "pwd":
      return "PWD discount"
    case "senior":
      return "Senior Citizen discount"
    default:
      return "Discount"
  }
}

export function buildReceipt(order) {
  const items = Object.values(order.items ?? {}).filter(Boolean).filter((i) => Number(i.qty ?? 0) > 0)
  const lines = items.map((i) => ({
    name: i.name,
    qty: Number(i.qty ?? 0),
    unitPrice: Number(i.price ?? 0),
    lineTotal: Number((Number(i.price ?? 0) * Number(i.qty ?? 0)).toFixed(2)),
  }))

  // Orders predating the discount feature have no subtotal/discount fields. Their
  // subtotal is just the total, and no discount line is shown.
  const subtotal = typeof order.subtotal === "number" ? order.subtotal : order.total
  const discountAmount = typeof order.discountAmount === "number" ? order.discountAmount : 0
  const refundedTotal = refundedOf(order)

  const refunds = Object.values(order.refunds ?? {})
    .filter((r) => r?.status === "completed")
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      amount: Number(r.amount ?? 0),
      reason: r.reason,
      approvedByName: r.approvedByName,
    }))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  return {
    shopName: SHOP_NAME,
    heading: "Transaction Receipt",
    orderNumber: orderNo(order),
    dateTimeText: formatDateTime(order.createdAt),
    createdAt: order.createdAt,
    cashierName: order.customerName || "Unknown",
    status: order.status === "pending_void" ? "Pending Void" : order.status,
    lines,
    subtotal,
    discountLabel: discountLabel(order.discountType),
    discountAmount,
    total: order.total,
    paymentMethod: order.paymentMethod,
    cashTendered: order.cashTendered,
    changeGiven: order.changeGiven,
    refunds,
    refundedTotal,
    remainingRefundable: remainingRefundable(order),
  }
}

/**
 * Download filename for the PDF. Built from the friendly order number so a cashier
 * filing receipts can find them, and stripped of anything a filesystem or a browser
 * download would object to (path separators, control characters, etc).
 */
export function receiptFilename(order, extension = "pdf") {
  const raw = orderNo(order)
  const safe = raw.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "")
  return `receipt-${safe || order.id || "order"}.${extension}`
}

/** Formats a peso amount for the narrow receipt layout. Reuses the shared formatter. */
export const receiptMoney = (n) => peso(n)