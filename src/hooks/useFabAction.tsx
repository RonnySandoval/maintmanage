import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { LucideIcon } from 'lucide-react'

/** Acción rápida de la vista actual que se muestra flotando sobre el FAB «+». */
export interface FabAction {
  /** Nombre corto que acompaña al icono, p. ej. «Generar» o «Guardar». */
  label: string
  icon: LucideIcon
  onClick: () => void
}

interface FabActionContextValue {
  action: FabAction | null
  setAction: (action: FabAction | null) => void
}

const FabActionContext = createContext<FabActionContextValue | null>(null)

export function FabActionProvider({ children }: { children: ReactNode }) {
  const [action, setActionState] = useState<FabAction | null>(null)
  const setAction = useCallback((next: FabAction | null) => setActionState(next), [])
  const value = useMemo(() => ({ action, setAction }), [action, setAction])
  return <FabActionContext.Provider value={value}>{children}</FabActionContext.Provider>
}

/**
 * Registra la acción flotante de la vista actual. Se limpia al desmontar o al
 * cambiar de acción. Igual que FilterDrawerSlot: la página «publica» su acción
 * y el FAB global la dibuja.
 */
export function FabActionSlot({ action }: { action: FabAction | null }) {
  const setAction = useContext(FabActionContext)?.setAction
  useEffect(() => {
    if (!setAction) return
    setAction(action)
    return () => setAction(null)
  }, [action, setAction])
  return null
}

// eslint-disable-next-line react/only-export-components -- el archivo mezcla componente y hook, como useFilterDrawer
export function useFabAction(): FabAction | null {
  return useContext(FabActionContext)?.action ?? null
}