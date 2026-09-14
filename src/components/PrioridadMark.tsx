import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import { prioridadLabel, type PrioridadAccion } from '../db/types'

const ICONS = {
  alta: ArrowUp,
  media: ArrowRight,
  baja: ArrowDown,
} as const

export function PrioridadMark({
  prioridad,
  className,
  iconOnly = false,
}: {
  prioridad: PrioridadAccion
  className?: string
  /** Solo el símbolo (viñeta); el nombre va en title/aria. */
  iconOnly?: boolean
}) {
  const Icon = ICONS[prioridad]
  const label = prioridadLabel(prioridad)
  return (
    <span
      className={`prioridad prioridad-${prioridad}${iconOnly ? ' is-bullet' : ''}${className ? ` ${className}` : ''}`}
      title={`Prioridad: ${label}`}
      aria-label={`Prioridad ${label}`}
    >
      <Icon size={iconOnly ? 16 : 14} aria-hidden />
      {iconOnly ? null : label}
    </span>
  )
}
