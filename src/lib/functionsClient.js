/**
 * Client wrappers for the backend functions in `functions/src/index.js`.
 *
 * These are callable HTTPS endpoints, so they go through Firebase Functions rather
 * than the RTDB SDK. Anything privileged — refunds, creating another user's
 * account, disabling an account — lives here and nowhere else.
 *
 * IMPORTANT: these calls fail until the functions are deployed
 * (`firebase deploy --only functions`). Each wrapper surfaces that clearly rather
 * than pretending the operation succeeded. `functionsDeployed()` lets the UI show
 * an honest "not available yet" state instead of a button that silently does
 * nothing.
 */
import { getFunctions, httpsCallable, FunctionsError } from "firebase/functions"
import { getApp } from "firebase/app"
const functions = () => getFunctions(getApp())

const DEPLOY_HINT = "This action needs the backend functions deployed. Run: firebase deploy --only functions"

/**
 * Turn a Functions error into a message safe to show a user.
 *
 * When the functions are not deployed the callable endpoint answers with
 * `internal` and an unhelpful message like "internal [0]". That is detected here
 * so the UI says the real cause instead of leaking a transport error — and, more
 * importantly, so nothing is reported as succeeding.
 */
export function describeFunctionError(err) {
  if (err instanceof FunctionsError) {
    if (err.code === "functions/not-found" || err.code === "functions/unimplemented") {
      return DEPLOY_HINT
    }
    // `internal` with an opaque message means the endpoint itself could not be
    // invoked — almost always because it isn't deployed.
    if (err.code === "functions/internal" && /internal \[\d+\]/i.test(err.message)) {
      return DEPLOY_HINT
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return "Something went wrong. Please try again."
}

/**
 * Whether the callable endpoints are reachable.
 *
 * Returns false when the project has no functions region configured or the SDK
 * cannot build a callable reference. Callers use it to disable buttons up front;
 * `describeFunctionError` is still the authority, since a reachable client can
 * still hit an undeployed endpoint.
 */
export function functionsReachable() {
  try {
    functions()
    return true
  } catch {
    return false
  }
}

export async function requestRefund(
  orderId,
  amount,
  reason
) {
  try {
    const call = httpsCallable(
      functions(),
      "refundOrder"
    )
    const res = await call({ orderId, amount, reason })
    return { ok: true, data: res.data }
  } catch (err) {
    return { ok: false, error: describeFunctionError(err) }
  }
}

export async function createCashier(input) {
  try {
    const call = httpsCallable(functions(), "createCashier")
    const res = await call(input)
    return { ok: true, data: res.data }
  } catch (err) {
    return { ok: false, error: describeFunctionError(err) }
  }
}

export async function setCashierEnabled(
  targetUid,
  enabled
) {
  try {
    const call = httpsCallable(functions(), "setCashierEnabled")
    const res = await call({ targetUid, enabled })
    return { ok: true, data: res.data }
  } catch (err) {
    return { ok: false, error: describeFunctionError(err) }
  }
}

/** Roles the client is allowed to request. Admins are deliberately not creatable here. */
export const CREATABLE_ROLES = ["cashier"]