import type { Bloque, Encargado, EstadoOcurrencia, Ficha, Ocurrencia } from '../db/types'
import { formatFechaProgramada, monthLabel } from './dates'
import { labelEstado } from './simbolos'

export const FICHA_MESSAGE_STORAGE_KEY = 'maintmanage.ficha-message-template'

export const DEFAULT_FICHA_MESSAGE_TEMPLATE =
  'Hola {{encargado}},\n\nTe escribo por la inspección de la ficha {{numero_ficha}} - {{nombre_ficha}}, prevista para {{mes_inspeccion}}.\n\nGracias.'

export const FICHA_MESSAGE_TAGS = [
  { token: '{{numero_ficha}}', label: 'Nº de ficha' },
  { token: '{{nombre_ficha}}', label: 'Nombre de ficha' },
  { token: '{{mes_inspeccion}}', label: 'Mes de inspección' },
  { token: '{{fecha_inspeccion}}', label: 'Fecha inspección' },
  { token: '{{estado_inspeccion}}', label: 'Estado' },
  { token: '{{encargado}}', label: 'Encargado' },
  { token: '{{telefono_encargado}}', label: 'Teléfono' },
  { token: '{{bloque}}', label: 'Bloque' },
] as const

export type FichaMessageTag = (typeof FICHA_MESSAGE_TAGS)[number]['token']

export function estadoInspeccionLabel(estado?: EstadoOcurrencia): string {
  if (!estado) return 'sin inspección'
  return labelEstado(estado)
}

export function renderFichaMessage(
  template: string,
  ficha: Ficha,
  encargado?: Encargado,
  bloque?: Bloque,
  ocurrencia?: Ocurrencia,
): string {
  const values: Record<FichaMessageTag, string> = {
    '{{numero_ficha}}': ficha.numero,
    '{{nombre_ficha}}': ficha.nombre,
    '{{mes_inspeccion}}': ocurrencia ? monthLabel(ocurrencia.fechaProgramada) : 'sin fecha',
    '{{fecha_inspeccion}}': ocurrencia
      ? formatFechaProgramada(ocurrencia.fechaProgramada, ficha.fechaPrecision)
      : 'sin fecha',
    '{{estado_inspeccion}}': ocurrencia ? estadoInspeccionLabel(ocurrencia.estado) : 'sin inspección',
    '{{encargado}}': encargado?.nombre ?? 'sin encargado',
    '{{telefono_encargado}}': encargado?.telefonos || encargado?.contacto || 'sin teléfono',
    '{{bloque}}': bloque?.nombre ?? 'sin bloque',
  }

  return template.replace(
    /{{(numero_ficha|nombre_ficha|mes_inspeccion|fecha_inspeccion|estado_inspeccion|encargado|telefono_encargado|bloque)}}/g,
    (tag) => values[tag as FichaMessageTag],
  )
}