
export const round2 = (n) => Math.round(n * 100) / 100

export const peso = (n) => "₱" + n.toLocaleString("en-PH", { maximumFractionDigits: 2 })

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })


export const orderNo = (o) => o.displayId || o.id
