const KEY = 'mm-font-scale'

export const FONT_SCALE_MIN = 0.85
export const FONT_SCALE_MAX = 1.3
export const FONT_SCALE_STEP = 0.05
export const FONT_SCALE_DEFAULT = 1

/** The year grid grows/shrinks less than the rest of the app. */
export function gridFontScale(scale: number): number {
  return 1 + (scale - 1) * 0.4
}

export function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return FONT_SCALE_DEFAULT
  const stepped = Math.round(value / FONT_SCALE_STEP) * FONT_SCALE_STEP
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Number(stepped.toFixed(2))))
}

export function getStoredFontScale(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null || raw === '') return FONT_SCALE_DEFAULT
    return clampFontScale(Number(raw))
  } catch {
    return FONT_SCALE_DEFAULT
  }
}

export function applyFontScale(scale: number): number {
  const next = clampFontScale(scale)
  const root = document.documentElement
  const grid = gridFontScale(next)
  root.style.setProperty('--font-scale', String(next))
  root.style.setProperty('--grid-font-dampen', String(grid / next))
  return next
}

export function persistFontScale(scale: number): number {
  const next = applyFontScale(scale)
  try {
    localStorage.setItem(KEY, String(next))
  } catch {
    /* ignore quota / private mode */
  }
  return next
}
