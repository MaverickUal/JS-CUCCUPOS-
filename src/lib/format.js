/** Round to 2 decimals so peso maths never drifts on floats (0.1 + 0.2). */
export const round2 = (n) => Math.round(n * 100) / 100

export const peso = (n) => "₱" + n.toLocaleString("en-PH", { maximumFractionDigits: 2 })

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })

/**
 * The order number to show a human.
 * `displayId` is the friendly "ORD-…" generated at checkout; the Firebase push
 * key is only a fallback for records that predate it.
 */
export const orderNo = (o) => o.displayId || o.id
