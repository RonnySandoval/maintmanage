import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const KEY = 'mm-search-visible'

interface SearchBarValue {
  showSearch: boolean
  toggleSearch: () => void
}

const SearchBarContext = createContext<SearchBarValue | null>(null)

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function SearchBarProvider({ children }: { children: ReactNode }) {
  const [showSearch, setShowSearch] = useState(readStored)

  useEffect(() => {
    document.documentElement.dataset.busqueda = showSearch ? 'visible' : 'oculta'
  }, [showSearch])

  const toggleSearch = useCallback(() => {
    setShowSearch((current) => {
      const next = !current
      try {
        localStorage.setItem(KEY, next ? '1' : '0')
      } catch {
        // El toggle sigue funcionando aunque el almacenamiento esté bloqueado.
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ showSearch, toggleSearch }), [showSearch, toggleSearch])
  return <SearchBarContext.Provider value={value}>{children}</SearchBarContext.Provider>
}

export function useSearchBar() {
  const ctx = useContext(SearchBarContext)
  if (!ctx) throw new Error('useSearchBar debe usarse dentro de SearchBarProvider')
  return ctx
}
