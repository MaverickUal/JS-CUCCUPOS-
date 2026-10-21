/**
 * Canonical form used for comparison. Not a display value -- use the item's own
 * `name` everywhere the user actually sees text.
 */
export function normalizeMenuName(raw) {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function key(name, category) {
  return `${normalizeMenuName(name)}::${category.trim().toLowerCase()}`
}

/**
 * Hard duplicates: same normalized name within the same category. These are what
 * `saveMenuItem` refuses to create.
 */
export function findDuplicateGroups(items) {
  const buckets = new Map()
  for (const item of items) {
    const k = key(item.name, item.category)
    const bucket = buckets.get(k)
    if (bucket) bucket.push(item)
    else buckets.set(k, [item])
  }

  const groups = []
  for (const [k, group] of buckets) {
    if (group.length < 2) continue
    groups.push({
      key: k,
      label: group[0].name,
      category: group[0].category,
      items: group,
    })
  }
  return groups.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Items that a new/edited name would collide with. `excludeId` is the item being
 * edited, so saving an unchanged product does not flag itself.
 */
export function findConflictingMenuItems(
  items,
  name,
  category,
  excludeId
) {
  const target = key(name, category)
  return items.filter((i) => key(i.name, i.category) === target && i.id !== excludeId)
}

/**
 * Same normalized name, different categories. Advisory only -- shown to the admin
 * as something to review, never used to block a save.
 */
export function findCrossCategoryNameMatches(items) {
  const buckets = new Map()
  for (const item of items) {
    const n = normalizeMenuName(item.name)
    const bucket = buckets.get(n)
    if (bucket) bucket.push(item)
    else buckets.set(n, [item])
  }

  const matches = []
  for (const [n, group] of buckets) {
    const categories = new Set(group.map((g) => g.category.trim().toLowerCase()))
    if (group.length < 2 || categories.size < 2) continue
    matches.push({ name: group[0].name, items: group })
  }
  return matches.sort((a, b) => a.name.localeCompare(b.name))
}