import { db, auth } from "@/lib/firebase"
import {
  ref,
  push,
  set,
  get,
  onValue,
  runTransaction,
} from "firebase/database"
import { orderSchema } from "@/lib/schemas"

const ordersRef = ref(db, "orders")

const ok = (message, data) => (data === undefined ? { success: true, message } : { success: true, message, data })
const fail = (message) => ({ success: false, message })
const failWith = (error, fallback) => fail(error?.message || fallback)

const refAt = (path) => ref(db, path)
const profileRef = (uid) => refAt(`users/${uid}`)
const getProfile = (uid) => get(profileRef(uid))

const valToList = (raw) => Object.entries(raw ?? {}).map(([id, value]) => ({ id, ...value }))

const safeSubscribe = (target, handler) => {
  try {
    return onValue(typeof target === "function" ? target() : target, handler)
  } catch (error) {
    console.log(error)
    return () => {}
  }
}

const requireUser = async ({ role, notFound = "User profile not found.", wrongRole, checkDisabled = false } = {}) => {
  const user = auth.currentUser
  if (!user) return { error: fail("Sign in to continue.") }
  const snap = await getProfile(user.uid)
  if (!snap.exists()) return { error: fail(notFound) }
  const profile = snap.val()
  if (role && profile?.role !== role) return { error: fail(wrongRole) }
  if (checkDisabled && profile?.disabled === true) return { error: fail("This account is disabled.") }
  return { user, profile }
}

export const makeDisplayId = () => "ORD-" + Date.now().toString(36).toUpperCase()

export const placeOrder = async (orderData) => {
  try {
    const validation = orderSchema.safeParse(orderData)
    if (!validation.success) return fail(validation.error.issues[0]?.message || "Invalid order data")

    const displayId = makeDisplayId()
    const orderRef = push(refAt(`orders/${validation.data.customerId}`), {
      ...validation.data,
      displayId,
    })

    return ok("Order placed successfully", { id: orderRef.key, displayId, ...validation.data })
  } catch (error) {
    return failWith(error)
  }
}

function flattenOrders(value, depth) {
  if (!value) return []
  if (depth === "flat") return valToList(value)

  return Object.entries(value).flatMap(([customerId, orders]) =>
    Object.entries(orders ?? {}).map(([id, order]) => ({ id, customerId, ...order }))
  )
}

const ordersTarget = (customerId) => (customerId ? refAt(`orders/${customerId}`) : ordersRef)
const flattenFor = (customerId, value) => flattenOrders(value, customerId ? "flat" : "byCustomer")

export const getOrders = (callback, customerId) =>
  safeSubscribe(() => ordersTarget(customerId), (snapshot) => callback(flattenFor(customerId, snapshot.val())))

export const getOrdersOnce = async (customerId) => {
  const snapshot = await get(ordersTarget(customerId))
  return flattenFor(customerId, snapshot.val())
}

async function locateOrder(customerId, orderId) {
  if (customerId) {
    const snap = await get(refAt(`orders/${customerId}/${orderId}`))
    if (snap.exists()) return customerId
  }
  const snap = await get(ordersRef)
  const match = Object.entries(snap.val() ?? {}).find(([, bucket]) => bucket && bucket[orderId])
  return match ? match[0] : null
}

export const updateOrderStatus = async (customerId, id, status) => {
  try {
    const targetCustomer = await locateOrder(customerId, id)
    if (!targetCustomer) return fail("Order not found.")
    await set(refAt(`orders/${targetCustomer}/${id}/status`), status)
    return ok(`Order ${id} status updated to ${status}`)
  } catch (error) {
    return failWith(error)
  }
}

export const requestVoid = async (orderId, reason) => {
  try {
    const { user, error } = await requireUser({
      role: "cashier",
      wrongRole: "Only a cashier can request a void.",
      checkDisabled: true,
    })
    if (error) return error

    const result = await runTransaction(
      refAt(`orders/${user.uid}/${orderId}`),
      (current) => {
        if (!current) return current
        const status = String(current.status ?? "")
        if (status === "pending_void") return { ...current, __abort: true }
        if (!["pending", "preparing", "ready"].includes(status)) return { ...current, __abort: true }
        return {
          ...current,
          status: "pending_void",
          previousStatus: status,
        }
      },
      { applyLocally: false }
    )
    if (!result.committed) return fail("Could not apply void request. Try again.")
    return ok("Void request submitted.", { status: "pending_void", previousStatus: result.snapshot?.val()?.previousStatus })
  } catch (e) {
    return failWith(e, "Could not request void.")
  }
}

export const approveVoid = async (customerId, orderId, decision) => {
  try {
    const { error } = await requireUser({
      role: "admin",
      notFound: "Only an admin can approve/decline voids.",
      wrongRole: "Only an admin can approve/decline voids.",
    })
    if (error) return error

    const result = await runTransaction(
      refAt(`orders/${customerId}/${orderId}`),
      (current) => {
        if (!current) return current
        const status = String(current.status ?? "")
        if (status !== "pending_void") return current
        if (decision === "cancelled") {
          const next = { ...current, status: "cancelled" }
          delete next.previousStatus
          return next
        }
        if (decision === "declined") {
          const prev = String(current.previousStatus ?? status)
          const next = { ...current, status: prev }
          delete next.previousStatus
          return next
        }
        return current
      },
      { applyLocally: false }
    )
    if (!result.committed) return fail("Could not apply decision. Try again.")
    return ok("Void decision applied.", { status: result.snapshot?.val()?.status })
  } catch (e) {
    return failWith(e, "Could not apply decision.")
  }
}
