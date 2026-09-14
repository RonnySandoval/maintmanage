import type { ReactNode } from 'react'
import { ESTADOS, tipoActividadColor, tipoActividadLabel, type EstadoOcurrencia } from '../db/types'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { label, useAliases } from '../lib/labels'
import { bloqueColorVar } from '../lib/colors'
import { useStatusLabels } from '../hooks/useStatusLabels'
import { SIMBOLO_CORRECTIVA, SIMBOLOS_ESTADO } from '../lib/simbolos'

export function ExtraBadge() {
  return <span className="badge badge-extra">Extraordinaria</span>
}

export function TipoBadge({ tipo }: { tipo?: string | null }) {
  const tipos = useTiposActividad()
  const meta = tipos.find((t) => t.id === tipo)
  const color = meta?.color ?? tipoActividadColor(tipo)
  return (
    <span
      className="badge badge-tipo"
      style={{
        background: `color-mix(in srgb, ${bloqueColorVar(color)} 16%, var(--bg-muted))`,
        color: bloqueColorVar(color),
      }}
    >
      {meta?.label ?? tipoActividadLabel(tipo)}
    </span>
  )
}

export function StatusBadge({
  estado,
  iconOnly = false,
}: {
  estado: EstadoOcurrencia
  iconOnly?: boolean
}) {
  const { showLabels } = useStatusLabels()
  const meta = SIMBOLOS_ESTADO[estado]
  const hideWords = iconOnly || !showLabels
  return (
    <span className={`badge badge-${estado}${hideWords ? ' badge-icon' : ''}`} title={meta.label}>
      <span className="sym" aria-hidden>
        {meta.glyph}
      </span>
      {hideWords ? <span className="sr-only">{meta.label}</span> : meta.label}
    </span>
  )
}

export function StatusWordsToggle({ className }: { className?: string }) {
  const { showLabels, toggleLabels } = useStatusLabels()
  return (
    <button
      type="button"
      className={`estado-words-btn${className ? ` ${className}` : ''}${showLabels ? '' : ' is-off'}`}
      onClick={toggleLabels}
      aria-pressed={showLabels}
      aria-label={showLabels ? 'Ocultar nombres de estado' : 'Mostrar nombres de estado'}
      title={showLabels ? 'Ocultar nombres de estado' : 'Mostrar nombres de estado'}
    >
      Aa
    </button>
  )
}

export function LeyendaSimbolos() {
  const aliases = useAliases()
  return (
    <div className="sym-legend" aria-label="Código de símbolos">
      {ESTADOS.map((estado) => {
        const item = SIMBOLOS_ESTADO[estado.id]
        return (
          <span key={estado.id} className="sym-legend-item">
            <span className="sym" aria-hidden>
              {item.glyph}
            </span>
            {item.label}
          </span>
        )
      })}
      <span className="sym-legend-item">
        <span className="sym" aria-hidden>
          {SIMBOLO_CORRECTIVA}
        </span>
        Con {label('accion_correctiva', aliases)}
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
