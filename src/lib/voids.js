/**
 * Client-side helpers for the void workflow.
 *
 * Everything here is for display and for disabling buttons early. The
 * authoritative checks run in the Cloud Functions (functions/src/voids.js) and
 * the database rules, so a tampered client gains nothing from skipping these.
 */

/** Statuses a cashier may ask to void. Mirrors VOIDABLE_STATUSES in functions/src/voids.js. */
export const VOIDABLE_STATUSES = ["pending", "preparing", "ready"]

export const MIN_REASON = 3
export const MAX_REASON = 300

const hasRefunds = (o) => Number(o.refundedTotal ?? 0) > 0 || Object.keys(o.refunds ?? {}).length > 0

export const isPendingVoid = (o) => o.status === "pending_void" && o.voidRequest?.status === "pending"

/** Why this order cannot be voided right now, or null if it can. */
export function voidBlockedReason(order) {
  if (isPendingVoid(order)) return "A void request is already pending."
  if (order.status === "cancelled") return "This order is already cancelled."
  if (!VOIDABLE_STATUSES.includes(order.status)) return "Completed orders are handled through refunds."
  if (hasRefunds(order)) return "An order with a refund cannot be voided."
  return null
}

export const canRequestVoid = (order) => voidBlockedReason(order) === null

export function validateReason(value) {
  const text = String(value ?? "").trim()
  if (text.length < MIN_REASON) return `Enter a reason of at least ${MIN_REASON} characters.`
  if (text.length > MAX_REASON) return `Keep the reason under ${MAX_REASON} characters.`
  return null
}

/** Orders waiting on an Owner/Manager decision, oldest request first. */
export function pendingVoids(orders) {
  return orders
    .filter(isPendingVoid)
    .sort((a, b) => Date.parse(a.voidRequest.requestedAt) - Date.parse(b.voidRequest.requestedAt))
}

/** Every request on an order, newest first: earlier attempts plus the current one. */
export function voidTimeline(order) {
  const all = [...Object.values(order.voidHistory ?? {}), ...(order.voidRequest ? [order.voidRequest] : [])]
  return all.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
}

export const VOID_STATUS_LABEL = { pending: "Pending", approved: "Approved", declined: "Declined" }
