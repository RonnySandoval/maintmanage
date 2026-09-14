import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const KEY = 'mm-status-labels'

interface StatusLabelsValue {
  showLabels: boolean
  toggleLabels: () => void
}

const StatusLabelsContext = createContext<StatusLabelsValue | null>(null)

export function StatusLabelsProvider({ children }: { children: ReactNode }) {
  const [showLabels, setShowLabels] = useState(() => localStorage.getItem(KEY) !== '0')
  const toggleLabels = useCallback(() => {
    setShowLabels((current) => {
      const next = !current
      localStorage.setItem(KEY, next ? '1' : '0')
      return next
    })
  }, [])
  const value = useMemo(() => ({ showLabels, toggleLabels }), [showLabels, toggleLabels])
  return <StatusLabelsContext.Provider value={value}>{children}</StatusLabelsContext.Provider>
}

export function useStatusLabels() {
  const ctx = useContext(StatusLabelsContext)
  if (!ctx) throw new Error('useStatusLabels debe usarse dentro de StatusLabelsProvider')
  return ctx
}
