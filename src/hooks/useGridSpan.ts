import { useEffect, useState } from 'react'

export type GridSpan = 'year' | 'three_quarter' | 'semester' | 'quarter'

export function spanFromWidth(width: number): GridSpan {
  if (width >= 1180) return 'year'
  if (width >= 920) return 'three_quarter'
  if (width >= 740) return 'semester'
  return 'quarter'
}

export function monthsVisible(span: GridSpan): number {
  if (span === 'year') return 12
  if (span === 'three_quarter') return 9
  if (span === 'semester') return 6
  return 3
}

export type ZoomLevel = 0 | 1 | 2 | 3

export const ZOOM_IN_MAX: ZoomLevel = 3

export function spanFromZoom(zoom: ZoomLevel): GridSpan {
  if (zoom === 0) return 'year'
  if (zoom === 1) return 'three_quarter'
  if (zoom === 2) return 'semester'
  return 'quarter'
}

export function zoomFromSpan(span: GridSpan): ZoomLevel {
  if (span === 'year') return 0
  if (span === 'three_quarter') return 1
  if (span === 'semester') return 2
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
