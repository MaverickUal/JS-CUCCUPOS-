import { useEffect, useState } from "react"
import { Ban, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OrderSummary } from "@/components/OrderSummary"
import { useStore } from "@/store/AppStore"
import { orderNo } from "@/lib/format"
import { useGuardedSubmit } from "@/lib/useGuardedSubmit"


export function VoidRequestDialog({ order, open, onOpenChange }) {
  const { requestVoid } = useStore()
  const [confirming, setConfirming] = useState(false)
  const { busy, error, setError, run } = useGuardedSubmit()

  useEffect(() => {
    if (!open) return
    setConfirming(false)
    setError("")
  }, [open, order?.id])

  if (!order) return null

  async function submit() {
    const res = await run(() => requestVoid(order.id))
    if (!res) return
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

        {confirming && (
          <div className="space-y-1 rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm">
            <p className="font-semibold">Send this void request to the Owner/Manager?</p>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {!confirming ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={() => setConfirming(true)}>Continue</Button>
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