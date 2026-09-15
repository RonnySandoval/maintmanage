import { useEffect, useRef, useState } from 'react'

/**
 * Anima el progreso hacia el tramo del paso activo: sube con suavidad al cambiar
 * de paso y avanza lentamente hacia el techo mientras el paso sigue en curso.
 */
export function useSmoothProgress(
  floor: number,
  ceiling: number,
  enabled: boolean,
): number {
  const [value, setValue] = useState(0)
  const valueRef = useRef(0)
  const boundsRef = useRef({ floor, ceiling })

  useEffect(() => {
    boundsRef.current = { floor, ceiling }
  }, [floor, ceiling])

  useEffect(() => {
    if (!enabled) {
      valueRef.current = 0
      setValue(0)
      return
    }

    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(now - last, 48) / 1000
      last = now

      const { floor: min, ceiling: max } = boundsRef.current
      let next = valueRef.current

      if (next < min) {
        next += (min - next) * (1 - Math.exp(-dt * 4.2))
      } else if (next < max - 0.25) {
        const room = max - next
        const rate = Math.max(0.28, room * 0.06)
        next += rate * dt
      }

      next = Math.min(next, max >= 99.5 ? max : max - 0.25)
      valueRef.current = next
      setValue(next)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled, floor, ceiling])

  return value
}
