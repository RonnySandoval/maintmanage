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
}: {
  prioridad: PrioridadAccion
  className?: string
}) {
  const Icon = ICONS[prioridad]
  return (
    <span className={`prioridad prioridad-${prioridad}${className ? ` ${className}` : ''}`}>
      <Icon size={14} aria-hidden />
      {prioridadLabel(prioridad)}
    </span>
  )
}
