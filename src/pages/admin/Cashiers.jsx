import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useStore } from "@/store/AppStore"
import { formatDate } from "@/lib/format"
import { roleLabel } from "@/lib/roles"

export default function AdminCashiers() {
  const { users, orders, currentUser, setCashierEnabled } = useStore()
  const [search, setSearch] = useState("")

  const rows = useMemo(() => {
    const map = new Map()
    
    
    
    users.forEach((u) =>
      map.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        orders: 0,
        disabled: u.disabled === true,
      })
    )
    
    
    orders.forEach((o) => {
      const r = map.get(o.customerId) ?? { id: o.customerId, name: o.customerName, orders: 0, disabled: false }
      if (o.status !== "cancelled") r.orders += 1
      if (!r.last || o.createdAt > r.last) r.last = o.createdAt
      map.set(o.customerId, r)
    })
    const q = search.trim().toLowerCase()
    return [...map.values()]
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(a.disabled) - Number(b.disabled) ||
          roleLabel(a.role).localeCompare(roleLabel(b.role)) ||
          b.orders - a.orders
      )
  }, [users, orders, search])

  return (
    <div className="space-y-5 px-3 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.filter((r) => r.role === "cashier" && !r.disabled).length} active cashiers ·{" "}
          {rows.filter((r) => r.role === "admin").length} Owner/Manager ·{" "}
          {rows.filter((r) => r.disabled).length} disabled
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search cashiers" className="pl-9" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="text-xs text-muted-foreground">
            Cashier accounts are provisioned manually in the Firebase Console. See MANUAL_SETUP_AND_DEPLOYMENT.md.
          </span>
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead>Last order</TableHead>
              <TableHead className="text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No staff accounts found.</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const isSelf = r.id === currentUser?.id
              const isOwner = r.role === "admin"
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold">
                    <span className="flex items-center gap-2">
                      {r.name}
                      {isSelf && <Badge variant="secondary">You</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {}
                    <Badge variant={isOwner ? "default" : "tag"}>{roleLabel(r.role)}</Badge>
                  </TableCell>
                  <TableCell>{r.email ?? <Badge variant="secondary">No account</Badge>}</TableCell>
                  <TableCell>
                    {r.disabled ? <Badge variant="destructive">Disabled</Badge> : <Badge variant="secondary">Active</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{r.orders}</TableCell>
                  <TableCell className="text-muted-foreground">{r.last ? formatDate(r.last) : "No orders yet"}</TableCell>
                  <TableCell className="text-right">
                    {r.email && !isOwner ? (
                      <Switch
                        checked={!r.disabled}
                        disabled={isSelf}
                        onCheckedChange={(on) => setCashierEnabled(r.id, on)}
                        aria-label={`${r.disabled ? "Re-enable" : "Disable"} ${r.name}`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {isOwner ? "Managed in console" : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Disabling a cashier blocks sign-in but keeps their orders and refunds intact for the audit trail.
        You can't disable your own account, so the shop always keeps an administrator. Accounts are
        managed by role, not deleted — promoting someone to Owner/Manager is a deliberate act done in
        the Firebase console, not from this screen.
      </p>

      <p className="text-xs text-muted-foreground">
        Disabling uses the RTDB profile flag only. It blocks access to CuccuPOS but does not disable the underlying Firebase Authentication account.
      </p>
    </div>
  )
}

