import { useEffect, useRef, useState } from 'react'

export function useSettled<T>(value: T, enabled: boolean, delay = 240): T | null {
  const [settled, setSettled] = useState<T | null>(null)
  const latest = useRef(value)
  latest.current = value

  useEffect(() => {
    if (!enabled) return
    const id = window.setTimeout(() => setSettled(latest.current), delay)
    return () => window.clearTimeout(id)
  }, [value, enabled, delay])

  return settled
}
