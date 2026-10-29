/**
 * Firebase RTDB CRUD Operations
 * All database interactions go through these functions.
 * Follows the format: { success, message, data } for mutations.
 */
import { initializeApp } from "firebase/app"
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
  runTransaction,
} from "firebase/database"
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"
import { z } from "zod"
import { computeDiscount } from "@/lib/discounts"
import { findConflictingMenuItems } from "@/lib/duplicates"
import { applyRefund } from "@/lib/refunds"

// ---------------------------------------------------------------------------
// Firebase initialization
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)
const auth = getAuth(app)

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------
const menuRef = ref(database, "menu")
const ordersRef = ref(database, "orders")
const usersRef = ref(database, "users")

/**
 * Build a human-readable order number without a counter node.
 * A counter would require read+write access to /counters/orders for every customer,
 * which security rules cannot safely grant. Timestamps give unique, sortable IDs instead.
 */
export const makeDisplayId = () => "ORD-" + Date.now().toString(36).toUpperCase()

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------
const ok = (message, data) => (data === undefined ? { success: true, message } : { success: true, message, data })
const fail = (message) => ({ success: false, message })
const failWith = (error, fallback) => fail(error?.message || fallback)

const refAt = (path) => ref(database, path)
const profileRef = (uid) => refAt(`users/${uid}`)
const getProfile = (uid) => get(profileRef(uid))

/** Snapshot value ({ id: record }) -> [{ id, ...record }]. */
const valToList = (raw) => Object.entries(raw ?? {}).map(([id, value]) => ({ id, ...value }))

/** Same, but via snapshot.forEach (keeps the server's child ordering). */
const snapshotToList = (snapshot) => {
  const list = []
  snapshot.forEach((snap) => {
    list.push({ id: snap.key, ...snap.val() })
  })
  return list
}

/** Subscribe with onValue (target may be a ref or a function returning one); a no-op unsubscribe if setup throws. */
const safeSubscribe = (target, handler) => {
  try {
    return onValue(typeof target === "function" ? target() : target, handler)
  } catch (error) {
    console.log(error)
    return () => {}
  }
}

/**
 * Check the signed-in user. Resolves to { user, profile } or { error } where
 * `error` is a ready-to-return failure result.
 */
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

// ---------------------------------------------------------------------------
// Zod validation schemas
// Discounts and refunds are validated against the same maths the UI shows, so a
// tampered client cannot persist numbers the calculator would never produce.
// ---------------------------------------------------------------------------

export const orderSchema = z
  .object({
    customerId: z.string().min(1, "Customer ID is required"),
    customerName: z.string().min(1, "Customer name is required"),
    items: z.record(
      z.string(),
      z.object({
        menuItemId: z.string(),
        name: z.string(),
        price: z.number().nonnegative(),
        qty: z.number().min(1).max(99),
        category: z.string(),
      })
    ),
    subtotal: z.number().nonnegative().optional(),
    discountType: z.enum(["none", "pwd", "senior"]).optional(),
    discountAmount: z.number().nonnegative().optional(),
    total: z.number().positive("Total must be positive"),
    paymentMethod: z.literal("Cash"),
    cashTendered: z.number().nonnegative("Cash tendered cannot be negative").optional(),
    changeGiven: z.number().nonnegative("Change cannot be negative").optional(),
    // New orders must start pending; the database rules require this too, so a
    // client cannot create an order that is already completed or cancelled.
    status: z.literal("pending"),
    createdAt: z.string(),
    note: z.string().nullable().optional(),
  })
  .superRefine((o, ctx) => {
    // Recompute the money. Anything that doesn't match is rejected outright.
    const lines = Object.values(o.items)
    const expected = computeDiscount(
      lines.map((l) => ({ category: l.category, qty: l.qty, price: l.price })),
      o.discountType ?? "none"
    )
    const r2 = (n) => Math.round(n * 100) / 100

    if (o.subtotal !== undefined && r2(o.subtotal) !== r2(expected.subtotal)) {
      ctx.addIssue({ code: "custom", message: "Subtotal does not match the line items.", path: ["subtotal"] })
    }
    if (o.total !== r2(expected.total)) {
      ctx.addIssue({ code: "custom", message: "Total does not match the discount calculation.", path: ["total"] })
    }
    const statedDiscount = o.discountAmount ?? 0
    if (r2(statedDiscount) !== r2(expected.amount)) {
      ctx.addIssue({ code: "custom", message: "Discount amount is not valid.", path: ["discountAmount"] })
    }
    if (o.cashTendered !== undefined && o.cashTendered + 0.004 < expected.total) {
      ctx.addIssue({ code: "custom", message: "Cash tendered does not cover the total.", path: ["cashTendered"] })
    }
    if (o.changeGiven !== undefined) {
      const expectedChange = r2((o.cashTendered ?? 0) - expected.total)
      if (r2(o.changeGiven) !== expectedChange) {
        ctx.addIssue({ code: "custom", message: "Change does not match the tender.", path: ["changeGiven"] })
      }
    }
  })

export const menuItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().positive("Price must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  category: z.enum(["Coffee", "Milk Tea", "Frappe", "Others"]),
  tag: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  available: z.boolean(),
})

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain a capital letter")
    .regex(/[a-z]/, "Must contain a small letter")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character")
    .regex(/[0-9]/, "Must contain a number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

// ===========================================================================
// MENU CRUD
// ===========================================================================

/**
 * Add a new menu item (push)
 *
 * Duplicate names are refused here, at the data-access layer, rather than only in the
 * form: a second caller cannot slip past the UI check. The rule and its limits live in
 * src/lib/duplicates.js.
 */
export const addMenuItem = async (itemData) => {
  try {
    const validation = menuItemSchema.safeParse(itemData)
    if (!validation.success) return fail(validation.error.issues[0]?.message || "Invalid menu item data")

    const existing = await getMenuItemsOnce()
    const clashes = findConflictingMenuItems(existing, validation.data.name, validation.data.category)
    if (clashes.length > 0) {
      return fail(
        `A ${validation.data.category} product named "${validation.data.name}" already exists. Edit or rename it instead of adding a second one.`
      )
    }

    const newItemRef = push(menuRef, validation.data)
    return ok("Menu item added successfully", { id: newItemRef.key, ...validation.data })
  } catch (error) {
    return failWith(error)
  }
}

/**
 * Get all menu items in real-time (onValue)
 * Returns an unsubscribe function.
 *
 * Uses `val()` rather than `snapshot.forEach()` for the same reason as getMenuItemsOnce:
 * the priority-index traversal behind `forEach` can return a truncated child list, which
 * would silently hide products from the menu and from duplicate review.
 */
export const getMenuItems = (callback) =>
  safeSubscribe(menuRef, (snapshot) => callback(valToList(snapshot.val())))

/**
 * Get all menu items once (get)
 *
 * Reads through `val()` rather than `snapshot.forEach()`. The two are equivalent for
 * well-formed nodes, but the priority-index traversal behind `forEach` can hand back a
 * short list, whereas `val()` returns the whole node. This sits on the duplicate check's
 * path, so a truncated read there would mean a missed collision.
 */
export const getMenuItemsOnce = async () => {
  const snapshot = await get(menuRef)
  return valToList(snapshot.val())
}

/**
 * Query menu item by name (simple query)
 */
export const getMenuItemByName = async (name) => {
  const snapshot = await get(query(menuRef, orderByChild("name"), equalTo(name), limitToFirst(1)))
  return snapshot.exists()
}

/**
 * Query menu items by category
 */
export const getMenuItemsByCategory = async (category) => {
  const snapshot = await get(query(menuRef, orderByChild("category"), equalTo(category)))
  return snapshotToList(snapshot)
}

/**
 * Update a menu item
 *
 * Renaming into a name that already exists in the same category is refused. The item
 * being edited is excluded, so saving an unchanged product never flags itself, and
 * changing only the price/description never triggers a check at all.
 */
export const updateMenuItem = async (id, itemData) => {
  try {
    const { name, category } = itemData
    if (name !== undefined && category !== undefined) {
      const existing = await getMenuItemsOnce()
      const clashes = findConflictingMenuItems(existing, name, category, id)
      if (clashes.length > 0) {
        return fail(`A ${category} product named "${name}" already exists. Pick a different name or edit that item instead.`)
      }
    }

    await update(refAt(`menu/${id}`), itemData)
    return ok("Menu item updated successfully", { id, ...itemData })
  } catch (error) {
    return failWith(error)
  }
}

/**
 * Delete a menu item
 */
export const deleteMenuItem = async (id) => {
  try {
    await remove(refAt(`menu/${id}`))
    return ok("Menu item deleted successfully")
  } catch (error) {
    return failWith(error)
  }
}

/**
 * Toggle menu item availability
 */
export const toggleAvailability = async (id, currentAvailability) => {
  try {
    // `set`, not `update`: Firebase v9+ requires an object for update().
    await set(refAt(`menu/${id}/available`), !currentAvailability)
    return ok(`Item ${!currentAvailability ? "available" : "sold out"}`)
  } catch (error) {
    return failWith(error)
  }
}

// ===========================================================================
// ORDER CRUD
// ===========================================================================

/**
 * Place a new order (push)
 *
 * Orders are nested under their customer: /orders/<customerId>/<pushId>.
 * That nesting is what lets a cashier read only their own orders. RTDB rules do
 * not cascade, so a query on /orders is judged by the rule on /orders itself —
 * there is no way to express "every order whose customerId is me" as a query
 * permission. Scoping by path sidesteps it: a cashier reads /orders/<ownUid>,
 * which the child rule can grant, while an admin reads all of /orders.
 */
export const placeOrder = async (orderData) => {
  try {
    const validation = orderSchema.safeParse(orderData)
    if (!validation.success) return fail(validation.error.issues[0]?.message || "Invalid order data")

    // displayId is generated locally so customers never need
    // read/write access to a shared counter node.
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

/**
 * Flatten either shape into a list of orders that carry their own id.
 *
 * The admin feed reads /orders, which is one level deeper now, so it arrives as
 * { [customerId]: { [orderId]: order } }. The cashier feed reads
 * /orders/<uid> and arrives already flat. Both become the same array shape so
 * pages need no special casing.
 */
function flattenOrders(value, depth) {
  if (!value) return []
  if (depth === "flat") return valToList(value)

  return Object.entries(value).flatMap(([customerId, orders]) =>
    Object.entries(orders ?? {}).map(([id, order]) => ({ id, customerId, ...order }))
  )
}

/** Pick the orders node to read: one customer's, or the whole admin feed. */
const ordersTarget = (customerId) => (customerId ? refAt(`orders/${customerId}`) : ordersRef)
const flattenFor = (customerId, value) => flattenOrders(value, customerId ? "flat" : "byCustomer")

/**
 * Get orders in real-time (onValue)
 *
 *   - omit `customerId` for the admin-wide feed (reads /orders)
 *   - pass a customerId to read just that customer's orders
 *
 * Returns an unsubscribe function.
 */
export const getOrders = (callback, customerId) =>
  safeSubscribe(() => ordersTarget(customerId), (snapshot) => callback(flattenFor(customerId, snapshot.val())))

/**
 * Get orders once (get) — mirrors `getOrders` scoping rules.
 */
export const getOrdersOnce = async (customerId) => {
  const snapshot = await get(ordersTarget(customerId))
  return flattenFor(customerId, snapshot.val())
}

/**
 * Get orders by customer ID
 */
export const getOrdersByCustomer = async (customerId) => {
  const snapshot = await get(refAt(`orders/${customerId}`))
  return flattenOrders(snapshot.val(), "flat")
}

/**
 * Get orders by status (admin feed, filtered client-side)
 *
 * Not a server query on purpose: orders are nested one level by customer, so
 * `orderByChild("status")` at /orders would compare whole customers rather than
 * individual orders. The admin already holds the full list, so filtering it here
 * is both correct and cheap.
 */
export const getOrdersByStatus = async (status) => {
  const orders = await getOrdersOnce()
  return orders.filter((o) => o.status === status)
}

/**
 * Update order status
 */
export const updateOrderStatus = async (customerId, id, status) => {
  try {
    // `set`, not `update`: Firebase v9+ requires an object for update().
    await set(refAt(`orders/${customerId}/${id}/status`), status)
    return ok(`Order ${id} status updated to ${status}`)
  } catch (error) {
    return failWith(error)
  }
}

/**
 * Cashier requests void on their own order.
 */
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

/**
 * Admin approves or declines a void request.
 * decision = "cancelled" (approve) or "declined" (decline)
 */
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

/**
 * Delete an order
 */
export const deleteOrder = async (customerId, id) => {
  try {
    await remove(refAt(`orders/${customerId}/${id}`))
    return ok("Order deleted successfully")
  } catch (error) {
    return failWith(error)
  }
}

// ===========================================================================
// AUTH
// ===========================================================================

/**
 * Login with email and password
 */
export const loginUser = async (email, password) => {
  try {
    if (!email.trim() || !password) return fail("Email and password are required")

    const cred = await signInWithEmailAndPassword(auth, email, password)
    const uid = cred.user.uid

    // Fetch user profile from RTDB
    const profileSnap = await getProfile(uid)
    if (!profileSnap.exists()) return fail("User profile not found")

    const userData = profileSnap.val()

    // A disabled account is refused at sign-in even if the Firebase credentials are
    // still valid. `setCashierEnabled` also sets an auth custom claim, but that claim
    // is only refreshed on a new token, so the database flag is the reliable check.
    if (userData.disabled === true) {
      await signOut(auth)
      return fail("This account has been disabled. Ask the Owner/Manager to re-enable it.")
    }

    // Reject a profile whose role is missing or unrecognised. Without this, a
    // cast would turn any string into a "valid" user and the app would quietly
    // treat a broken record as a cashier.
    if (userData.role !== "admin" && userData.role !== "cashier") {
      await signOut(auth)
      return fail("Your account role is not set correctly. Ask the Owner/Manager to fix it.")
    }

    return ok("Login successful", { id: uid, ...userData })
  } catch (error) {
    return failWith(error)
  }
}

/**
 * Register a new user
 */
export const registerUser = async (name, email, password) => {
  try {
    if (!name.trim()) return fail("Name is required")
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return fail("Enter a valid email address")
    if (password.length < 8) return fail("Password must be at least 8 characters")

    // Create Firebase Auth user
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const uid = cred.user.uid

    // Create user profile in RTDB
    const profile = {
      name: name.trim(),
      email: email.trim(),
      role: "cashier",
      createdAt: new Date().toISOString(),
    }
    await set(profileRef(uid), profile)

    return ok("Account created successfully", { id: uid, ...profile })
  } catch (error) {
    if (error.code === "auth/email-already-in-use") return fail("An account with this email already exists")
    return failWith(error)
  }
}

/**
 * Logout current user
 */
export const logoutUser = async () => {
  try {
    await signOut(auth)
    return ok("Logged out successfully")
  } catch (error) {
    return failWith(error)
  }
}

/**
 * Subscribe to auth state changes
 * Returns an unsubscribe function.
 */
export const onAuthChange = (callback) =>
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) return callback(null)
    const uid = firebaseUser.uid
    const profileSnap = await getProfile(uid)
    callback(profileSnap.exists() ? { id: uid, ...profileSnap.val() } : null)
  })

// ===========================================================================
// USER MANAGEMENT (Admin)
// ===========================================================================

/**
 * Get all users in real-time (onValue)
 * Returns an unsubscribe function.
 */
export const getUsers = (callback) =>
  safeSubscribe(usersRef, (snapshot) => callback(snapshotToList(snapshot)))

/**
 * Subscribe to a single user profile in real time.
 * Used to honour the `disabled` flag on active sessions.
 */
export const subscribeUserProfile = (uid, callback) =>
  onValue(profileRef(uid), (snapshot) => {
    callback(snapshot.exists() ? { id: uid, ...snapshot.val() } : null)
  })

/**
 * Get all users once (get)
 */
export const getUsersOnce = async () => {
  const snapshot = await get(usersRef)
  return snapshotToList(snapshot)
}

/**
 * Update user profile
 */
export const updateUser = async (id, userData) => {
  try {
    await update(profileRef(id), userData)
    return ok("User updated successfully", { id, ...userData })
  } catch (error) {
    return failWith(error)
  }
}

/**
 * Delete a user.
 *
 * Retained only for a user who has no orders and no refunds; the UI routes staff
 * removal through `disableCashier` in functionsClient instead, because deleting
 * the RTDB profile would orphan their past orders and would not touch their
 * Authentication account anyway. See functions/src/index.js.
 */
export const deleteUser = async (id) => {
  try {
    await remove(profileRef(id))
    return ok("User deleted successfully")
  } catch (error) {
    return failWith(error)
  }
}

/**
 * Enable/disable a cashier through the RTDB profile flag.
 *
 * This blocks access to CuccuPOS (login checks, active sessions and the
 * security rules all honour `disabled`) but does NOT disable the underlying
 * Firebase Authentication account, which must be managed separately in the
 * Firebase Console if desired.
 */
export const setCashierEnabled = async (uid, enabled) => {
  try {
    // Self-check runs before any profile lookup, as before.
    if (auth.currentUser?.uid === uid) return fail("You cannot disable your own account.")

    const { error } = await requireUser({
      role: "admin",
      notFound: "Only an Owner/Manager can perform this action.",
      wrongRole: "Only an Owner/Manager can perform this action.",
      checkDisabled: true,
    })
    if (error) return error

    const targetSnap = await getProfile(uid)
    if (!targetSnap.exists()) return fail("That account no longer exists.")
    if (targetSnap.val()?.role === "admin") {
      return fail("This account is an Owner/Manager. Use a dedicated administrator flow for those.")
    }

    await update(profileRef(uid), {
      disabled: enabled,
      reenabledAt: enabled ? new Date().toISOString() : null,
    })
    return ok(enabled ? "Account re-enabled" : "Account disabled")
  } catch (error) {
    return failWith(error, "Could not update the account.")
  }
}

/**
 * Cashier accounts are no longer created through a Cloud Function.
 *
 * New cashiers self-register at `/register` (which always writes the `cashier`
 * role through the security rules). An Owner/Manager who needs to provision an
 * account directly can do so manually in the Firebase Console: create the
 * Authentication user, then create the matching `/users/<uid>` profile with
 * `role: "cashier"`. See `MANUAL_SETUP_AND_DEPLOYMENT.md`.
 */
export const createCashierAccount = async (_name, _email, _password) =>
  fail(
    "Automatic cashier creation is disabled. Ask the cashier to register at /register, or create the account manually in the Firebase Console."
  )

/**
 * Locate the (customerId, order) pair for an order id. Admins can read the whole
 * tree; cashiers never reach this path because refunds are admin-only.
 */
async function locateOrder(orderId, customerId) {
  if (customerId) {
    const snap = await get(refAt(`orders/${customerId}/${orderId}`))
    return snap.exists() ? { customerId } : null
  }
  const snap = await get(ordersRef)
  const match = Object.entries(snap.val() ?? {}).find(([, bucket]) => bucket && bucket[orderId])
  return match ? { customerId: match[0] } : null
}

/**
 * Issue a refund through an RTDB transaction on the individual order record.
 *
 * The remaining-amount check runs inside the transaction so two concurrent
 * refunds can never both pass. `approvedBy` is taken from the signed-in session,
 * not from caller input. The original order fields are preserved; only the
 * refund audit record and the cached `refundedTotal` are appended/updated.
 *
 * Success is reported only after Firebase acknowledges the write.
 */
export const refundOrder = async (orderId, amount, reason, customerId) => {
  try {
    if (!orderId?.trim()) return fail("Order id is required.")
    if (!reason || reason.trim().length < 3) return fail("A refund reason of at least 3 characters is required.")
    const requested = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(requested) || requested <= 0) return fail("Refund amount must be greater than zero.")

    const { user, profile, error } = await requireUser({
      role: "admin",
      notFound: "No user profile found for this session.",
      wrongRole: "Only an Owner/Manager can perform this action.",
      checkDisabled: true,
    })
    if (error) return error

    const located = await locateOrder(orderId, customerId)
    if (!located) return fail("Order not found.")

    const approvedBy = { uid: user.uid, name: String(profile?.name ?? "") }
    const result = await runTransaction(
      refAt(`orders/${located.customerId}/${orderId}`),
      (current) => {
        if (!current) return current
        const updated = applyRefund(current, { amount: requested, reason }, approvedBy)
        return { ...current, ...updated, id: current.id ?? orderId }
      },
      { applyLocally: false }
    )

    if (!result.committed) return fail("Refund could not be applied. Please try again.")
    return ok("Refund recorded", { orderId, amount: requested })
  } catch (error) {
    return failWith(error, "Refund failed.")
  }
}

// ===========================================================================
// SEED / RESET
// ===========================================================================

/**
 * Reset demo data to seed values
 */
export const resetDemoData = async () => {
  try {
    const seedMenuData = {
      m_1: { name: "Iced Americano", price: 80, description: "Pure espresso with chilled water.", category: "Coffee", tag: null, image: "/menu/iced-americano.jpg", available: true },
      m_2: { name: "Classic Milk Tea", price: 95, description: "Smooth and creamy milk tea.", category: "Milk Tea", tag: null, image: "/menu/classic-milk-tea.jpg", available: true },
      m_3: { name: "Spanish Latte", price: 100, description: "Espresso with condensed milk.", category: "Coffee", tag: null, image: "/menu/spanish-latte.jpg", available: true },
      m_4: { name: "Wintermelon Milk Tea", price: 100, description: "Refreshing wintermelon flavor.", category: "Milk Tea", tag: null, image: "/menu/wintermelon-milk-tea.jpg", available: true },
      m_5: { name: "Caramel Macchiato", price: 100, description: "Espresso with vanilla syrup, and caramel drizzle", category: "Coffee", tag: null, image: "/menu/caramel-macchiato.jpg", available: true },
      m_6: { name: "Matcha", price: 105, description: "Premium matcha with fresh milk.", category: "Others", tag: "Non-coffee", image: "/menu/matcha.jpg", available: true },
      m_7: { name: "Mocha Frappe", price: 110, description: "Blended coffee and chocolate topped with whipped cream", category: "Frappe", tag: null, image: "/menu/mocha-frappe.jpg", available: true },
      m_8: { name: "Taro Milk Tea", price: 95, description: "Creamy taro with fresh milk and tapioca pearls", category: "Milk Tea", tag: null, image: "/menu/taro-milk-tea.jpg", available: true },
      m_9: { name: "Java Chip Frappe", price: 110, description: "Blended coffee with chocolate chips.", category: "Frappe", tag: null, image: "/menu/java-chip-frappe.jpg", available: true },
      m_10: { name: "Caramel Frappe", price: 110, description: "Rich caramel flavor with whipped cream.", category: "Frappe", tag: null, image: "/menu/caramel-frappe.jpg", available: true },
    }

    // Reset menu
    await set(menuRef, seedMenuData)

    // Reset orders
    await set(ordersRef, null)

    return ok("Demo data reset successfully")
  } catch (error) {
    return failWith(error)
  }
}
