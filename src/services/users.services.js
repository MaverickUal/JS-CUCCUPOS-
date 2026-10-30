import { db, auth } from "@/lib/firebase"
import { ref, get, onValue, update } from "firebase/database"

const usersRef = ref(db, "users")

const ok = (message, data) => (data === undefined ? { success: true, message } : { success: true, message, data })
const fail = (message) => ({ success: false, message })
const failWith = (error, fallback) => fail(error?.message || fallback)

const refAt = (path) => ref(db, path)
const profileRef = (uid) => refAt(`users/${uid}`)
const getProfile = (uid) => get(profileRef(uid))

const snapshotToList = (snapshot) => {
  const list = []
  snapshot.forEach((snap) => {
    list.push({ id: snap.key, ...snap.val() })
  })
  return list
}

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

export const getUsers = (callback) =>
  safeSubscribe(usersRef, (snapshot) => callback(snapshotToList(snapshot)))

export const subscribeUserProfile = (uid, callback) =>
  onValue(profileRef(uid), (snapshot) => {
    callback(snapshot.exists() ? { id: uid, ...snapshot.val() } : null)
  })

export const setCashierEnabled = async (uid, enabled) => {
  try {
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
