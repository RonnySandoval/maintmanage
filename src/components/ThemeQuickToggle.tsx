import { Moon, Sun } from 'lucide-react'
import { resolvedTheme } from '../lib/theme'
import { useTheme } from '../hooks/useTheme'

export function ThemeQuickToggle() {
  const { mode, setTheme } = useTheme()
  const resolved = resolvedTheme(mode)
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={next === 'dark' ? 'Activar modo oscuro' : 'Activar modo claro'}
      onClick={() => setTheme(next)}
    >
      {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
