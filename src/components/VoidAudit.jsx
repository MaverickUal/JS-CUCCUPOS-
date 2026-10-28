import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/format"
import { VOID_STATUS_LABEL, voidTimeline } from "@/lib/voids"

const VARIANT = { pending: "void", approved: "destructive", declined: "info" }

/** One request: who asked, why, and (once decided) who decided and why. */
export function VoidRequestInfo({ request }) {
  return (
    <div className="space-y-1 rounded-lg border p-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Void request</span>
        <Badge variant={VARIANT[request.status] ?? "secondary"}>{VOID_STATUS_LABEL[request.status] ?? request.status}</Badge>
      </div>
      <p><b>Reason:</b> {request.reason}</p>
      <p className="text-xs text-muted-foreground">
        Requested by {request.requestedByName || "cashier"} · {formatDateTime(request.requestedAt)} · was {request.previousOrderStatus}
      </p>
      {request.decision && (
        <div className="border-t pt-1">
          <p>
            <b>{request.decision === "approved" ? "Approved" : "Declined"}</b>
            {request.decisionReason ? <> — {request.decisionReason}</> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {request.decidedByName || "Owner/Manager"} · {request.decidedAt ? formatDateTime(request.decidedAt) : ""}
          </p>
        </div>
      )}
    </div>
  )
}

/** Every void request on an order, newest first. Renders nothing for orders that never had one. */
export function VoidAudit({ order }) {
  const timeline = voidTimeline(order)
  if (timeline.length === 0) return null
  return (
    <div className="space-y-2">
      {timeline.map((r) => <VoidRequestInfo key={r.requestId} request={r} />)}
    </div>
  )
}
