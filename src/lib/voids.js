/**
 * Client-side helpers for the simplified void workflow.
 * Only status helpers remain; the authoritative transaction is in src/lib/actions.js.
 */
export const VOIDABLE_STATUSES = ["pending", "preparing", "ready"]
export const MIN_REASON = 3
export const MAX_REASON = 300

export const isPendingVoid = (o) => o.status === "pending_void"
export const canRequestVoid = (o) => VOIDABLE_STATUSES.includes(o?.status) && !isPendingVoid(o)

export function voidBlockedReason(order) {
  if (!order) return "Order not found."
  if (isPendingVoid(order)) return "A void request is already pending."
  if (order.status === "cancelled") return "This order is already cancelled."
  if (!VOIDABLE_STATUSES.includes(order.status)) return "Only pending, preparing or ready orders can be voided."
  if (Number(order.refundedTotal ?? 0) > 0 || Object.keys(order.refunds ?? {}).length > 0) return "An order with a refund cannot be voided."
  return null
}
