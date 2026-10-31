
import { round2 } from "@/lib/format"


export const DISCOUNT_TYPES = ["none", "pwd", "senior"]
export const DISCOUNT_LABELS = {
  none: "No discount",
  pwd: "PWD",
  senior: "Senior Citizen",
}


export const DISCOUNT_RATE = 0.2


export const ELIGIBLE_CATEGORIES = null

export const MIN_DISCOUNTABLE_AMOUNT = 1



export function isDiscountableCategory(
  category,
  allowed = ELIGIBLE_CATEGORIES
) {
  return allowed === null || allowed.includes(category)
}

export function eligibleSubtotalOf(lines) {
  return round2(
    lines.reduce(
      (sum, l) => sum + (isDiscountableCategory(l.category) ? l.qty * l.price : 0),
      0
    )
  )
}


export function computeDiscount(lines, type) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.qty * l.price, 0))
  const eligibleSubtotal = eligibleSubtotalOf(lines)

  if (type === "none" || eligibleSubtotal < MIN_DISCOUNTABLE_AMOUNT) {
    return { type: "none", subtotal, eligibleSubtotal, rate: 0, amount: 0, total: subtotal }
  }

  
  const amount = Math.min(round2(eligibleSubtotal * DISCOUNT_RATE), eligibleSubtotal)
  const total = round2(subtotal - amount)

  return {
    type,
    subtotal,
    eligibleSubtotal,
    rate: DISCOUNT_RATE,
    amount,
    total: Math.max(0, total),
  }
}


export function changeFor(cash, total) {
  const tendered = round2(cash)
  const payable = round2(total)
  const change = round2(tendered - payable)
  return { tendered, payable, change, sufficient: tendered > 0 && tendered >= payable }
}