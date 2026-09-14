import { useCallback, useMemo, useState } from 'react'
import { monthsVisible, type GridSpan } from './useGridSpan'

const KEY = 'mm-grid-name-col'
const DEFAULT_RATIO = 0.18

export function nameColBounds(wrapWidth: number, span: GridSpan): { min: number; max: number; monthMin: number } {
  const months = monthsVisible(span)
  const monthMin =
    span === 'year' ? 22 : span === 'three_quarter' ? 26 : span === 'semester' ? 34 : 44
  const min = span === 'year' ? 96 : span === 'three_quarter' ? 108 : span === 'semester' ? 124 : 140
  const cap = span === 'year' ? 280 : span === 'three_quarter' ? 340 : span === 'semester' ? 400 : 460
  const room = wrapWidth > 0 ? wrapWidth - months * monthMin - 8 : cap
  const max = Math.max(min, Math.min(cap, room))
  return { min, max, monthMin }
}

function readRatio(): number {
  try {
    const raw = Number(localStorage.getItem(KEY))
    if (!Number.isFinite(raw)) return DEFAULT_RATIO
    return Math.min(1, Math.max(0, raw))
  } catch {
    return DEFAULT_RATIO
  }
}

function persistRatio(ratio: number) {
  try {
    localStorage.setItem(KEY, String(Math.round(ratio * 1000) / 1000))
  } catch {
    /* ignore quota / private mode */
  }
}

export function useGridNameCol(wrapWidth: number, span: GridSpan) {
  const { min, max, monthMin } = useMemo(() => nameColBounds(wrapWidth, span), [wrapWidth, span])
  const [ratio, setRatio] = useState(readRatio)
  const width = Math.round(min + ratio * (max - min))
  const canResize = max > min + 8
  const showFullText = width >= min + 16

  const setWidth = useCallback(
    (px: number) => {
      const next = Math.min(max, Math.max(min, px))
      const nextRatio = max === min ? 0 : (next - min) / (max - min)
      setRatio(nextRatio)
      persistRatio(nextRatio)
    },
    [min, max],
  )

  const reset = useCallback(() => {
    setRatio(DEFAULT_RATIO)
    persistRatio(DEFAULT_RATIO)
  }, [])

  return { width, min, max, monthMin, canResize, showFullText, setWidth, reset }
}
