import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

const KEY = 'mm-accion-fechas'

interface AccionFechasValue {
  showFechas: boolean
  toggleFechas: () => void
}

const AccionFechasContext = createContext<AccionFechasValue | null>(null)

export function AccionFechasProvider({ children }: { children: ReactNode }) {
  const [showFechas, setShowFechas] = useState(() => localStorage.getItem(KEY) !== '0')
  const value = useMemo(
    () => ({
      showFechas,
      toggleFechas: () =>
        setShowFechas((was) => {
          const next = !was
          localStorage.setItem(KEY, next ? '1' : '0')
          return next
        }),
    }),
    [showFechas],
  )
  return <AccionFechasContext.Provider value={value}>{children}</AccionFechasContext.Provider>
}

export function useAccionFechas() {
  const ctx = useContext(AccionFechasContext)
  if (!ctx) throw new Error('useAccionFechas debe usarse dentro de AccionFechasProvider')
  return ctx
}
