/**
 * FIREBASE DATA LAYER.
 * All data is read from and written to Firebase RTDB via src/lib/actions.js.
 * State is kept in React and synced with Firebase using onValue listeners.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { computeDiscount } from "@/lib/discounts"
import { sortByCreatedAtDesc } from "@/lib/stats"
import { round2 } from "@/lib/format"
import { getMenuItems, addMenuItem as addMenuItemAction, updateMenuItem as updateMenuItemAction, deleteMenuItem as deleteMenuItemAction, toggleAvailability as toggleAvailabilityAction } from "@/services/menu.services"
import { getOrders, placeOrder as placeOrderAction, updateOrderStatus as updateOrderStatusAction, requestVoid as requestVoidAction, approveVoid as approveVoidAction } from "@/services/orders.services"
import { getUsers, subscribeUserProfile, setCashierEnabled as setCashierEnabledAction } from "@/services/users.services"
import { onAuthChange, loginUser, registerUser, logoutUser } from "@/services/auth.services"

export const MAX_QTY = 99

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [menu, setMenu] = useState([])
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)

  // Menu is publicly readable, so it is always subscribed.
  // Auth state drives the identity of the current user.
  useEffect(() => {
    const unsubMenu = getMenuItems((items) => {
      setMenu(items)
      setLoading(false)
    })

    const unsubAuth = onAuthChange((user) => {
      setCurrentUser(user)
      // Route guards wait on this so a hard refresh on a deep link doesn't get
      // bounced to /login (and then to the home page) before auth has resolved.
      setAuthReady(true)
    })

    return () => {
      unsubMenu?.()
      unsubAuth?.()
    }
  }, [])

  // Orders and users are role-scoped, so they re-subscribe whenever the
  // signed-in user changes. Admins get the full feed; a cashier only ever
  // reads their own orders (query) and never the customer list.
  const userId = currentUser?.id ?? null
  const isAdmin = currentUser?.role === "admin"

  useEffect(() => {
    if (!userId) {
      setOrders([])
      setUsers([])
      return
    }

    const unsubOrders = getOrders(setOrders, isAdmin ? null : userId)
    const unsubUsers = isAdmin ? getUsers(setUsers) : null

    if (!isAdmin) setUsers(currentUser ? [currentUser] : [])

    return () => {
      unsubOrders?.()
      unsubUsers?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isAdmin])

  const cartLines = useMemo(
    () =>
      cart.flatMap((l) => {
        const item = menu.find((m) => m.id === l.menuItemId)
        return item ? [{ item, qty: l.qty }] : []
      }),
    [cart, menu]
  )
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0)
  const cartTotal = cartLines.reduce((s, l) => s + l.qty * l.item.price, 0)

  /**
   * Newest first, applied once here so every screen that reads `orders` gets the
   * same order. The admin feed arrives grouped by customer (see flattenOrders in
   * actions.js), so without this the board looks randomly sequenced.
   */
  const sortedOrders = useMemo(() => sortByCreatedAtDesc(orders), [orders])

  /** Run an auth action and, on success, make its user the current one. */
  const authenticate = async (action) => {
    const result = await action()
    if (result.success && result.data) {
      const user = { ...result.data }
      setCurrentUser(user)
      return { ok: true, user }
    }
    return { ok: false, error: result.message }
  }

  const login = (email, password) => authenticate(() => loginUser(email, password))
  const register = (name, email, password) => authenticate(() => registerUser(name, email, password))

  const logout = async () => {
    await logoutUser()
    setCurrentUser(null)
    setCart([])
  }

  // Honour the `disabled` flag on an already-signed-in session: if an
  // administrator disables this account while it is in use, sign it out.
  useEffect(() => {
    if (!currentUser?.id) return
    const unsub = subscribeUserProfile(currentUser.id, (profile) => {
      if (profile && profile.disabled === true) {
        toast.error("This account has been disabled. Ask the Owner/Manager to re-enable it.")
        void logout()
      }
    })
    return () => {
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  const addToCart = (id) =>
    setCart((prev) => {
      const item = menu.find((m) => m.id === id)
      if (!item || !item.available) return prev
      const existing = prev.find((l) => l.menuItemId === id)
      return existing
        ? prev.map((l) => (l.menuItemId === id ? { ...l, qty: Math.min(l.qty + 1, MAX_QTY) } : l))
        : [...prev, { menuItemId: id, qty: 1 }]
    })

  const setQty = (id, qty) =>
    setCart((prev) =>
      prev.map((l) => (l.menuItemId === id ? { ...l, qty: Math.max(1, Math.min(MAX_QTY, Math.floor(qty) || 1)) } : l))
    )

  const removeFromCart = (id) => setCart((prev) => prev.filter((l) => l.menuItemId !== id))
  const clearCart = () => setCart([])

  const reorder = (order) =>
    setCart((prev) => {
      let newCart = [...prev]
      Object.values(order.items).forEach((oi) => {
        const m = menu.find((x) => x.id === oi.menuItemId)
        if (!m || !m.available) return
        const ex = newCart.find((l) => l.menuItemId === oi.menuItemId)
        if (ex) newCart = newCart.map((l) => (l === ex ? { ...l, qty: Math.min(l.qty + oi.qty, MAX_QTY) } : l))
        else newCart.push({ menuItemId: oi.menuItemId, qty: oi.qty })
      })
      return newCart
    })

  /** Discount breakdown for the current cart. */
  const previewDiscount = (type) =>
    computeDiscount(
      cartLines.map((l) => ({ category: l.item.category, qty: l.qty, price: l.item.price })),
      type
    )

  const placeOrder = async (cashTendered, note, discountType = "none") => {
    if (!currentUser || cartLines.length === 0) return null

    // The discount is recomputed from the cart here rather than accepted from the
    // caller, so the persisted total always matches the line items.
    const breakdown = previewDiscount(discountType)
    const tendered = round2(cashTendered)
    const changeGiven = round2(tendered - breakdown.total)

    if (tendered + 0.004 < breakdown.total) {
      toast.error("Cash received does not cover the total.")
      return null
    }

    const orderData = {
      customerId: currentUser.id,
      customerName: currentUser.name,
      items: cartLines.reduce((acc, l) => {
        acc[l.item.id] = {
          menuItemId: l.item.id,
          name: l.item.name,
          price: l.item.price,
          qty: l.qty,
          category: l.item.category,
        }
        return acc
      }, {}),
      subtotal: breakdown.subtotal,
      discountType: breakdown.type,
      discountAmount: breakdown.amount,
      total: breakdown.total,
      paymentMethod: "Cash",
      cashTendered: tendered,
      changeGiven,
      // New orders always start pending; the backend rules enforce it too.
      status: "pending",
      createdAt: new Date().toISOString(),
      note: note || null,
    }

    const result = await placeOrderAction(orderData)
    if (result.success) {
      setCart([])
      return result.data
    }
    toast.error(result.message || "Could not place the order. Please try again.")
    return null
  }

  const updateOrderStatus = async (id, status) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return { success: false, message: "Order not found." }
    const res = await updateOrderStatusAction(order.customerId, id, status)
    if (res && res.success === false) {
      toast.error(res.message || "Could not update the order status.")
    }
    return res
  }

  const saveMenuItem = async (input) => {
    if (input.id) {
      const { id, ...rest } = input
      return updateMenuItemAction(id, rest)
    }
    return addMenuItemAction(input)
  }

  const toggleAvailability = async (id) => {
    const item = menu.find((m) => m.id === id)
    if (!item) return { success: false, message: "Item not found" }
    return toggleAvailabilityAction(id, item.available)
  }


  // Void workflow. These go through Cloud Functions, never the RTDB SDK: the rules
  // refuse client writes to the void fields. Each resolves to { success, message }
  // like the other store actions. The orders listener delivers the new state, so
  // nothing is patched locally.
  const voidResult = (res, okMessage) =>
    res.success
      ? { success: true, message: res.message || okMessage }
      : { success: false, message: res.message || "Failed" }

  const requestVoid = async (orderId, reason) =>
    voidResult(await requestVoidAction(orderId, reason), "Void request submitted.")

  const approveVoid = async (order, decision) =>
    voidResult(await approveVoidAction(order.customerId || null, order.id, decision), "Void decision applied.")

  const declineVoid = (order) => approveVoid(order, "declined")

  const value = {
    currentUser,
    users,
    menu,
    orders: sortedOrders,
    cartLines,
    cartCount,
    cartTotal,
    loading,
    authReady,
    login,
    register,
    logout,
    addToCart,
    setQty,
    removeFromCart,
    clearCart,
    reorder,
    placeOrder,
    previewDiscount,
    requestVoid,
    approveVoid,
    declineVoid,
    setCashierEnabled: setCashierEnabledAction,
    updateOrderStatus,
    saveMenuItem,
    deleteMenuItem: deleteMenuItemAction,
    toggleAvailability,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>")
  return ctx
}
