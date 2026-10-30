import { z } from "zod"
import { computeDiscount } from "@/lib/discounts"
import { round2 } from "@/lib/format"

export const orderSchema = z
  .object({
    customerId: z.string().min(1, "Customer ID is required"),
    customerName: z.string().min(1, "Customer name is required"),
    items: z.record(
      z.string(),
      z.object({
        menuItemId: z.string(),
        name: z.string(),
        price: z.number().nonnegative(),
        qty: z.number().min(1).max(99),
        category: z.string(),
      })
    ),
    subtotal: z.number().nonnegative().optional(),
    discountType: z.enum(["none", "pwd", "senior"]).optional(),
    discountAmount: z.number().nonnegative().optional(),
    total: z.number().positive("Total must be positive"),
    paymentMethod: z.literal("Cash"),
    cashTendered: z.number().nonnegative("Cash tendered cannot be negative").optional(),
    changeGiven: z.number().nonnegative("Change cannot be negative").optional(),
    status: z.literal("pending"),
    createdAt: z.string(),
    note: z.string().nullable().optional(),
  })
  .superRefine((o, ctx) => {
    const lines = Object.values(o.items)
    const expected = computeDiscount(
      lines.map((l) => ({ category: l.category, qty: l.qty, price: l.price })),
      o.discountType ?? "none"
    )

    if (o.subtotal !== undefined && round2(o.subtotal) !== round2(expected.subtotal)) {
      ctx.addIssue({ code: "custom", message: "Subtotal does not match the line items.", path: ["subtotal"] })
    }
    if (o.total !== round2(expected.total)) {
      ctx.addIssue({ code: "custom", message: "Total does not match the discount calculation.", path: ["total"] })
    }
    const statedDiscount = o.discountAmount ?? 0
    if (round2(statedDiscount) !== round2(expected.amount)) {
      ctx.addIssue({ code: "custom", message: "Discount amount is not valid.", path: ["discountAmount"] })
    }
    if (o.cashTendered !== undefined && o.cashTendered + 0.004 < expected.total) {
      ctx.addIssue({ code: "custom", message: "Cash tendered does not cover the total.", path: ["cashTendered"] })
    }
    if (o.changeGiven !== undefined) {
      const expectedChange = round2((o.cashTendered ?? 0) - expected.total)
      if (round2(o.changeGiven) !== expectedChange) {
        ctx.addIssue({ code: "custom", message: "Change does not match the tender.", path: ["changeGiven"] })
      }
    }
  })

export const menuItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().positive("Price must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  category: z.enum(["Coffee", "Milk Tea", "Frappe", "Others"]),
  tag: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  available: z.boolean(),
})

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain a capital letter")
    .regex(/[a-z]/, "Must contain a small letter")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character")
    .regex(/[0-9]/, "Must contain a number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})
