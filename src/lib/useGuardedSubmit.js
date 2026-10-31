import { useRef, useState } from "react"
import { toast } from "sonner"


export function useGuardedSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  
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
