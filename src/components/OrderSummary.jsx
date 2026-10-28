import { StatusBadge } from "@/components/StatusBadge"
import { formatDateTime, orderNo, peso } from "@/lib/format"

/** Order number, status, items and total. Shared by the void dialogs. */
export function OrderSummary({ order }) {
  return (
    <div className="space-y-2 rounded-xl bg-muted p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-bold">{orderNo(order)}</p>
          <p className="text-xs text-muted-foreground">{order.customerName} · {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <ul className="space-y-0.5">
        {Object.values(order.items).map((i) => (
          <li key={i.menuItemId} className="flex justify-between"><span>{i.qty} × {i.name}</span><span>{peso(i.qty * i.price)}</span></li>
        ))}
      </ul>
      <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{peso(order.total)}</span></div>
    </div>
  )
}
