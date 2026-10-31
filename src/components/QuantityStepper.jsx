import { useEffect, useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { MAX_QTY } from "@/store/AppStore"


export function QuantityStepper({ value, onChange }) {
  const [draft, setDraft] = useState(String(value))
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef(null)

  const editing = useRef(false)
  const committed = useRef(value)

  
  
  
  useEffect(() => {
    if (editing.current) return
    committed.current = value
    setDraft(String(value))
    setInvalid(false)
  }, [value])

  
  function base() {
    if (!editing.current) return committed.current
    return parseQty(draft) ?? committed.current
  }

  function commit() {
    editing.current = false
    const next = parseQty(draft)
    if (next === null) {
      
      setDraft(String(committed.current))
      setInvalid(true)
      return
    }
    setInvalid(false)
    committed.current = next
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  
  function bump(delta) {
    const next = Math.max(1, Math.min(MAX_QTY, base() + delta))
    editing.current = false
    committed.current = next
    setDraft(String(next))
    setInvalid(false)
    if (next !== value) onChange(next)
  }

  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-input bg-background">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= 1 && !editing.current}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => bump(-1)}
        className="grid size-7 place-items-center transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="size-3" />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Quantity"
        aria-invalid={invalid || undefined}
        value={draft}
        onFocus={(e) => {
          editing.current = true
          e.currentTarget.select()
        }}
        onChange={(e) => {
          
          setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))
          setInvalid(false)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
            inputRef.current?.blur()
          } else if (e.key === "Escape") {
            e.preventDefault()
            editing.current = false
            setDraft(String(committed.current))
            setInvalid(false)
            inputRef.current?.blur()
          }
        }}
        className={`w-10 border-x border-input bg-transparent text-center text-sm font-bold tabular-nums outline-none focus:bg-accent/50 ${invalid ? "text-destructive" : ""}`}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= MAX_QTY && !editing.current}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => bump(1)}
        className="grid size-7 place-items-center transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-3" />
      </button>
    </div>
  )
}


export function parseQty(raw) {
  const trimmed = raw.trim()
  if (!trimmed || !/\d/.test(trimmed)) return null
  const n = parseInt(trimmed, 10)
  if (!Number.isFinite(n)) return null
  return Math.max(1, Math.min(MAX_QTY, n))
}