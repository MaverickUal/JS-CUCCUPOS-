import { Badge } from "@/components/ui/badge"

/** Simple info box for a pending-void order (no audit trail). */
export function VoidRequestInfo({ order }) {
  return (
    <div className="space-y-1 rounded-lg border p-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Void requested</span>
        <Badge variant="void">Pending</Badge>
      </div>
      <p>Previously: <b>{order.previousStatus || "—"}</b></p>
      <p className="text-xs text-muted-foreground">Status: pending_void — awaiting Owner/Manager decision.</p>
    </div>
  )
}

/** Previously the audit trail; now just shows if pending_void. */
export function VoidAudit({ order }) {
  if (order?.status !== "pending_void") return null
  return <VoidRequestInfo order={order} />
}
