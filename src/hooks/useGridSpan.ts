import { useEffect, useState } from 'react'

export type GridSpan = 'year' | 'semester' | 'quarter'

export function spanFromWidth(width: number): GridSpan {
  if (width >= 1100) return 'year'
  if (width >= 740) return 'semester'
  return 'quarter'
}

export function monthsVisible(span: GridSpan): number {
  if (span === 'year') return 12
  if (span === 'semester') return 6
  return 3
}

export function windowStartForMonth(monthIndex: number, visible: number): number {
  const maxStart = Math.max(0, 12 - visible)
  return Math.min(Math.floor(monthIndex / 3) * 3, maxStart)
}

export function useGridSpan(): GridSpan {
  const [span, setSpan] = useState<GridSpan>(() =>
    typeof window === 'undefined' ? 'quarter' : spanFromWidth(window.innerWidth),
  )

  useEffect(() => {
    const onResize = () => setSpan(spanFromWidth(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return span
}
