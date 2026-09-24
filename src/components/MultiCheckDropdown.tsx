import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface CheckOption<T extends string = string> {
  value: T
  label: string
}

/**
 * Simula un dropdown clásico pero con checkboxes para elegir varios.
 * Reutiliza las clases `bloque-select-*` para verse igual que los
 * desplegables de la app. Vacío = Todos (sin filtro).
 */
export function MultiCheckDropdown<T extends string>({
  id,
  label,
  options,
  selected,
  onChange,
  allLabel = 'Todos',
  multiLabel = (n: number) => `${n} elegidos`,
}: {
  id?: string
  label: string
  options: CheckOption<T>[]
  selected: T[]
  onChange: (next: T[]) => void
  allLabel?: string
  multiLabel?: (n: number) => string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open ])

  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    )
  }

  const isAll = selected.length === 0 || selected.length >= options.length
  const summary = isAll
    ? allLabel
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? allLabel)
      : multiLabel(selected.length)

  return (
    <div className={`bloque-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        className="bloque-select-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="bloque-select-label">{summary}</span>
        <ChevronDown
          size={16}
          aria-hidden
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : undefined,
          }}
        />
      </button>
      {open ? (
        <div
          className="bloque-select-menu"
          role="group"
          aria-label={label}
          style={{ minWidth: '100%' }}
        >
          <label className="bloque-select-option">
            <input
              type="checkbox"
              checked={isAll}
              onChange={() => onChange([])}
            />
            <span>{allLabel}</span>
          </label>
          {options.map((opt) => (
            <label key={opt.value} className="bloque-select-option">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}
