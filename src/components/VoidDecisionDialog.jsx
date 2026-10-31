import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OrderSummary } from "@/components/OrderSummary"
import { VoidRequestInfo } from "@/components/VoidAudit"
import { useStore } from "@/store/AppStore"
import { orderNo } from "@/lib/format"
import { useGuardedSubmit } from "@/lib/useGuardedSubmit"


export function VoidDecisionDialog({ order, mode, open, onOpenChange }) {
  const { approveVoid, declineVoid } = useStore()
  const { busy, error, setError, run } = useGuardedSubmit()

  useEffect(() => {
    if (!open) return
    setError("")
  }, [open, order?.id, mode])

  if (!order || order.status !== "pending_void") return null

  const approving = mode === "approve"

  async function submit() {
    const res = await run(() => (approving ? approveVoid(order, "cancelled") : declineVoid(order)))
    if (!res) return
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

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={approving ? "destructive" : "default"} disabled={busy} onClick={submit}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Saving…" : approving ? "Approve void" : "Decline void"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
