import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { LucideIcon } from 'lucide-react'

const STORAGE_KEY = 'maintmanage.filterDrawer'

function readPreferOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function writePreferOpen(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, open ? '1' : '0')
  } catch {
    // ignore
  }
}

export type FilterTool = {
  id: string
  label: string
  icon: LucideIcon
  content?: ReactNode
  onClick?: () => void
  active?: boolean
}

interface FilterDrawerContextValue {
  open: boolean
  available: boolean
  title: string
  tools: FilterTool[]
  activeTool: string | null
  setActiveTool: (id: string | null) => void
  setSlot: (slot: { title: string; tools: FilterTool[] } | null) => void
  setOpen: (value: boolean) => void
  toggle: () => void
}

const FilterDrawerContext = createContext<FilterDrawerContextValue | null>(null)

export function FilterDrawerProvider({ children }: { children: ReactNode }) {
  const [preferOpen, setPreferOpen] = useState(readPreferOpen)
  const [slot, setSlotState] = useState<{ title: string; tools: FilterTool[] } | null>(null)
  const [activeTool, setActiveTool] = useState<string | null>(null)

  const setOpen = useCallback((value: boolean) => {
    setPreferOpen(value)
    writePreferOpen(value)
    if (!value) setActiveTool(null)
  }, [])

  const toggle = useCallback(() => {
    setPreferOpen((was) => {
      const next = !was
      writePreferOpen(next)
      if (!next) setActiveTool(null)
      return next
    })
  }, [])

  const setSlot = useCallback((next: { title: string; tools: FilterTool[] } | null) => {
    setSlotState(next)
    setActiveTool((current) => {
      if (!current || !next?.tools.some((tool) => tool.id === current)) return null
      return current
    })
  }, [])

  const value = useMemo(
    () => ({
      open: preferOpen && Boolean(slot),
      available: Boolean(slot),
      title: slot?.title ?? 'Filtros',
      tools: slot?.tools ?? [],
      activeTool,
      setActiveTool,
      setSlot,
      setOpen,
      toggle,
    }),
    [preferOpen, slot, activeTool, setSlot, setOpen, toggle],
  )

  return <FilterDrawerContext.Provider value={value}>{children}</FilterDrawerContext.Provider>
}

export function useFilterDrawer() {
  const ctx = useContext(FilterDrawerContext)
  if (!ctx) throw new Error('useFilterDrawer debe usarse dentro de FilterDrawerProvider')
  return ctx
}

export function FilterDrawerSlot({
  title = 'Filtros',
  tools,
}: {
  title?: string
  tools: FilterTool[]
}) {
  const { setSlot } = useFilterDrawer()

  useLayoutEffect(() => {
    setSlot({ title, tools })
    return () => setSlot(null)
  }, [title, tools, setSlot])

  return null
}
