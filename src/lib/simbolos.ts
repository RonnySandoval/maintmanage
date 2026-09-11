import type { EstadoOcurrencia } from '../db/types'

export const SIMBOLO_EJECUTADA = '✓'
export const SIMBOLO_PENDIENTE = '○'
export const SIMBOLO_PROGRAMADA = '◷'
export const SIMBOLO_VENCIDA = '!'
export const SIMBOLO_CORRECTIVA = '▴'

export const SIMBOLOS_ESTADO: Record<EstadoOcurrencia, { glyph: string; label: string }> = {
  ejecutada: { glyph: SIMBOLO_EJECUTADA, label: 'Ejecutada' },
  pendiente: { glyph: SIMBOLO_PENDIENTE, label: 'Pendiente' },
  proxima: { glyph: SIMBOLO_PROGRAMADA, label: 'Programada' },
  vencida: { glyph: SIMBOLO_VENCIDA, label: 'Vencida' },
}

export function simboloEstado(estado: EstadoOcurrencia): string {
  return SIMBOLOS_ESTADO[estado]?.glyph ?? '•'
}

export function labelEstado(estado: EstadoOcurrencia): string {
  return SIMBOLOS_ESTADO[estado]?.label ?? estado
}
