import { tipoActividadLabel } from '../db/types'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { tipoActividadIcon } from '../lib/tipoIcons'

/** Viñeta de tipo de actividad (solo icono; el nombre va en title/aria). */
export function TipoMark({
  tipo,
  className,
}: {
  tipo?: string | null
  className?: string
}) {
  const tipos = useTiposActividad()
  const label = tipoActividadLabel(tipo, tipos)
  const Icon = tipoActividadIcon(tipo)
  return (
    <span
      className={`tipo-mark${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
    >
      <Icon size={16} strokeWidth={2.25} aria-hidden />
    </span>
  )
}
