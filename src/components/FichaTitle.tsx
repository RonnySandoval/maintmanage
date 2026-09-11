import type { Ficha } from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { fichaTitulo } from '../lib/fichas'

export function FichaTitle({
  ficha,
  color,
  className,
}: {
  ficha: Pick<Ficha, 'numero' | 'nombre'> | null | undefined
  color?: string
  className?: string
}) {
  const text = ficha ? fichaTitulo(ficha) : 'Ficha'
  return (
    <span
      className={`ficha-title${className ? ` ${className}` : ''}`}
      style={color ? { color: bloqueColorVar(color) } : undefined}
    >
      {text}
    </span>
  )
}
