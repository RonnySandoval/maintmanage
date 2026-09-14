import type { ReactNode } from 'react'

export function EntityCard({
  className,
  title,
  badge,
  leading,
  children,
  footer,
  compact = false,
  nested = false,
}: {
  className?: string
  title: ReactNode
  badge?: ReactNode
  /** Columna izquierda tipo viñeta (p. ej. prioridad). */
  leading?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  compact?: boolean
  nested?: boolean
}) {
  const classes = [
    nested ? '' : 'card',
    'entity-card',
    compact ? 'is-compact' : '',
    leading ? 'has-leading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      {leading ? <div className="entity-card-leading">{leading}</div> : null}
      <div className="entity-card-main">
        <header className="entity-card-head">
          <div className="entity-card-title">{title}</div>
          {badge ? <div className="entity-card-badge">{badge}</div> : null}
        </header>
        {children ? <div className="entity-card-body">{children}</div> : null}
        {footer ? <footer className="entity-card-foot">{footer}</footer> : null}
      </div>
    </div>
  )
}
