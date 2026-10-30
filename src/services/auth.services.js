import { db, auth } from "@/lib/firebase"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"
import { ref, get, set } from "firebase/database"

const refAt = (path) => ref(db, path)
const profileRef = (uid) => refAt(`users/${uid}`)
const getProfile = (uid) => get(profileRef(uid))

const ok = (message, data) => (data === undefined ? { success: true, message } : { success: true, message, data })
const fail = (message) => ({ success: false, message })
const failWith = (error, fallback) => fail(error?.message || fallback)

export const loginUser = async (email, password) => {
  try {
    if (!email.trim() || !password) return fail("Email and password are required")

    const cred = await signInWithEmailAndPassword(auth, email, password)
    const uid = cred.user.uid

    const profileSnap = await getProfile(uid)
    if (!profileSnap.exists()) return fail("User profile not found")

    const userData = profileSnap.val()

    if (userData.disabled === true) {
      await signOut(auth)
      return fail("This account has been disabled. Ask the Owner/Manager to re-enable it.")
    }

    if (userData.role !== "admin" && userData.role !== "cashier") {
      await signOut(auth)
      return fail("Your account role is not set correctly. Ask the Owner/Manager to fix it.")
    }

    return ok("Login successful", { id: uid, ...userData })
  } catch (error) {
    return failWith(error)
  }
}

export const registerUser = async (name, email, password) => {
  try {
    if (!name.trim()) return fail("Name is required")
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return fail("Enter a valid email address")
    if (password.length < 8) return fail("Password must be at least 8 characters")

    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const uid = cred.user.uid

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

export const logoutUser = async () => {
  try {
    await signOut(auth)
    return ok("Logged out successfully")
  } catch (error) {
    return failWith(error)
  }
}

export const onAuthChange = (callback) =>
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) return callback(null)
    const uid = firebaseUser.uid
    const profileSnap = await getProfile(uid)
    callback(profileSnap.exists() ? { id: uid, ...profileSnap.val() } : null)
  })
