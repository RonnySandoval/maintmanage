import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { applyFontScale, getStoredFontScale, persistFontScale } from '../lib/fontScale'

interface FontScaleValue {
  scale: number
  setScale: (scale: number) => void
}

const FontScaleContext = createContext<FontScaleValue | null>(null)

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState(() => {
    const initial = getStoredFontScale()
    applyFontScale(initial)
    return initial
  })

  const value = useMemo(
    () => ({
      scale,
      setScale(next: number) {
        setScaleState(persistFontScale(next))
      },
    }),
    [scale],
  )

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>
}

export function useFontScale() {
  const ctx = useContext(FontScaleContext)
  if (!ctx) throw new Error('useFontScale debe usarse dentro de FontScaleProvider')
  return ctx
}
