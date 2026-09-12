import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Bloque } from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { menuMaxCh } from '../lib/dropdownWidth'

const NO_HINTS: string[] = []

export function BloqueSelect({
  id,
  value,
  bloques,
  onChange,
  placeholder = 'Seleccionar…',
  widthHints = NO_HINTS,
}: {
  id?: string
  value: string
  bloques: Bloque[]
  onChange: (id: string) => void
  placeholder?: string
  widthHints?: string[]
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = bloques.find((b) => b.id === value)
  const options = useMemo(
    (): { id: string; nombre: string; color?: string }[] => [
      { id: '', nombre: placeholder },
      ...bloques.map((b) => ({ id: b.id, nombre: b.nombre, color: b.color })),
    ],
    [bloques, placeholder],
  )
  const maxCh = useMemo(
    () => menuMaxCh([...options.map((o) => o.nombre), ...widthHints]),
    [options, widthHints],
  )

  function highlightFor(nextValue: string) {
    const selectedIndex = options.findIndex((o) => o.id === nextValue)
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
  }

  function toggleOpen() {
    if (!open) highlightFor(value)
    setOpen((was) => !was)
  }

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
  }, [open])

  function choose(nextId: string) {
    onChange(nextId)
    setOpen(false)
  }

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        highlightFor(value)
        setOpen(true)
      }
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleOpen()
    }
  }

  function onListKey(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % options.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const opt = options[active]
      if (opt) choose(opt.id)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className={`bloque-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        className="bloque-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggleOpen}
        onKeyDown={onTriggerKey}
      >
        {selected ? (
          <>
            <span className="color-dot" style={{ background: bloqueColorVar(selected.color) }} />
            <span className="bloque-select-label" style={{ color: bloqueColorVar(selected.color) }}>
              {selected.nombre}
            </span>
          </>
        ) : (
          <span className="bloque-select-placeholder">{placeholder}</span>
        )}
      </button>
      {open ? (
        <ul
          id={listId}
          className="bloque-select-menu"
          role="listbox"
          aria-label="Bloque"
          tabIndex={-1}
          style={{ maxWidth: `max(100%, min(calc(${maxCh}ch + 2.4rem), calc(100vw - 1.5rem)))` }}
          onKeyDown={onListKey}
        >
          {options.map((opt, index) => {
            const isSelected = opt.id === value
            const color = opt.color ? bloqueColorVar(opt.color) : undefined
            return (
              <li key={opt.id || '__empty'} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`bloque-select-option${isSelected ? ' is-selected' : ''}${index === active ? ' is-active' : ''}`}
                  style={
                    color
                      ? { background: `color-mix(in srgb, ${color} 12%, var(--bg-elev))` }
                      : undefined
                  }
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(opt.id)}
                >
                  {color ? <span className="color-dot" style={{ background: color }} /> : <span className="color-dot is-empty" />}
                  <span style={color ? { color } : undefined}>{opt.nombre}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
