import type { ReactNode } from 'react'
import { ESTADOS, type EstadoOcurrencia } from '../db/types'

const labels = Object.fromEntries(ESTADOS.map((e) => [e.id, e.label])) as Record<
  EstadoOcurrencia,
  string
>

export function StatusBadge({ estado }: { estado: EstadoOcurrencia }) {
  return <span className={`badge badge-${estado}`}>{labels[estado]}</span>
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
