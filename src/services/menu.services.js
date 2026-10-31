import { db } from "@/lib/firebase"
import {
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
} from "firebase/database"
import { menuItemSchema } from "@/lib/schemas"
import { findConflictingMenuItems } from "@/lib/duplicates"

const menuRef = ref(db, "menu")

const ok = (message, data) => (data === undefined ? { success: true, message } : { success: true, message, data })
const fail = (message) => ({ success: false, message })
const failWith = (error, fallback) => fail(error?.message || fallback)

const refAt = (path) => ref(db, path)


const valToList = (raw) => Object.entries(raw ?? {}).map(([id, value]) => ({ id, ...value }))


const safeSubscribe = (target, handler) => {
  try {
    return onValue(typeof target === "function" ? target() : target, handler)
  } catch (error) {
    console.log(error)
    return () => {}
  }
}

export const addMenuItem = async (itemData) => {
  try {
    const validation = menuItemSchema.safeParse(itemData)
    if (!validation.success) return fail(validation.error.issues[0]?.message || "Invalid menu item data")

    const existingSnap = await get(menuRef)
    const existing = valToList(existingSnap.val())
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

export const getMenuItems = (callback) =>
  safeSubscribe(menuRef, (snapshot) => callback(valToList(snapshot.val())))

export const getMenuItemsOnce = async () => {
  const snapshot = await get(menuRef)
  return valToList(snapshot.val())
}

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

export const deleteMenuItem = async (id) => {
  try {
    await remove(refAt(`menu/${id}`))
    return ok("Menu item deleted successfully")
  } catch (error) {
    return failWith(error)
  }
}

export const toggleAvailability = async (id, currentAvailability) => {
  try {
    await set(refAt(`menu/${id}/available`), !currentAvailability)
    return ok(`Item ${!currentAvailability ? "available" : "sold out"}`)
  } catch (error) {
    return failWith(error)
  }
}
