import { useSearchParams } from "react-router-dom"

export const AVAIL_OPTIONS = [
  { value: "all", label: "All items" },
  { value: "available", label: "Available only" },
  { value: "soldout", label: "Sold out" },
]

export const SORT_OPTIONS = [
  { value: "default", label: "Default order" },
  { value: "name", label: "Name (A–Z)" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
]

/**
 * Search + filter state for the Order screen, kept in the URL (?q=&avail=&sort=)
 * so the top bar (in AppShell) and the menu grid (in Order) share it without props.
 */
export function useMenuFilters() {
  const [params, setParams] = useSearchParams()
  const q = params.get("q") ?? ""
  const avail = params.get("avail") ?? "all"
  const sort = params.get("sort") ?? "default"

  const set = (key, value, fallback) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!value || value === fallback) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true }
    )

  return {
    q,
    avail,
    sort,
    setQ: (v) => set("q", v, ""),
    setAvail: (v) => set("avail", v, "all"),
    setSort: (v) => set("sort", v, "default"),
    isFiltered: avail !== "all" || sort !== "default",
  }
}

/** Applies availability + sort. Search and category are applied by the caller. */
export function applyMenuFilters(items, { avail, sort }) {
  let out = items
  if (avail === "available") out = out.filter((i) => i.available)
  if (avail === "soldout") out = out.filter((i) => !i.available)
  if (sort === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name))
  if (sort === "price-asc") out = [...out].sort((a, b) => a.price - b.price)
  if (sort === "price-desc") out = [...out].sort((a, b) => b.price - a.price)
  return out
}
