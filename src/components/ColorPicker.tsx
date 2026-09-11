import { useState } from 'react'
import { BLOQUE_PALETTE, bloqueColorId, bloqueColorVar } from '../lib/colors'
import { Modal } from './ui'

export function ColorPicker({
  id,
  value,
  onChange,
  label = 'Color',
  compact = false,
}: {
  id?: string
  value: string
  onChange: (color: string) => void
  label?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const current = bloqueColorId(value)
  const currentLabel = BLOQUE_PALETTE.find((swatch) => swatch.id === current)?.label ?? label

  return (
    <div className={`field color-field${compact ? ' is-compact' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        className="color-btn"
        style={{ background: bloqueColorVar(value) }}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${currentLabel}`}
        title={currentLabel}
      />
      <Modal open={open} title="Elegir color" onClose={() => setOpen(false)}>
        <div className="color-pick" role="listbox" aria-label="Colores del bloque">
          {BLOQUE_PALETTE.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              role="option"
              aria-selected={current === swatch.id}
              aria-label={swatch.label}
              title={swatch.label}
              className={current === swatch.id ? 'active' : ''}
              style={{ background: `var(--bloque-${swatch.id})` }}
              onClick={() => {
                onChange(swatch.id)
                setOpen(false)
              }}
            />
          ))}
        </div>
      </Modal>
    </div>
  )
}
