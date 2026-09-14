import type { ReactNode } from 'react'

export function EntityCard({
  className,
  title,
  badge,
  children,
  footer,
  compact = false,
  nested = false,
}: {
  className?: string
  title: ReactNode
  badge?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  compact?: boolean
  nested?: boolean
}) {
  const classes = [
    nested ? '' : 'card',
    'entity-card',
    compact ? 'is-compact' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <header className="entity-card-head">
        <div className="entity-card-title">{title}</div>
        {badge ? <div className="entity-card-badge">{badge}</div> : null}
      </header>
      {children ? <div className="entity-card-body">{children}</div> : null}
      {footer ? <footer className="entity-card-foot">{footer}</footer> : null}
    </div>
  )
}
