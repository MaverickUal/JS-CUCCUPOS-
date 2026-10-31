import { BadgePercent } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DISCOUNT_LABELS, DISCOUNT_TYPES } from "@/lib/discounts"
import { peso } from "@/lib/format"
import { cn } from "@/lib/utils"


export function DiscountPicker({
  value,
  onChange,
  discountAmount,
  idPrefix = "discount",
  disabled,
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-type`} className="flex items-center gap-1">
        <BadgePercent className="size-3.5" /> Discount
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v)} disabled={disabled}>
        <SelectTrigger id={`${idPrefix}-type`} aria-label="Discount type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DISCOUNT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {DISCOUNT_LABELS[t]}
              {t !== "none" && discountAmount > 0 ? ` · −${peso(discountAmount)}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== "none" && (
        <p className={cn("text-xs text-muted-foreground")}>
          Cashier confirms the customer holds a valid ID. Reason is stored on the order.
        </p>
      )}
    </div>
  )
}