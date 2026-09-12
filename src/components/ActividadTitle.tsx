import type { Actividad } from '../db/types'
import { tipoActividadColor } from '../db/types'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { bloqueColorVar } from '../lib/colors'
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
  const color = actividad ? tipoActividadColor(actividad.tipo, tipos) : undefined
  return (
    <span
      className={`ficha-title${className ? ` ${className}` : ''}`}
      style={color ? { color: bloqueColorVar(color) } : undefined}
    >
      {text}
    </span>
  )
}
