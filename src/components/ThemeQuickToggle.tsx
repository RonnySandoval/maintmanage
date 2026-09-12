import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '../db/types'
import { resolvedTheme } from '../lib/theme'
import { useTheme } from '../hooks/useTheme'

const CYCLE: ThemeMode[] = ['light', 'dark', 'system']

const NEXT_LABEL: Record<ThemeMode, string> = {
  light: 'Activar modo oscuro',
  dark: 'Usar el tema del sistema',
  system: 'Activar modo claro',
}

export function ThemeQuickToggle() {
  const { mode, setTheme } = useTheme()
  const resolved = resolvedTheme(mode)
  const next = CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length]

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={NEXT_LABEL[next]}
      title={
        mode === 'system'
          ? `Tema del sistema (${resolved === 'dark' ? 'oscuro' : 'claro'})`
          : mode === 'dark'
            ? 'Tema oscuro'
            : 'Tema claro'
      }
      onClick={() => setTheme(next)}
    >
      {mode === 'system' ? <Monitor size={18} /> : resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
