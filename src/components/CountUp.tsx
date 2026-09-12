import { useEffect, useRef, useState } from 'react'

export function CountUp({
  value,
  ready,
  duration = 640,
}: {
  value: number
  ready: boolean
  duration?: number
}) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!ready) return
    const from = startedRef.current ? fromRef.current : 0
    startedRef.current = true
    const to = value
    if (from === to) {
      setDisplay(to)
      fromRef.current = to
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, ready, duration])

  return <span className="count-up">{display}</span>
}
