import { cn } from "@/lib/utils"

/** CuccuPOS mark from /public/cuccupos-logo.svg. */
export function Logo({ tone = "light", className }) {
  const light = tone === "light"
  return (
    <div className={cn("flex items-center gap-2.5 text-2xl font-bold tracking-tight", className)}>
      <img src="/cuccupos-logo.svg" alt="CuccuPOS" className="size-10 shrink-0" />
      <span className={light ? "text-sidebar-foreground" : "text-foreground"}>
        Cuccu<span className={light ? "text-foreground" : "text-primary"}>POS</span>
      </span>
    </div>
  )
}
