import { Badge } from "@/components/ui/badge"
const map = {
  pending: { label: "Pending", variant: "warning" },
  preparing: { label: "Preparing", variant: "info" },
  ready: { label: "Ready for pickup", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  pending_void: { label: "Pending Void", variant: "void" },
}

export function StatusBadge({ status }) {
  const m = map[status] ?? { label: String(status ?? "Unknown"), variant: "secondary" }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
