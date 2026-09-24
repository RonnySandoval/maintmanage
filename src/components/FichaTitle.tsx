import { ClipboardList } from 'lucide-react'
import type { Ficha } from '../db/types'
import { bloqueColorVar, kindFichaVar } from '../lib/colors'
import { fichaTitulo } from '../lib/fichas'

export function FichaTitle({
  ficha,
  color,
  unified = false,
  icon = false,
  className,
}: {
  ficha: Pick<Ficha, 'numero' | 'nombre'> | null | undefined
  /** Color de bloque (Cronograma, Fichas y detalles). */
  color?: string
  /** Color único de ficha, sin bloque (Histórico, Inicio). */
  unified?: boolean
  /** Muestra el icono de ficha junto al número. */
  icon?: boolean
  className?: string
}) {
  const text = ficha ? fichaTitulo(ficha) : 'Ficha'
  const style =
    color && !unified
      ? { color: bloqueColorVar(color) }
      : unified
        ? { color: kindFichaVar() }
        : undefined
  return (
    <span
      className={`ficha-title${className ? ` ${className}` : ''}`}
      style={style}
    >
      {icon ? (
        <ClipboardList size={14} aria-hidden className="ficha-title-icon" />
      ) : null}
      {text}
    </span>
  )
}
