/**
 * Shared data contracts, documented as JSDoc typedefs.
 *
 * The project used to define these as TypeScript types. This file keeps the same
 * shapes as documentation (and editor IntelliSense via `@type` / `@param`
 * annotations) without needing a compiler. It exports nothing at runtime.
 *
 * Usage in another file:
 *   /** @param {import("@/types").Order} order *\/
 */

/**
 * Staff accounts only — customers are walk-ins and never sign in.
 *   admin   -> owner/manager (full dashboard, menu + staff management)
 *   cashier -> takes orders and records cash at the counter
 * These values are what lives in `users/<uid>/role` in the database, and the
 * security rules in src/lib/firebase_structure.md validate against them.
 * @typedef {"cashier" | "admin"} Role
 */

/** @typedef {"Coffee" | "Milk Tea" | "Frappe" | "Others"} Category */

/** @typedef {"pending" | "preparing" | "ready" | "completed" | "cancelled"} OrderStatus */

/**
 * The shop is cash-only for now. Widen this union (and the matching zod schema in
 * src/lib/actions.js) if another tender type is added back.
 * @typedef {"Cash"} PaymentMethod
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {Role} role
 * @property {string} createdAt
 */

/**
 * @typedef {Object} MenuItem
 * @property {string} id
 * @property {string} name
 * @property {number} price
 * @property {string} description
 * @property {Category} category
 * @property {string} [tag]
 * @property {string} [image]
 * @property {boolean} available
 */

/**
 * @typedef {Object} OrderItem
 * @property {string} menuItemId
 * @property {string} name
 * @property {number} price
 * @property {number} qty
 * @property {Category} category
 */

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} [displayId] Friendly order number ("ORD-…") generated at checkout.
 * @property {string} customerId
 * @property {string} customerName
 * @property {Record<string, OrderItem>} items
 * @property {number} [subtotal] Line-item sum before any discount. Optional: orders written before the
 *   discount feature don't have it, and fall back to `total`.
 * @property {DiscountType} [discountType] Concession applied at checkout, if any. Absent on pre-discount orders.
 * @property {number} [discountAmount]
 * @property {number} total Amount actually payable: subtotal - discountAmount.
 * @property {PaymentMethod} paymentMethod
 * @property {number} [cashTendered] Cash handed over by the customer. Cash-only shop, so this is always recorded.
 * @property {number} [changeGiven] Change returned to the customer: cashTendered - total.
 * @property {OrderStatus} status
 * @property {string} createdAt
 * @property {string} [note]
 * @property {Record<string, Refund>} [refunds] Refunds issued against this order, keyed by refund id.
 *   Absent until a refund is recorded — the order itself is never deleted.
 * @property {number} [refundedTotal] Running sum of completed refunds. Cached for cheap reads;
 *   recomputed by the backend.
 */

/**
 * Discount values live in src/lib/discounts.js, which documents the assumptions.
 * @typedef {"none" | "pwd" | "senior"} DiscountType
 */

/** @typedef {"completed"} RefundStatus */

/**
 * A completed refund. Refunds are append-only: there is no pending/approved split
 * because approval and execution both happen inside a backend transaction, so a
 * refund row only ever exists once the money has actually been handed back.
 * @typedef {Object} Refund
 * @property {string} id
 * @property {string} orderId
 * @property {string} [orderDisplayId] Order number shown to staff, for the audit trail.
 * @property {number} amount
 * @property {string} reason
 * @property {RefundStatus} status
 * @property {string} createdAt
 * @property {string} approvedBy Admin uid who approved and executed this refund. Set by the backend, never the client.
 * @property {string} [approvedByName]
 */

/**
 * @typedef {Object} CartLine
 * @property {string} menuItemId
 * @property {number} qty
 */

export {}
