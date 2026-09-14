import type { Actividad } from '../db/types'
import { tipoActividadLabel } from '../db/types'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { kindActividadVar } from '../lib/colors'
import { tipoActividadIcon } from '../lib/tipoIcons'
import { actividadTitulo } from '../lib/actividades'

export function ActividadTitle({
  actividad,
  className,
}: {
  actividad: Pick<Actividad, 'titulo' | 'tipo'> | null | undefined
  className?: string
}) {
  const tipos = useTiposActividad()
  const text = actividad ? actividadTitulo(actividad, tipos) : 'Actividad'
  const typeLabel = tipoActividadLabel(actividad?.tipo, tipos)
  const Icon = tipoActividadIcon(actividad?.tipo)
  return (
    <span
      className={`ficha-title actividad-title${className ? ` ${className}` : ''}`}
      style={{ color: kindActividadVar() }}
      title={typeLabel}
    >
      <Icon className="tipo-icon" size={15} strokeWidth={2.25} aria-hidden />
      <span className="actividad-title-text">{text}</span>
    </span>
  )
}
