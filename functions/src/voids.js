/**
 * Pure state transitions for the void request workflow.
 *
 * These take the current order record and return the next one, or a
 * `{ error: { code, message } }` object. They never touch the database, so the
 * Cloud Functions run them inside a transaction and the unit tests run them
 * directly.
 *
 * Order status and void request status are kept apart on purpose:
 *   order.status             operational state (pending ... cancelled, pending_void)
 *   order.voidRequest.status approval state (pending | approved | declined)
 */

/** Statuses a cashier may ask to void. Completed orders go through refunds instead. */
export const VOIDABLE_STATUSES = ["pending", "preparing", "ready"]

export const MIN_REASON = 3
export const MAX_REASON = 300

const fail = (code, message) => ({ error: { code, message } })

/** Trim a reason and check its length. Returns the clean text or null. */
export function cleanReason(value) {
  if (typeof value !== "string") return null
  const text = value.trim()
  return text.length >= MIN_REASON && text.length <= MAX_REASON ? text : null
}

const hasRefunds = (order) =>
  Number(order.refundedTotal ?? 0) > 0 || Object.keys(order.refunds ?? {}).length > 0

/**
 * Cashier asks for a void. The order moves to `pending_void` and remembers the
 * status it came from. A previous request (declined, necessarily) is moved into
 * `voidHistory` so no audit record is ever overwritten.
 */
export function applyVoidRequest(order, { requestId, reason, cashier, now }) {
  if (!order) return fail("not-found", "Order not found.")
  const clean = cleanReason(reason)
  if (!clean) {
    return fail("invalid-argument", `A reason of ${MIN_REASON}-${MAX_REASON} characters is required.`)
  }
  if (order.status === "pending_void" || order.voidRequest?.status === "pending") {
    return fail("failed-precondition", "A void request is already pending for this order.")
  }
  if (order.status === "cancelled") {
    return fail("failed-precondition", "This order is already cancelled.")
  }
  if (!VOIDABLE_STATUSES.includes(order.status)) {
    return fail(
      "failed-precondition",
      "Only pending, preparing or ready orders can be voided. Ask the Owner/Manager to refund a completed order."
    )
  }
  if (hasRefunds(order)) {
    return fail("failed-precondition", "An order with a refund cannot be voided.")
  }

  const next = {
    ...order,
    status: "pending_void",
    voidRequest: {
      requestId,
      status: "pending",
      reason: clean,
      requestedBy: cashier.uid,
      requestedByName: cashier.name,
      requestedAt: now,
      previousOrderStatus: order.status,
    },
  }

  if (order.voidRequest) {
    next.voidHistory = {
      ...(order.voidHistory ?? {}),
      [order.voidRequest.requestId]: order.voidRequest,
    }
  }
  return { order: next }
}

/**
 * Owner/Manager decides a pending request.
 *
 * `requestId` must match the request currently on the order, so a decision made
 * from a stale screen cannot land on a newer request.
 */
export function applyVoidDecision(order, { requestId, decision, reason, admin, now }) {
  if (!order) return fail("not-found", "Order not found.")
  if (decision !== "approved" && decision !== "declined") {
    return fail("invalid-argument", "Decision must be approved or declined.")
  }
  const req = order.voidRequest
  if (!req) return fail("failed-precondition", "This order has no void request.")
  if (req.requestId !== requestId) {
    return fail("failed-precondition", "This request is out of date. Refresh and try again.")
  }
  if (req.status !== "pending" || order.status !== "pending_void") {
    return fail("failed-precondition", "This void request has already been decided.")
  }
  if (req.requestedBy !== order.customerId) {
    return fail("failed-precondition", "This void request does not belong to the order's cashier.")
  }
  if (hasRefunds(order)) {
    return fail("failed-precondition", "A refund was recorded on this order. Decline the void instead.")
  }

  let decisionReason
  if (decision === "declined") {
    decisionReason = cleanReason(reason)
    if (!decisionReason) {
      return fail("invalid-argument", `A decline reason of ${MIN_REASON}-${MAX_REASON} characters is required.`)
    }
    if (!VOIDABLE_STATUSES.includes(req.previousOrderStatus)) {
      return fail("failed-precondition", "The recorded previous status is not valid; cannot restore the order.")
    }
  } else {
    // Approval needs no reason, but one is kept if the manager typed it.
    decisionReason = cleanReason(reason) ?? undefined
  }

  const decided = {
    ...req,
    status: decision,
    decision,
    decidedBy: admin.uid,
    decidedByName: admin.name,
    decidedAt: now,
  }
  if (decisionReason) decided.decisionReason = decisionReason

  return {
    order: {
      ...order,
      status: decision === "approved" ? "cancelled" : req.previousOrderStatus,
      voidRequest: decided,
    },
  }
}

/**
 * Run a transition on one order inside an RTDB transaction.
 *
 * `transition` receives the current order and returns `{ order }` or
 * `{ error }`. A validation failure aborts the transaction (returning
 * undefined) and is thrown to the caller as `makeError(code, message)`, so
 * nothing is written. Two simultaneous calls cannot both pass the "still
 * pending" check: the loser is retried against the winner's result and fails
 * validation. Returns the order that was written.
 */
export async function runTransition(orderRef, transition, makeError) {
  let failure = null
  let applied = null
  const result = await orderRef.transaction(
    (current) => {
      // The first pass often sees null before the real value is loaded; handing
      // it back makes the SDK retry with the server's data.
      if (current === null) return current
      const out = transition(current)
      if (out.error) {
        failure = out.error
        return undefined
      }
      failure = null
      applied = out.order
      return out.order
    },
    undefined,
    false
  )
  if (failure) throw makeError(failure.code, failure.message)
  if (!result.committed || !result.snapshot.exists()) {
    throw makeError("aborted", "The order changed or no longer exists. Please try again.")
  }
  return applied
}
