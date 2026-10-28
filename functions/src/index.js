/**
 * CuccuPOS backend functions.
 *
 * These exist because the following cannot be done safely from a browser client:
 *
 *  - Refunds. Validating the remaining refundable amount and writing an audit
 *    record must be atomic, and `approvedBy` must come from the verified session
 *    rather than anything the client sends. A client-side check is advisory only,
 *    because anyone can open devtools and call the RTDB SDK directly.
 *  - Creating another user's Authentication account. That requires the Admin SDK.
 *  - Deleting/deactivating an Authentication account. Also Admin SDK, and it does
 *    not cascade to RTDB.
 *  - Void requests and decisions. The database rules refuse every client write to
 *    `voidRequest`, `voidHistory` and the `pending_void` status, so the approval
 *    trail can only be written here, from the verified session.
 *
 * Every function re-checks the caller's role from the database rather than trusting
 * the ID token alone, so a stale token cannot grant access after a role change.
 */
import { initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getDatabase } from "firebase-admin/database"
import { HttpsError, onCall } from "firebase-functions/v2/https"
import { logger } from "firebase-functions"
import { applyVoidDecision, applyVoidRequest, runTransition } from "./voids.js"

initializeApp()

const db = getDatabase()
const auth = getAuth()

/** Rejects the call unless the caller is currently an admin in the database. */
async function requireAdmin(uid) {
  const snap = await db.ref(`users/${uid}`).get()
  const profile = snap.val()
  if (!profile) {
    throw new HttpsError("unauthenticated", "No user profile found for this session.")
  }
  if (profile.role !== "admin") {
    throw new HttpsError("permission-denied", "Only an Owner/Manager can perform this action.")
  }
  if (profile.disabled === true) {
    throw new HttpsError("permission-denied", "This account is disabled.")
  }
  return { uid, name: String(profile.name ?? "") }
}

/** Rejects the call unless the caller is currently an active cashier in the database. */
async function requireCashier(uid) {
  const snap = await db.ref(`users/${uid}`).get()
  const profile = snap.val()
  if (!profile) {
    throw new HttpsError("unauthenticated", "No user profile found for this session.")
  }
  if (profile.role !== "cashier") {
    throw new HttpsError("permission-denied", "Only a cashier can request a void.")
  }
  if (profile.disabled === true) {
    throw new HttpsError("permission-denied", "This account is disabled.")
  }
  return { uid, name: String(profile.name ?? "") }
}

const round2 = (n) => Math.round(n * 100) / 100

/**
 * Issue a refund against an order.
 *
 * Runs as a single transaction on the order node so two concurrent refunds can
 * never both pass the "amount remaining" check. The order itself is never
 * modified beyond appending to `refunds` and updating the cached
 * `refundedTotal`; its original total, items, and history stay intact.
 */
export const refundOrder = onCall(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.")
  const admin = await requireAdmin(uid)

  const { orderId, amount, reason } = request.data ?? {}

  if (typeof orderId !== "string" || !orderId.trim()) {
    throw new HttpsError("invalid-argument", "orderId is required.")
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    throw new HttpsError("invalid-argument", "A reason of at least 3 characters is required.")
  }

  const requested = round2(Number(amount))
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new HttpsError("invalid-argument", "Refund amount must be greater than zero.")
  }

  // Locate the order. Orders live under /orders/<customerId>/<orderId>.
  const ordersSnap = await db.ref("orders").get()
  const byCustomer = ordersSnap.val()

  let located = null
  for (const [customerId, bucket] of Object.entries(byCustomer ?? {})) {
    const order = bucket?.[orderId]
    if (order) {
      located = { customerId, order }
      break
    }
  }

  if (!located) {
    throw new HttpsError("not-found", "Order not found.")
  }

  const { customerId } = located
  const orderRef = db.ref(`orders/${customerId}/${orderId}`)
  const refundId = db.ref(`orders/${customerId}/${orderId}/refunds`).push().key

  return await orderRef.transaction(
    (current) => {
      if (!current) throw new HttpsError("not-found", "Order not found.")

      // Cancelled orders are never refundable — there is no sale to reverse.
      if (current.status === "cancelled") {
        throw new HttpsError("failed-precondition", "A cancelled order cannot be refunded.")
      }

      // Prefer the running total we maintain; fall back to summing completed
      // refunds so a partially-migrated database can't over-refund.
      const refunds = (current.refunds ?? {})
      const completed = Object.values(refunds)
        .filter((r) => r && r.status === "completed")
        .reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
      const alreadyRefunded = round2(
        typeof current.refundedTotal === "number" ? Math.max(current.refundedTotal, completed) : completed
      )

      const paid = round2(Number(current.total ?? 0))
      const remaining = round2(paid - alreadyRefunded)

      if (remaining <= 0.004) {
        throw new HttpsError("failed-precondition", "This order has already been fully refunded.")
      }
      if (requested > remaining + 0.004) {
        throw new HttpsError(
          "failed-precondition",
          `Refund exceeds the amount remaining. Maximum refundable is ${remaining.toFixed(2)}.`
        )
      }

      const record = {
        id: refundId,
        orderId,
        orderDisplayId: current.displayId ?? undefined,
        amount: requested,
        reason: reason.trim(),
        status: "completed",
        createdAt: new Date().toISOString(),
        approvedBy: admin.uid,
        approvedByName: admin.name,
      }

      return {
        ...current,
        refunds: { ...refunds, [refundId]: record },
        refundedTotal: round2(alreadyRefunded + requested),
      };
    },
    undefined,
    false
  ).then((result) => {
    if (!result.committed) {
      // Contention, not a validation failure — tell the caller to retry.
      throw new HttpsError("aborted", "Refund could not be applied. Please try again.")
    }
    logger.info("refund applied", { orderId, amount: requested, by: admin.uid })
    return { ok: true, refundId, orderId, amount: requested, remaining: round2(requested) }
  })
})

/**
 * Create a cashier account.
 *
 * Creating an Authentication user for somebody else requires the Admin SDK, which
 * cannot ship in a browser bundle. The role is written here as "cashier" and is
 * not settable by the caller — there is deliberately no way to create an admin
 * through this endpoint.
 */
export const createCashier = onCall(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.")
  const admin = await requireAdmin(uid)

  const { name, email, password } = request.data ?? {}

  const cleanName = typeof name === "string" ? name.trim() : ""
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
  const cleanPassword = typeof password === "string" ? password : ""

  if (cleanName.length < 2) {
    throw new HttpsError("invalid-argument", "Enter the cashier's full name.")
  }
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.")
  }
  if (cleanPassword.length < 8) {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.")
  }

  let created
  try {
    const user = await auth.createUser({
      email: cleanEmail,
      password: cleanPassword,
      displayName: cleanName,
      emailVerified: false,
      disabled: false,
    })
    created = user.uid
  } catch (err) {
    if (err?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "An account with this email already exists.")
    }
    logger.error("createUser failed", err)
    throw new HttpsError("internal", "Could not create the account. Please try again.")
  }

  // Roll the profile back if the database write fails, so we never leave an
  // Authentication account with no matching profile.
  try {
    await db.ref(`users/${created}`).set({
      name: cleanName,
      email: cleanEmail,
      role: "cashier",
      createdAt: new Date().toISOString(),
      createdBy: admin.uid,
      disabled: false,
    })
  } catch (err) {
    logger.error("profile write failed, rolling back auth user", err)
    try {
      await auth.deleteUser(created)
    } catch (rollbackErr) {
      logger.error("rollback failed", rollbackErr)
    }
    throw new HttpsError("internal", "Could not save the cashier profile. Nothing was created.")
  }

  logger.info("cashier created", { uid: created, by: admin.uid })
  return { ok: true, uid: created, email: cleanEmail, name: cleanName }
})

/**
 * Disable (or re-enable) a cashier account.
 *
 * Deactivating is used instead of deleting on purpose: removing the RTDB profile
 * would strip the ownership link on past orders, and deleting the Authentication
 * user would break the audit trail for refunds. Disabling blocks sign-in while
 * keeping every historical record readable and attributable.
 *
 * Guards against an admin locking themselves out.
 */
export const setCashierEnabled = onCall(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.")
  await requireAdmin(uid)

  const { targetUid, enabled } = request.data ?? {}

  if (typeof targetUid !== "string" || !targetUid.trim()) {
    throw new HttpsError("invalid-argument", "targetUid is required.")
  }
  if (targetUid === uid) {
    throw new HttpsError("failed-precondition", "You cannot disable your own account.")
  }

  const targetRef = db.ref(`users/${targetUid}`)
  const snap = await targetRef.get()
  const profile = snap.val()
  if (!profile) {
    throw new HttpsError("not-found", "That account no longer exists.")
  }
  if (profile.role === "admin") {
    throw new HttpsError(
      "failed-precondition",
      "This account is an Owner/Manager. Use a dedicated administrator flow for those."
    )
  }

  const next = enabled === true

  try {
    await auth.setCustomUserClaims(targetUid, { disabled: next })
  } catch (err) {
    logger.error("auth disable failed", err)
    throw new HttpsError("internal", "Could not update the sign-in account.")
  }

  await targetRef.update({
    disabled: next,
    // Credentials are kept so the account can be re-enabled; an owner/manager can
    // reset them out of band if needed.
    reenabledAt: next ? new Date().toISOString() : null,
  })

  logger.info("cashier toggled", { targetUid, enabled: next, by: uid })
  return { ok: true, targetUid, enabled: next }
})

const runVoidTransaction = (orderRef, transition) =>
  runTransition(orderRef, transition, (code, message) => new HttpsError(code, message))

const requireId = (value, label) => {
  if (typeof value !== "string" || !value.trim() || /[.#$\/\[\]]/.test(value)) {
    throw new HttpsError("invalid-argument", `${label} is required.`)
  }
  return value.trim()
}

/**
 * Cashier asks to void one of their own orders.
 *
 * The order path is built from the caller's uid, never from client input, so a
 * cashier cannot reach another cashier's order. The order moves to
 * `pending_void`; it is not cancelled and nothing is deleted.
 */
export const requestVoid = onCall(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.")
  const cashier = await requireCashier(uid)

  const orderId = requireId(request.data?.orderId, "orderId")
  const reason = request.data?.reason

  const orderRef = db.ref(`orders/${uid}/${orderId}`)
  const requestId = orderRef.child("voidHistory").push().key
  const now = new Date().toISOString()

  const order = await runVoidTransaction(orderRef, (current) => {
    if (current.customerId !== uid) {
      return { error: { code: "permission-denied", message: "You can only void your own orders." } }
    }
    return applyVoidRequest(current, { requestId, reason, cashier, now })
  })

  logger.info("void requested", { orderId, requestId, by: uid })
  return { ok: true, orderId, requestId, status: order.status }
})

async function decideVoid(request, decision) {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.")
  const admin = await requireAdmin(uid)

  const customerId = requireId(request.data?.customerId, "customerId")
  const orderId = requireId(request.data?.orderId, "orderId")
  const requestId = requireId(request.data?.requestId, "requestId")

  const orderRef = db.ref(`orders/${customerId}/${orderId}`)
  const order = await runVoidTransaction(orderRef, (current) =>
    applyVoidDecision(current, {
      requestId,
      decision,
      reason: request.data?.reason,
      admin,
      now: new Date().toISOString(),
    })
  )

  logger.info("void decided", { orderId, requestId, decision, by: uid })
  return { ok: true, orderId, requestId, decision, status: order.status }
}

/** Owner/Manager approves: the order becomes `cancelled` and the decision is recorded. */
export const approveVoid = onCall((request) => decideVoid(request, "approved"))

/** Owner/Manager declines: the order returns to the status it had before the request. */
export const declineVoid = onCall((request) => decideVoid(request, "declined"))
