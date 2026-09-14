import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '../db/types'
import { useTheme } from '../hooks/useTheme'

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'system', label: 'Sistema', icon: Monitor },
]

export function ThemeModePicker() {
  const { mode, setTheme } = useTheme()
  return (
    <div className="seg-toggle compact icon-only" role="radiogroup" aria-label="Tema">
      {MODES.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={mode === item.id}
            aria-label={item.label}
            title={item.label}
            className={mode === item.id ? 'active' : ''}
            onClick={() => setTheme(item.id)}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
