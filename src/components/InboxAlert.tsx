import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/** Aviso compacto de correctivas sin fecha, con flash inicial. */
export function InboxAlert({
  count,
  to = '/historicos?tab=acciones&fecha=sin',
  label = 'sin programar',
}: {
  count: number
  to?: string
  label?: string
}) {
  if (count < 1) return null
  return (
    <Link className="inbox-alert" to={to} role="status">
      <span className="inbox-alert-pulse" aria-hidden />
      <span className="inbox-alert-text">
        <strong>{count}</strong> correctiva{count === 1 ? '' : 's'} {label}
      </span>
      <span className="inbox-alert-cta">
        Ver
        <ChevronRight size={14} aria-hidden />
      </span>
    </Link>
  )
}
