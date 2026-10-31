import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QuantityStepper } from "@/components/QuantityStepper"
import { DiscountPicker } from "@/components/DiscountPicker"
import { useStore } from "@/store/AppStore"
import { orderNo, peso, round2 } from "@/lib/format"
import { changeFor } from "@/lib/discounts"
import { cn } from "@/lib/utils"
import { applyMenuFilters, useMenuFilters } from "@/lib/useMenuFilters"
const CATEGORIES = ["Coffee", "Milk Tea", "Frappe", "Others"]
const FILTERS = ["All", ...CATEGORIES]


const QUICK_TENDER = [20, 50, 100, 200, 500, 1000]


const NOTE_OPTIONS = ["Less Ice", "No Sugar", "50% Sugar", "Extra Shot (+₱20)", "Pearls (+₱15)"]


function useTender(tenderRaw, total) {
  return useMemo(() => {
    const amount = round2(parseFloat(tenderRaw) || 0)
    const { change, sufficient } = changeFor(amount, total)
    return { raw: tenderRaw, amount, change, sufficient }
  }, [tenderRaw, total])
}

function CashTendered({
  tender,
  onChange,
  total,
  idPrefix,
}) {
  const quick = [total, ...QUICK_TENDER.filter((v) => v > total)]
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-tender`}>Cash tendered</Label>
      <Input
        id={`${idPrefix}-tender`}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        placeholder="0.00"
        value={tender.raw}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
      />
      <div className="flex flex-wrap gap-1.5">
        {quick.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(String(v))}
            className="rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors hover:bg-accent"
          >
            {v === total ? "Exact" : peso(v)}
          </button>
        ))}
      </div>
    </div>
  )
}


function MoneySummary({
  breakdown,
  change,
  sufficient,
}) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal</span>
        <span className="font-semibold tabular-nums text-foreground">{peso(breakdown.subtotal)}</span>
      </div>
      {breakdown.amount > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Discount</span>
          <span className="font-semibold tabular-nums text-foreground">−{peso(breakdown.amount)}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="text-lg font-bold">Total</span>
        <span className="text-2xl font-bold tabular-nums">{peso(breakdown.total)}</span>
      </div>
      <div className="flex justify-between font-bold">
        <span>Change</span>
        <span className={cn("tabular-nums", !sufficient && "text-destructive")}>
          {sufficient ? peso(change) : `Short by ${peso(Math.abs(change))}`}
        </span>
      </div>
    </div>
  )
}


function EmptyOrderArt() {
  return (
    <svg viewBox="0 0 120 120" className="size-28" role="img" aria-label="Empty cup" fill="none">
      <ellipse cx="60" cy="102" rx="38" ry="7" className="fill-secondary" />
      <path d="M32 54h52v18a26 26 0 0 1-26 26h0a26 26 0 0 1-26-26V54Z" className="fill-card stroke-primary" strokeWidth="4" strokeLinejoin="round" />
      <path d="M84 60h6a9 9 0 0 1 0 18h-8" className="stroke-primary" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 62h52" className="stroke-primary/40" strokeWidth="3" />
      <path d="M46 40c-4-5 4-8 0-14M60 40c-4-5 4-8 0-14M74 40c-4-5 4-8 0-14" className="stroke-primary/60" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="96" cy="30" r="3" className="fill-primary/30" />
      <circle cx="22" cy="40" r="2.5" className="fill-primary/30" />
    </svg>
  )
}

function CartPanel({
  tenderRaw,
  onTenderChange,
  onCheckout,
  discountType,
  onDiscountChange,
}) {
  const { cartLines, setQty, removeFromCart, previewDiscount } = useStore()
  const breakdown = previewDiscount(discountType)
  const tender = useTender(tenderRaw, breakdown.total)
  const canCheckout = cartLines.length > 0 && tender.sufficient
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-card p-5">
      <h2 className="text-2xl font-bold">Current Order</h2>
      <div className="mt-4 min-h-[8rem] flex-1 space-y-1 overflow-y-auto pr-1">
        {cartLines.length === 0 && (
          <div className="grid place-items-center gap-1 px-4 py-10 text-center">
            <EmptyOrderArt />
            <p className="mt-2 text-lg font-bold">No items yet</p>
            <p className="max-w-[16rem] text-sm text-muted-foreground">Tap the + on any drink to start a new order.</p>
          </div>
        )}
        {cartLines.map(({ item, qty }) => (
          <div key={item.id} className="border-b py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-bold">{item.name}</p>
              <p className="shrink-0 font-bold tabular-nums text-primary">{peso(item.price * qty)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <QuantityStepper value={qty} onChange={(n) => setQty(item.id, n)} />
              <button onClick={() => removeFromCart(item.id)} aria-label={`Remove ${item.name}`} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-3 border-t pt-4">
        {cartLines.length > 0 && (
          <>
            <DiscountPicker
              value={discountType}
              onChange={onDiscountChange}
              discountAmount={breakdown.amount}
              idPrefix="panel"
            />
            <MoneySummary breakdown={breakdown} change={tender.change} sufficient={tender.sufficient} />
            <CashTendered tender={tender} onChange={onTenderChange} total={breakdown.total} idPrefix="panel" />
          </>
        )}
        <Button className="h-14 w-full rounded-2xl text-base shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]" size="lg" disabled={!canCheckout} onClick={onCheckout}>
          <ShoppingBag className="!size-5" /> Checkout
        </Button>
        {cartLines.length > 0 && !tender.sufficient && (
          <p className="text-center text-xs text-muted-foreground">Enter the cash received to continue.</p>
        )}
      </div>
    </div>
  )
}

function CheckoutDialog({
  open,
  onOpenChange,
  tenderRaw,
  onTenderChange,
  discountType,
  onDiscountChange,
}) {
  const { cartLines, previewDiscount, placeOrder } = useStore()
  const navigate = useNavigate()
  const [phase, setPhase] = useState("review")
  const [note, setNote] = useState("")
  const [placed, setPlaced] = useState(null)

  const breakdown = previewDiscount(discountType)
  const tender = useTender(tenderRaw, breakdown.total)

  useEffect(() => {
    if (open) return
    const t = setTimeout(() => { setPhase("review"); setNote(""); setPlaced(null) }, 200)
    return () => clearTimeout(t)
  }, [open])

  async function pay() {
    setPhase("processing")
    
    await new Promise((r) => setTimeout(r, 1400))
    const order = await placeOrder(tender.amount, note.trim() || undefined, discountType)
    if (order) { setPlaced(order); setPhase("done") } else { setPhase("review"); toast.error("Order could not be placed. Please try again.") }
  }

  const exact = tender.sufficient && tender.change === 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (phase !== "processing") onOpenChange(o) }}>
      <DialogContent>
        {phase === "done" && placed ? (
          <div className="grid justify-items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-14 text-primary" />
            <DialogTitle>Order placed</DialogTitle>
            <DialogDescription>
              Your order <b className="text-foreground">{orderNo(placed)}</b> was sent to the kitchen.
              {typeof placed.changeGiven === "number" && placed.changeGiven > 0 && (
                <> Return <b className="text-foreground">{peso(placed.changeGiven)}</b> change to the customer.</>
              )}
            </DialogDescription>
            <div className="w-full rounded-xl bg-muted p-3 text-sm">
              {Object.values(placed.items).map((i) => <div key={i.menuItemId} className="flex justify-between py-0.5"><span>{i.qty} × {i.name}</span><span>{peso(i.qty * i.price)}</span></div>)}
              <div className="mt-2 space-y-0.5 border-t pt-2">
                <div className="flex justify-between"><span>Subtotal</span><span>{peso(placed.subtotal ?? placed.total)}</span></div>
                {(placed.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span>−{peso(placed.discountAmount ?? 0)}</span></div>
                )}
                <div className="flex justify-between font-bold"><span>Total</span><span>{peso(placed.total)}</span></div>
                <div className="flex justify-between"><span>Cash tendered</span><span>{peso(placed.cashTendered ?? 0)}</span></div>
                <div className="flex justify-between font-bold"><span>Change</span><span>{peso(placed.changeGiven ?? 0)}</span></div>
              </div>
            </div>
            <DialogFooter className="w-full">
              <Button variant="outline" onClick={() => { onOpenChange(false); navigate("/history") }}>View history</Button>
              <Button onClick={() => onOpenChange(false)}>Order more</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Checkout</DialogTitle>
              <DialogDescription>Confirm the cash received and the change before sending to the kitchen.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1 rounded-xl bg-muted p-3 text-sm">
              {cartLines.map(({ item, qty }) => <div key={item.id} className="flex justify-between"><span>{qty} × {item.name}</span><span>{peso(qty * item.price)}</span></div>)}
            </div>
            <DiscountPicker
              value={discountType}
              onChange={onDiscountChange}
              discountAmount={breakdown.amount}
              idPrefix="dialog"
              disabled={phase === "processing"}
            />
            <div className="rounded-xl border-2 border-dashed p-3">
              <MoneySummary breakdown={breakdown} change={tender.change} sufficient={tender.sufficient} />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {tender.sufficient
                  ? exact ? "Exact amount — no change needed." : `Hand ${peso(tender.change)} back to the customer.`
                  : "Cash received does not cover the total yet."}
              </p>
            </div>
            <CashTendered tender={tender} onChange={onTenderChange} total={breakdown.total} idPrefix="dialog" />
            <div className="flex flex-wrap gap-2">
              {NOTE_OPTIONS.map((opt) => (
                <Button key={opt} type="button" variant="outline" size="sm" onClick={() => setNote((prev) => (prev ? prev + "; " + opt : opt))}>{opt}</Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Note for the kitchen (optional)</Label>
              <Input id="note" placeholder="Less ice, no sugar…" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} disabled={phase === "processing"} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={phase === "processing"}>Back</Button>
              <Button onClick={pay} disabled={phase === "processing" || cartLines.length === 0 || !tender.sufficient}>
                {phase === "processing" ? <><Loader2 className="animate-spin" /> Processing…</> : `Confirm & send to kitchen`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function OrderPage() {
  const { menu, addToCart, cartCount, cartLines } = useStore()
  const filters = useMenuFilters()
  const [category, setCategory] = useState("All")
  const [tenderRaw, setTenderRaw] = useState("")
  const [discountType, setDiscountType] = useState("none")
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)

  const cartQtyMap = useMemo(() => {
    const m = {}
    cartLines.forEach((l) => { m[l.menuItemId] = (m[l.menuItemId] ?? 0) + l.qty })
    return m
  }, [cartLines])

  const items = useMemo(() => {
    const term = filters.q.trim().toLowerCase()
    const matched = menu.filter(
      (m) => (category === "All" || m.category === category) && m.name.toLowerCase().includes(term)
    )
    return applyMenuFilters(matched, filters)
  }, [menu, filters.q, filters.avail, filters.sort, category])

  
  
  
  useEffect(() => {
    if (cartCount === 0) {
      setTenderRaw("")
      setDiscountType("none")
    }
  }, [cartCount])

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 lg:px-6">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Menu categories">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={category === f}
              onClick={() => setCategory(f)}
              className={cn(
                "rounded-full px-6 py-2 text-sm font-semibold transition-colors",
                category === f ? "bg-sidebar-active text-sidebar-foreground shadow-md" : "border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            {filters.q ? `No drinks match "${filters.q}". Try a different name or category.` : "No items to show. Try a different category or filter."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => {
              const inCart = cartQtyMap[item.id]
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.available}
                  onClick={() => addToCart(item.id)}
                  aria-label={`Add ${item.name} to order`}
                  className={cn(
                    "group relative flex min-h-[11rem] flex-col rounded-2xl border bg-card p-5 text-left shadow-md shadow-primary/5 transition-all",
                    "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    inCart && "border-primary ring-1 ring-primary",
                    !item.available && "cursor-not-allowed opacity-60 hover:border-border hover:shadow-sm"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="tag">{item.tag ?? item.category}</Badge>
                    {!item.available ? <Badge variant="destructive">Sold out</Badge> : inCart ? <Badge>{inCart} in order</Badge> : null}
                  </div>
                  <h3 className="mt-3 text-lg font-bold leading-tight">{item.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <p>
                      <span className="text-2xl font-bold tabular-nums text-primary">{peso(item.price)}</span>
                      <span className="ml-2 text-sm text-muted-foreground">/ 1 pcs</span>
                    </p>
                    <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-sidebar-active text-sidebar-foreground shadow-md transition-transform group-hover:scale-110 group-active:scale-95">
                      <Plus className="size-5" strokeWidth={2.5} />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {}
      <aside className="hidden w-[22rem] shrink-0 border-l xl:block">
        <CartPanel
          tenderRaw={tenderRaw}
          onTenderChange={setTenderRaw}
          onCheckout={() => setCheckoutOpen(true)}
          discountType={discountType}
          onDiscountChange={setDiscountType}
        />
      </aside>

      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 right-4 z-30 flex items-center gap-3 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground shadow-xl lg:bottom-6 xl:hidden"
        >
          <ShoppingBag className="size-5" /> {cartCount} {cartCount === 1 ? "item" : "items"}
        </button>
      )}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-hidden rounded-2xl p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Current order</DialogTitle>
          <CartPanel
            tenderRaw={tenderRaw}
            onTenderChange={setTenderRaw}
            onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
            discountType={discountType}
            onDiscountChange={setDiscountType}
          />
        </DialogContent>
      </Dialog>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        tenderRaw={tenderRaw}
        onTenderChange={setTenderRaw}
        discountType={discountType}
        onDiscountChange={setDiscountType}
      />
    </div>
  )
}
