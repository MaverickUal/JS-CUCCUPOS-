import { useRef, useState } from "react"
import { toast } from "sonner"

/**
 * Shared submit state for confirmation dialogs: `busy`, `error`, and a `run`
 * that ignores re-entry, reports a failed `{ success, message }` result as an
 * inline error plus a toast, and resolves to the result on success (else null).
 */
export function useGuardedSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // A ref, not state: two fast clicks can both read `busy === false` before React re-renders.
  const inFlight = useRef(false)

  async function run(action) {
    if (inFlight.current) return null
    inFlight.current = true
    setBusy(true)
    setError("")
    let res
    try {
      res = await action()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
    if (!res.success) {
      setError(res.message)
      toast.error(res.message)
      return null
    }
    return res
  }

  return { busy, error, setError, run }
}
