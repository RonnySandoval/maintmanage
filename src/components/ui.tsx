import type { ReactNode } from 'react'
import type { EstadoOcurrencia } from '../db/types'
import { SIMBOLOS_ESTADO, SIMBOLO_CORRECTIVA } from '../lib/simbolos'

export function StatusBadge({ estado }: { estado: EstadoOcurrencia }) {
  const meta = SIMBOLOS_ESTADO[estado]
  return (
    <span className={`badge badge-${estado}`}>
      <span className="sym" aria-hidden>
        {meta.glyph}
      </span>
      {meta.label}
    </span>
  )
}

export function LeyendaSimbolos() {
  return (
    <div className="sym-legend" aria-label="Código de símbolos">
      {(Object.values(SIMBOLOS_ESTADO) as { glyph: string; label: string }[]).map((item) => (
        <span key={item.label} className="sym-legend-item">
          <span className="sym" aria-hidden>
            {item.glyph}
          </span>
          {item.label}
        </span>
      ))}
      <span className="sym-legend-item">
        <span className="sym" aria-hidden>
          {SIMBOLO_CORRECTIVA}
        </span>
        Con acción correctiva
      </span>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="card empty">
      {icon}
      <h2 className="title-sm">{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-spread" style={{ marginBottom: '0.75rem' }}>
          <h2 className="title-sm" style={{ margin: 0 }}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
        {footer ? <div className="row" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>{footer}</div> : null}
      </div>
    </div>
  )
}
