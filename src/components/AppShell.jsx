import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Bell, BarChart3, Check, ClipboardList, Coffee, CupSoda, History, LayoutDashboard, LayoutGrid, LogOut, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Search, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AVAIL_OPTIONS, SORT_OPTIONS, useMenuFilters } from "@/lib/useMenuFilters"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useStore } from "@/store/AppStore"
import { orderNo, peso } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

const customerNav = [
  { to: "/order", label: "Order", icon: LayoutGrid },
  { to: "/history", label: "History", icon: History },
]
const adminNav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/menu", label: "Menu", icon: CupSoda },
  { to: "/admin/cashiers", label: "Cashiers", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
]

function NotificationBell({ variant }) {
  const { orders, currentUser } = useStore()
  const navigate = useNavigate()
  const items =
    variant === "admin"
      ? orders.filter((o) => o.status === "pending" || o.status === "pending_void")
      : orders.filter((o) => o.customerId === currentUser?.id && o.status === "ready")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative min-h-[44px] min-w-[44px] rounded-lg p-2 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Notifications (${items.length})`}>
          <Bell className="size-5 fill-current" />
          {items.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500 ring-2 ring-background" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{variant === "admin" ? "New orders and void requests" : "Ready for pickup"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">You're all caught up.</p>}
        {items.slice(0, 5).map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => navigate(variant === "admin" ? "/admin/orders" : "/history")} className="flex-col items-start gap-0">
            <span className="font-semibold">{variant === "admin" ? (o.status === "pending_void" ? `${orderNo(o)} · void requested by ${o.customerName}` : `${orderNo(o)} from ${o.customerName}`) : `${orderNo(o)} is ready`}</span>
            <span className="text-xs text-muted-foreground">{peso(o.total)} · {Object.values(o.items).reduce((s, i) => s + i.qty, 0)} items</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FilterMenu() {
  const { avail, setAvail, sort, setSort, isFiltered } = useMenuFilters()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="shrink-0 rounded-xl px-5" aria-label="Filter menu">
          Filter
          {isFiltered && <span className="size-1.5 rounded-full bg-primary-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        {AVAIL_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => setAvail(o.value)} className="justify-between">
            {o.label}
            {avail === o.value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        {SORT_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => setSort(o.value)} className="justify-between">
            {o.label}
            {sort === o.value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TopSearch() {
  const { q, setQ } = useMenuFilters()
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-xl">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search menu items"
          placeholder="Search category or menu"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 rounded-xl border-transparent bg-muted pl-10 shadow-none"
        />
      </div>
      <FilterMenu />
    </div>
  )
}

const SIDEBAR_KEY = "cuccupos.sidebar.expanded"

/** Icon rail that expands to show labels. Shared by the desktop sidebar and the mobile drawer. */
function SideNav({ nav, expanded, onToggle, onNavigate, onLogout, closeIcon }) {
  const location = useLocation()
  const item = "flex h-11 w-full items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
  const layout = expanded ? "justify-start gap-3 px-3" : "justify-center"
  return (
    <>
      <div className={cn("mb-4 flex items-center", expanded ? "justify-between gap-2" : "flex-col gap-3")}>
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm" title="CuccuPOS">
            <Coffee className="size-5" strokeWidth={2.5} />
          </span>
          {expanded && <span className="text-xl font-bold tracking-tight">Cuccu<span className="text-primary">POS</span></span>}
        </div>
        <button
          onClick={onToggle}
          title={closeIcon ? "Close menu" : expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={closeIcon ? "Close menu" : expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={closeIcon ? undefined : expanded}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {closeIcon ? <X className="size-5" /> : expanded ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}
        </button>
      </div>
      {nav.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={expanded ? undefined : label}
          aria-label={label}
          aria-current={location.pathname === to ? "page" : undefined}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(item, layout, isActive && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground")
          }
        >
          <Icon className="size-5 shrink-0" />
          {expanded && <span className="truncate text-sm font-semibold">{label}</span>}
        </NavLink>
      ))}
      <button onClick={onLogout} title={expanded ? undefined : "Log out"} aria-label="Log out" className={cn(item, layout, "mt-auto")}>
        <LogOut className="size-5 shrink-0" />
        {expanded && <span className="truncate text-sm font-semibold">Log out</span>}
      </button>
    </>
  )
}

/** Shared layout for both roles: slim icon rail, top bar, full-height content. */
function Shell({ variant }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { currentUser, logout } = useStore()
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "1" } catch { return false }
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, expanded ? "1" : "0") } catch { /* storage unavailable */ }
  }, [expanded])
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawerOpen])
  const doLogout = () => { logout(); navigate("/login") }
  const isAdmin = variant === "admin"
  const nav = isAdmin ? adminNav : customerNav
  const onOrder = !isAdmin && pathname.startsWith("/order")
  const active = nav.find((n) => pathname.startsWith(n.to)) ?? nav[0]
  const ActiveIcon = active.icon
  const name = isAdmin ? "Owner/Manager" : currentUser?.name ?? "Cashier"
  const firstName = isAdmin ? name : name.split(" ")[0]

  return (
    <div className="flex h-screen overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      {/* Desktop sidebar: icon rail that expands to show labels */}
      <aside className={cn("hidden shrink-0 flex-col gap-2 border-r bg-card px-3 py-5 transition-[width] duration-200 lg:flex print:hidden", expanded ? "w-60" : "w-[72px]")}>
        <SideNav nav={nav} expanded={expanded} onToggle={() => setExpanded((v) => !v)} onLogout={doLogout} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setDrawerOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-2 bg-card px-3 py-5 shadow-2xl" role="dialog" aria-label="Navigation">
            <SideNav nav={nav} expanded closeIcon onToggle={() => setDrawerOpen(false)} onNavigate={() => setDrawerOpen(false)} onLogout={doLogout} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3 lg:px-6 print:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="grid size-11 shrink-0 place-items-center rounded-xl border bg-background text-foreground lg:hidden"
            >
              <MenuIcon className="size-5" />
            </button>
            {onOrder ? (
              <TopSearch />
            ) : (
              <div className="flex items-center gap-3">
                <ActiveIcon className="size-6" />
                <h1 className="text-2xl font-bold">{active.label}</h1>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
                  <span className="grid size-10 place-items-center rounded-full bg-secondary text-sm font-bold text-foreground">
                    {firstName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden leading-tight sm:block">
                    <span className="block max-w-[11rem] truncate text-sm font-bold">Welcome, {firstName}!</span>
                    <span className="block text-xs text-muted-foreground">{isAdmin ? "Admin" : "Cashier"} on CuccuPOS</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="flex flex-col">
                  {name}
                  <span className="text-xs font-normal text-muted-foreground">{currentUser?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={doLogout}>
                  <LogOut /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="rounded-xl border bg-background">
              <NotificationBell variant={variant} />
            </span>
          </div>
        </header>

        <main className={cn("min-h-0 flex-1 pb-16 lg:pb-0 print:overflow-visible print:p-0", onOrder ? "overflow-hidden" : "overflow-y-auto px-4 py-5 lg:px-8")}>
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card lg:hidden print:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn("flex min-h-[44px] flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-muted-foreground", isActive && "text-primary")
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function AppShell({ variant }) {
  return <Shell variant={variant} />
}
