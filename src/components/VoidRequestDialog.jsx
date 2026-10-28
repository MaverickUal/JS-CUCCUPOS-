import { useEffect, useRef, useState } from "react"
import { Ban, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { OrderSummary } from "@/components/OrderSummary"
import { useStore } from "@/store/AppStore"
import { orderNo } from "@/lib/format"
import { MAX_REASON, validateReason } from "@/lib/voids"

/**
 * Cashier asks the Owner/Manager to void an order.
 *
 * Two steps: enter a reason, then confirm. Nothing is cancelled here. The
 * `requestVoid` Cloud Function moves the order to Pending Void and the orders
 * listener updates every screen, so success is reported only after the backend
 * has accepted the request.
 */
export function VoidRequestDialog({ order, open, onOpenChange }) {
  const { requestVoid } = useStore()
  const [reason, setReason] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // A ref, not state: two fast clicks can both read `busy === false` before React re-renders.
  const inFlight = useRef(false)

  useEffect(() => {
    if (!open) return
    setReason("")
    setConfirming(false)
    setError("")
  }, [open, order?.id])

  if (!order) return null

  const reasonError = validateReason(reason)

  async function submit() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError("")
    const res = await requestVoid(order.id, reason.trim())
    inFlight.current = false
    setBusy(false)
    if (!res.success) {
      setError(res.message)
      toast.error(res.message)
      return
    }
    toast.success(`${orderNo(order)} · void request sent`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ban className="size-5" /> Request void</DialogTitle>
          <DialogDescription>
            The order stays as it is until the Owner/Manager approves. If they decline, it returns to its current status.
          </DialogDescription>
        </DialogHeader>

        <OrderSummary order={order} />

        {!confirming ? (
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason for voiding</Label>
            <textarea
              id="void-reason"
              rows={3}
              maxLength={MAX_REASON}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Incorrect order entered"
              className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : (
          <div className="space-y-1 rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm">
            <p className="font-semibold">Send this void request to the Owner/Manager?</p>
            <p className="text-muted-foreground">Reason: {reason.trim()}</p>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {!confirming ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button disabled={!!reasonError} onClick={() => setConfirming(true)}>Continue</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
              <Button variant="destructive" disabled={busy} onClick={submit}>
                {busy && <Loader2 className="animate-spin" />} {busy ? "Sending…" : "Confirm request"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
