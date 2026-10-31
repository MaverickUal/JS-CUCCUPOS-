import { formatDateTime, orderNo, peso } from "@/lib/format"

export const SHOP_NAME = "CuccuPOS"


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

  
  
  const subtotal = typeof order.subtotal === "number" ? order.subtotal : order.total
  const discountAmount = typeof order.discountAmount === "number" ? order.discountAmount : 0

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
  }
}


export function receiptFilename(order, extension = "pdf") {
  const raw = orderNo(order)
  const safe = raw.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "")
  return `receipt-${safe || order.id || "order"}.${extension}`
}


export const receiptMoney = (n) => peso(n)
