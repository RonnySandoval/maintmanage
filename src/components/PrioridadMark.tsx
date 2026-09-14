import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import { prioridadLabel, type PrioridadAccion } from '../db/types'
import { useStatusLabels } from '../hooks/useStatusLabels'

const ICONS = {
  alta: ArrowUp,
  media: ArrowRight,
  baja: ArrowDown,
} as const

export function PrioridadMark({
  prioridad,
  className,
  iconOnly = false,
  /** En selectores de formulario: siempre mostrar el nombre. */
  forceLabel = false,
}: {
  prioridad: PrioridadAccion
  className?: string
  /** Solo el símbolo (viñeta); el nombre va en title/aria. */
  iconOnly?: boolean
  forceLabel?: boolean
}) {
  const { showLabels } = useStatusLabels()
  const Icon = ICONS[prioridad]
  const label = prioridadLabel(prioridad)
  const hideWords = iconOnly || (!forceLabel && !showLabels)
  return (
    <span
      className={`prioridad prioridad-${prioridad}${hideWords ? ' is-bullet' : ''}${className ? ` ${className}` : ''}`}
      title={`Prioridad: ${label}`}
      aria-label={`Prioridad ${label}`}
    >
      <Icon size={hideWords ? 16 : 14} aria-hidden />
      {hideWords ? null : label}
    </span>
  )
}
