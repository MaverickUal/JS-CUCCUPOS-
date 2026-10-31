
export const VOIDABLE_STATUSES = ["pending", "preparing", "ready"]
export const MIN_REASON = 3
export const MAX_REASON = 300

export const isPendingVoid = (o) => o.status === "pending_void"
export const canRequestVoid = (o) => VOIDABLE_STATUSES.includes(o?.status) && !isPendingVoid(o)

export function validateReason(value) {
  const text = String(value ?? "").trim()
  if (text.length < MIN_REASON) return `Enter a reason of at least ${MIN_REASON} characters.`
  if (text.length > MAX_REASON) return `Keep the reason under ${MAX_REASON} characters.`
  return null
}

export function voidBlockedReason(order) {
  if (!order) return "Order not found."
  if (isPendingVoid(order)) return "A void request is already pending."
  if (order.status === "cancelled") return "This order is already cancelled."
  if (!VOIDABLE_STATUSES.includes(order.status)) return "Only pending, preparing or ready orders can be voided."
  if (Number(order.refundedTotal ?? 0) > 0 || Object.keys(order.refunds ?? {}).length > 0) return "An order with a refund cannot be voided."
  return null
}
