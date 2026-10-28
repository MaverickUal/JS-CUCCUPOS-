import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { OrderSummary } from "@/components/OrderSummary"
import { VoidRequestInfo } from "@/components/VoidAudit"
import { useStore } from "@/store/AppStore"
import { orderNo } from "@/lib/format"
import { MAX_REASON, validateReason } from "@/lib/voids"

/**
 * Owner/Manager confirms an Approve or Decline decision.
 *
 * `mode` is "approve" or "decline". Declining needs a reason. The decision is
 * made by the backend, which re-checks the admin role and that the request is
 * still pending; this dialog is a confirmation step, not the security boundary.
 */
export function VoidDecisionDialog({ order, mode, open, onOpenChange }) {
  const { approveVoid, declineVoid } = useStore()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const inFlight = useRef(false)

  useEffect(() => {
    if (!open) return
    setReason("")
    setError("")
  }, [open, order?.id, mode])

  if (!order || order.status !== "pending_void") return null

  const approving = mode === "approve"
  const reasonError = approving ? null : validateReason(reason)

  async function submit() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError("")
    const res = approving ? await approveVoid(order, "cancelled") : await declineVoid(order)
    inFlight.current = false
    setBusy(false)
    if (!res.success) {
      setError(res.message)
      toast.error(res.message)
      return
    }
    toast.success(`${orderNo(order)} · ${res.message}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {approving ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
            {approving ? "Approve void" : "Decline void"}
          </DialogTitle>
          <DialogDescription>
            {approving
              ? "The order will be cancelled and excluded from sales totals. It is kept in the records. Any cash already returned to the customer must be recorded separately."
              : `The order returns to its previous status (${order.previousStatus || "unknown"}). The cashier sees your reason.`}
          </DialogDescription>
        </DialogHeader>

        <OrderSummary order={order} />
        <VoidRequestInfo order={order} />

        {!approving && (
          <div className="space-y-1.5">
            <Label htmlFor="decline-reason">Reason for declining</Label>
            <textarea
              id="decline-reason"
              rows={3}
              maxLength={MAX_REASON}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={approving ? "destructive" : "default"} disabled={busy || !!reasonError} onClick={submit}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Saving…" : approving ? "Approve void" : "Decline void"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
