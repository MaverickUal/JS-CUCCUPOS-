export const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export const endOfDay = (d) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export const validOrders = (orders) => orders.filter((o) => o.status !== "cancelled")
export const sumTotal = (orders) => orders.reduce((s, o) => s + o.total, 0)





export const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
]


export function parseDayInput(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const date = new Date(y, mo, d)
  
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null
  return date
}

export const toDayInput = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const fmtShort = (d) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })

export function resolveRange(preset, fromRaw, toRaw) {
  const today = startOfDay(new Date())
  const now = new Date()

  if (preset === "today") {
    return { preset, from: today, to: now, hourly: true, label: "Today" }
  }
  if (preset === "7d") {
    return { preset, from: addDays(today, -6), to: now, hourly: false, label: "Last 7 days" }
  }
  if (preset === "30d") {
    return { preset, from: addDays(today, -29), to: now, hourly: false, label: "Last 30 days" }
  }

  
  let from = parseDayInput(fromRaw ?? "") ?? addDays(today, -6)
  let to = parseDayInput(toRaw ?? "") ?? today
  if (from > to) [from, to] = [to, from] 

  const singleDay = from.getTime() === to.getTime()
  const isToday = to.getTime() === today.getTime()
  const label = singleDay ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`
  return {
    preset,
    from,
    to: endOfDay(to),
    hourly: singleDay && isToday,
    label,
  }
}


export const inRange = (orders, range) =>
  orders.filter((o) => {
    const t = timeOf(o)
    return t !== null && t >= range.from.getTime() && t <= range.to.getTime()
  })


export function timeOf(o) {
  if (o.createdAt === null || o.createdAt === undefined) return null
  const t = o.createdAt instanceof Date ? o.createdAt.getTime() : Date.parse(String(o.createdAt))
  return Number.isFinite(t) ? t : null
}


export function sortByCreatedAtDesc(orders) {
  return [...orders].sort((a, b) => {
    const ta = timeOf(a)
    const tb = timeOf(b)
    if (ta === null && tb === null) return 0
    if (ta === null) return 1
    if (tb === null) return -1
    return tb - ta
  })
}


export function seriesFor(orders, range) {
  const valid = validOrders(inRange(orders, range))
  const out = []

  if (range.hourly) {
    const startHour = range.from.getHours()
    const endHour = Math.max(range.to.getHours(), startHour)
    for (let h = startHour; h <= endHour; h++) {
      const from = new Date(range.from)
      from.setHours(h, 0, 0, 0)
      const to = new Date(from)
      to.setHours(h + 1, 0, 0, 0)
      
      
      const bucket = valid.filter((o) => {
        const t = timeOf(o)
        return t !== null && t >= from.getTime() && t < to.getTime()
      })
      out.push({
        label: from
          .toLocaleTimeString("en-PH", { hour: "numeric", hour12: true })
          .toLowerCase()
          .replace(/\s/g, ""),
        revenue: sumTotal(bucket),
        orders: bucket.length,
        from,
        to,
      })
    }
    return out
  }

  let cursor = startOfDay(range.from)
  const last = startOfDay(range.to)
  while (cursor <= last) {
    const from = new Date(cursor)
    const to = addDays(from, 1)
    
    
    const bucket = valid.filter((o) => {
      const t = timeOf(o)
      return t !== null && t >= from.getTime() && t < to.getTime()
    })
    out.push({
      label: fmtShort(from),
      revenue: sumTotal(bucket),
      orders: bucket.length,
      from,
      to,
    })
    cursor = addDays(cursor, 1)
  }
  return out
}





export function topItems(orders, limit = 5) {
  const m = new Map()
  validOrders(orders).forEach((o) =>
    Object.values(o.items).forEach((i) => {
      const r = m.get(i.menuItemId) ?? { name: i.name, qty: 0, revenue: 0 }
      r.qty += i.qty
      r.revenue += i.qty * i.price
      m.set(i.menuItemId, r)
    })
  )
  return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, limit)
}

export function byCategory(orders) {
  const m = new Map()
  validOrders(orders).forEach((o) =>
    Object.values(o.items).forEach((i) => {
      const r = m.get(i.category) ?? { category: i.category, qty: 0, revenue: 0 }
      r.qty += i.qty
      r.revenue += i.qty * i.price
      m.set(i.category, r)
    })
  )
  return [...m.values()].sort((a, b) => b.revenue - a.revenue)
}